// 잡 만들기(트랜잭션 안)와 GPU 워커 제출(트랜잭션 밖)
import { randomInt, randomUUID } from "node:crypto";

import type { z } from "zod";

import type { Image, Prisma } from "@/generated/prisma/client";
import { ApiError, ERROR_MESSAGES } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { getWorkerClient, isWorkerUnavailable, WorkerError } from "@/lib/gpu/client";
import { getModel, type ModelId } from "@/lib/gpu/models";
import { fitToMegapixel, SIZE_BY_RATIO } from "@/lib/gpu/sizes";
import { ACTIVE_WINDOW_MS, assertCapacity } from "@/lib/jobs/capacity";
import { jobInclude, type JobWithImages } from "@/lib/jobs/queries";
import { type createJobsBodySchema, SEED_MAX } from "@/lib/jobs/schemas";
import { ACTIVE_STATUSES } from "@/lib/jobs/transitions";
import { readFileIfExists, storageKey } from "@/lib/storage";

export type CreateJobsInput = z.output<typeof createJobsBodySchema>;

type SubmitResult = "submitted" | "unavailable";

// 지금 워커에 보내는 중인 잡의 결과(한 프로세스 안). 응답 뒤 제출과 그 사이 들어온 폴링 동기화가 같은 잡을 두 번 보내지 않고,
// 뒤에 온 쪽은 같은 결과(워커에 닿았는지)를 받는다
const inflight = new Map<string, Promise<SubmitResult>>();

const TITLE_MAX = 40;

export function randomSeed(): number {
  return randomInt(0, SEED_MAX + 1);
}

// 첫 줄을 제목으로. 글자(코드 포인트) 기준 40자를 넘으면 39자 + …
export function titleFromPrompt(prompt: string): string {
  const firstLine = prompt.trim().split(/\r?\n/)[0].trim();
  const chars = Array.from(firstLine);
  return chars.length > TITLE_MAX ? `${chars.slice(0, TITLE_MAX - 1).join("")}…` : firstLine;
}

// 검증 → 크기·시드 결정 → 활성 잡 상한 → count 개 QUEUED 생성. 여기서 던진 ApiError 는 호출한 트랜잭션을 되돌린다
export async function createJobs(tx: Prisma.TransactionClient, conversation: { id: string; model: string }, input: CreateJobsInput): Promise<JobWithImages[]> {
  const spec = getModel(conversation.model as ModelId);
  let inputImage: Image | null = null;
  if (input.inputImageId) {
    if (!spec.canEdit) throw new ApiError(400, "model_cannot_edit");
    inputImage = await tx.image.findUnique({ where: { id: input.inputImageId } });
    // 휴지통 이미지는 없는 것으로 본다(복구하면 다시 쓸 수 있다)
    if (!inputImage || inputImage.deletedAt) throw new ApiError(400, "input_image_not_found");
  }
  if (input.transparent && !spec.supportsTransparent) throw new ApiError(400, "transparent_not_supported");

  const active = await tx.job.count({ where: { status: { in: ACTIVE_STATUSES }, createdAt: { gte: new Date(Date.now() - ACTIVE_WINDOW_MS) } } });
  assertCapacity(active, input.count);

  // 대화에 붙지 않은 업로드는 이 대화로 귀속해 대화를 지울 때 같이 지워지게 한다
  if (inputImage && inputImage.kind === "UPLOADED" && inputImage.conversationId === null) {
    await tx.image.update({ where: { id: inputImage.id }, data: { conversationId: conversation.id } });
  }

  const size = inputImage ? fitToMegapixel(inputImage.width, inputImage.height) : SIZE_BY_RATIO[input.ratio];
  const batchId = randomUUID();
  const jobs: JobWithImages[] = [];
  for (let i = 0; i < input.count; i++) {
    const seed = input.seed === undefined ? randomSeed() : (input.seed + i) % (SEED_MAX + 1);
    jobs.push(
      await tx.job.create({
        data: {
          conversationId: conversation.id,
          model: spec.id,
          kind: inputImage ? "EDIT" : "GENERATE",
          batchId,
          prompt: input.prompt,
          width: size.width,
          height: size.height,
          seed,
          steps: spec.steps,
          transparent: input.transparent,
          inputImageId: inputImage?.id ?? null,
        },
        include: jobInclude,
      }),
    );
  }
  return jobs;
}

