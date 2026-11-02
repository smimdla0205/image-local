// 활성 잡을 GPU 워커 상태로 맞춘다(GET 요청마다 호출 — 폴링). 결과가 나오면 이미지를 내려받아 저장한다
import { randomUUID } from "node:crypto";

import { ERROR_MESSAGES } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { getWorkerClient, isWorkerUnavailable, WorkerError } from "@/lib/gpu/client";
import { inspectPng, makeThumb } from "@/lib/images/normalize";
import { submitToWorker } from "@/lib/jobs/create";
import { jobInclude, type JobWithImages } from "@/lib/jobs/queries";
import type { WorkerState } from "@/lib/jobs/schemas";
import { applyWorkerStatus, isActive, type JobPatch, WORKER_LOST_MESSAGE } from "@/lib/jobs/transitions";
import { deleteFile, putFile, storageKey } from "@/lib/storage";

const ACTIVE = ["QUEUED", "RUNNING"] as const;

// 아직 진행 중인 잡에만 쓴다(그 사이 취소·완료된 잡을 덮지 않게)
async function patchIfActive(jobId: string, patch: JobPatch): Promise<void> {
  await prisma.job.updateMany({ where: { id: jobId, status: { in: [...ACTIVE] } }, data: patch });
}

function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: unknown })?.code === "P2002";
}

// 결과를 저장하는 사이 잡이 취소·실패 처리됐다(완료로 덮지 않고 이미지도 만들지 않는다)
class JobNoLongerActive extends Error {}

// 결과 PNG 를 내려받아 파일·Image 행·잡 상태를 함께 저장한다. 같은 잡을 다른 요청이 먼저 저장했으면 방금 쓴 파일을 지운다
async function saveOutput(job: JobWithImages, patch: JobPatch): Promise<void> {
  const png = await getWorkerClient().getOutput(job.id);
  let info: Awaited<ReturnType<typeof inspectPng>>;
  let thumb: Uint8Array;
  try {
    info = await inspectPng(png);
    thumb = await makeThumb(png);
  } catch {
    // 워커가 읽을 수 없는 이미지를 돌려줬다. 다시 받아도 같으므로 실패로 끝낸다
    await patchIfActive(job.id, { status: "FAILED", error: ERROR_MESSAGES.internal_error });
    return;
  }
  const imageId = randomUUID().replaceAll("-", "");
  const imageKey = storageKey("images", imageId);
  const thumbKey = storageKey("thumbs", imageId);
  try {
    await putFile(imageKey, png);
    await putFile(thumbKey, thumb);
    await prisma.$transaction(async (tx) => {
      // 아직 진행 중일 때만 완료로 바꾼다(그 사이 취소·실패된 잡을 덮지 않는다)
      const claimed = await tx.job.updateMany({ where: { id: job.id, status: { in: [...ACTIVE] } }, data: patch });
      if (claimed.count === 0) throw new JobNoLongerActive();
      // 고친 원본이 그 사이 지워졌을 수 있어 부모는 지금 기준으로 다시 확인한다(버전 번호는 원본 기준 그대로)
      const parent = job.inputImageId ? await tx.image.findUnique({ where: { id: job.inputImageId }, select: { id: true } }) : null;
      await tx.image.create({
        data: {
          id: imageId,
          kind: job.kind === "EDIT" ? "EDITED" : "GENERATED",
          jobId: job.id,
          conversationId: job.conversationId,
          model: job.model,
          prompt: job.prompt,
          seed: job.seed,
          steps: job.steps,
          width: info.width,
          height: info.height,
          hasAlpha: info.hasAlpha,
          bytes: png.length,
          version: job.inputImage ? job.inputImage.version + 1 : 1,
          parentId: parent?.id ?? null,
        },
      });
      await tx.conversation.update({ where: { id: job.conversationId }, data: { updatedAt: new Date() } });
    });
  } catch (e) {
    // 행을 못 만들었으면 파일도 남기지 않는다
    await Promise.allSettled([deleteFile(imageKey), deleteFile(thumbKey)]);
    if (e instanceof JobNoLongerActive) return;
    // jobId unique 위반 = 동시에 들어온 다른 동기화가 이미 저장했다(멱등)
    if (isUniqueViolation(e)) {
      await patchIfActive(job.id, patch);
      return;
    }
    throw e;
  }
}

// 활성 잡을 차례로 워커와 맞춘다. 한 잡의 오류가 응답 전체를 500 으로 만들지 않도록 잡마다 따로 처리한다.
// 워커를 쓸 수 없으면 남은 잡은 건너뛰고 reachable=false(DB 는 그대로, 다음 폴링이 이어 간다)
export async function syncJobs(jobs: JobWithImages[]): Promise<{ jobs: JobWithImages[]; worker: WorkerState }> {
  const active = jobs.filter((j) => isActive(j.status));
  if (active.length === 0) return { jobs, worker: { reachable: true } };
  const client = getWorkerClient();
  let reachable = true;
  const touched = new Set<string>();

  for (const job of active) {
    try {
      if (!job.submittedAt) {
        // 생성할 때 워커가 없었던 잡은 이제 보낸다
        touched.add(job.id);
        if ((await submitToWorker(job)) === "unavailable") {
          reachable = false;
          break;
        }
        continue;
      }
      const ws = await client.getJob(job.id);
      const { patch, fetchOutput } = applyWorkerStatus({ status: job.status, step: job.step, hasImage: job.image !== null }, ws);
      touched.add(job.id);
      if (fetchOutput) await saveOutput(job, patch);
      else if (Object.keys(patch).length > 0) await patchIfActive(job.id, patch);
    } catch (e) {
      if (isWorkerUnavailable(e)) {
        reachable = false;
        break;
      }
      touched.add(job.id);
      if (e instanceof WorkerError && e.kind === "http" && e.status === 404) {
        await patchIfActive(job.id, { status: "FAILED", error: WORKER_LOST_MESSAGE });
      } else if (e instanceof WorkerError) {
        await patchIfActive(job.id, { status: "FAILED", error: e.workerMessage ?? ERROR_MESSAGES.internal_error });
      } else {
        // 디스크·DB 오류는 이 잡만 다음 폴링에 다시 시도한다. 잡 id 와 오류 종류만 남긴다
        console.error("[sync]", job.id, (e as { name?: unknown })?.name, (e as { code?: unknown })?.code);
      }
    }
  }

  if (touched.size === 0) return { jobs, worker: { reachable } };
  const fresh = await prisma.job.findMany({ where: { id: { in: [...touched] } }, include: jobInclude });
  const byId = new Map(fresh.map((j) => [j.id, j]));
  return { jobs: jobs.map((j) => byId.get(j.id) ?? j), worker: { reachable } };
}