// 실행 중이 아닌 잡만 FAILED 로 바꾼다(그 사이 취소된 잡을 덮지 않게)
async function markFailed(jobId: string, error: string): Promise<void> {
  await prisma.job.updateMany({ where: { id: jobId, status: { in: ACTIVE_STATUSES } }, data: { status: "FAILED", error } });
}

// 워커에 잡 하나를 보낸다. 워커를 지금 쓸 수 없으면 'unavailable'(DB 그대로, 다음 동기화가 다시 보낸다).
// 잡 자체의 문제(워커 4xx·입력 이미지 없음)는 그 잡을 FAILED 로 바꾸고 'submitted'.
// inputIds: 같은 배치에서 같은 입력 이미지를 한 번만 올리도록 이미지 id → 워커 input_id 를 기억한다
export function submitToWorker(job: JobWithImages, inputIds: Map<string, string> = new Map()): Promise<SubmitResult> {
  const pending = inflight.get(job.id);
  if (pending) return pending;
  const result = sendToWorker(job, inputIds).finally(() => inflight.delete(job.id));
  inflight.set(job.id, result);
  return result;
}

async function sendToWorker(job: JobWithImages, inputIds: Map<string, string>): Promise<SubmitResult> {
  const client = getWorkerClient();
  try {
    // 받은 잡은 응답 전의 스냅숏이다. 그 사이 다른 쪽이 보냈거나(submittedAt) 취소·완료됐으면 보내지 않는다(입력 업로드·GPU 낭비 없이)
    const fresh = await prisma.job.findUnique({ where: { id: job.id }, select: { submittedAt: true, status: true } });
    if (!fresh || fresh.submittedAt !== null || !ACTIVE_STATUSES.includes(fresh.status)) return "submitted";
    let inputId: string | null = null;
    if (job.kind === "EDIT") {
      if (!job.inputImage) {
        await markFailed(job.id, ERROR_MESSAGES.input_image_not_found);
        return "submitted";
      }
      inputId = inputIds.get(job.inputImage.id) ?? null;
      if (!inputId) {
        const bytes = await readFileIfExists(storageKey("images", job.inputImage.id));
        if (!bytes) {
          await markFailed(job.id, ERROR_MESSAGES.input_image_not_found);
          return "submitted";
        }
        inputId = (await client.createInput(bytes, "image/png")).input_id;
        inputIds.set(job.inputImage.id, inputId);
      }
    }
    await client.createJob({
      id: job.id,
      model: job.model as ModelId,
      kind: job.kind === "EDIT" ? "edit" : "generate",
      prompt: job.prompt,
      width: job.width,
      height: job.height,
      seed: job.seed,
      steps: job.steps,
      transparent: job.transparent,
      input_id: inputId,
    });
    // 아직 진행 중일 때만 제출 시각을 남긴다. 보내는 사이 사용자가 취소했다면 워커 쪽 잡도 취소한다(GPU 를 헛돌리지 않게)
    const marked = await prisma.job.updateMany({ where: { id: job.id, submittedAt: null, status: { in: ACTIVE_STATUSES } }, data: { submittedAt: new Date() } });
    if (marked.count === 0) {
      const current = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true } });
      if (current?.status === "CANCELLED") await client.cancelJob(job.id).catch(() => undefined);
    }
    return "submitted";
  } catch (e) {
    if (isWorkerUnavailable(e)) return "unavailable";
    if (e instanceof WorkerError) {
      await markFailed(job.id, e.workerMessage ?? ERROR_MESSAGES.internal_error);
      return "submitted";
    }
    throw e;
  }
}

// 응답을 보낸 뒤(after) 잡을 차례로 워커에 보낸다(응답이 워커 접수·입력 업로드를 기다리지 않는다).
// 하나라도 워커를 못 쓰면 나머지는 다음 동기화에 맡긴다. 디스크·DB 같은 로컬 오류도 던지지 않고 남은 잡을 다음 동기화에 맡긴다
export async function submitJobs(jobs: JobWithImages[]): Promise<void> {
  const inputIds = new Map<string, string>();
  for (const job of jobs) {
    let result: "submitted" | "unavailable";
    try {
      result = await submitToWorker(job, inputIds);
    } catch (e) {
      // 잡 id 와 오류 종류만 남긴다(메시지에 프롬프트·경로가 섞일 수 있다)
      console.error("[submit]", job.id, (e as { name?: unknown })?.name, (e as { code?: unknown })?.code);
      break;
    }
    if (result === "unavailable") break;
  }
}
