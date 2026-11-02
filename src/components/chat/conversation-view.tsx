"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Composer, type ComposerSubmit, type ComposerTarget } from "@/components/chat/composer";
import { ConversationMenu } from "@/components/chat/conversation-menu";
import { toTarget } from "@/components/chat/target-chip";
import { groupBatches, Thread } from "@/components/chat/thread";
import { WorkerBanner } from "@/components/chat/worker-banner";
import { Topbar } from "@/components/shell/topbar";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { getModel, type ModelId } from "@/lib/gpu/models";
import { ratioFromSize } from "@/lib/gpu/sizes";
import type { ConversationDetailDto, ImageDto, JobDto, JobsCreatedDto } from "@/lib/jobs/schemas";
import { isActive } from "@/lib/jobs/transitions";
import { queryKeys } from "@/lib/query-keys";

// 진행 중인 잡이 있을 때 대화를 다시 불러오는 간격(GET 이 워커와 맞춘다)
const POLL_MS = 1500;
const ID_RE = /^[a-z0-9]+$/;
const FALLBACK = "문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.";

function findImage(detail: ConversationDetailDto, id: string): ImageDto | null {
  for (const j of detail.jobs) {
    if (j.image?.id === id) return j.image;
    if (j.inputImage?.id === id) return j.inputImage;
  }
  return null;
}

function noteFor(model: ModelId, hasTarget: boolean): string {
  if (!getModel(model).canEdit) return "MOSS-Image 대화는 만들기만 해요. 고치려면 새 대화에서 다른 모델을 고르세요.";
  if (hasTarget) return "고칠 이미지를 붙였어요. 보내면 새 버전으로 고쳐요.";
  return "이 대화의 모델은 바뀌지 않아요. 다른 모델은 새 대화에서 고르세요.";
}

export function ConversationView({ id, initialData }: { id: string; initialData: ConversationDetailDto }) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [deleting, setDeleting] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.conversations.detail(id),
    queryFn: () => apiFetch<ConversationDetailDto>(`/api/conversations/${id}`),
    initialData,
    staleTime: 0,
    enabled: !deleting,
    refetchInterval: (q) => (q.state.data?.jobs.some((j) => isActive(j.status)) ? POLL_MS : false),
  });
  const detail = query.data;
  const model = detail.model as ModelId;
  const spec = getModel(model);

  // 고칠 이미지: 직접 고른 것(manualTarget) > 최신 요청의 첫 결과(자동 첨부). × 로 뺀 요청은 다시 붙이지 않는다
  const [manualTarget, setManualTarget] = useState<ComposerTarget | null>(() => {
    const param = searchParams.get("target");
    const img = param && ID_RE.test(param) ? findImage(initialData, param) : null;
    return img ? toTarget(img) : null;
  });
  const [dismissedBatchId, setDismissedBatchId] = useState<string | null>(null);
  const latest = groupBatches(detail.jobs).at(-1);
  const latestImage = latest?.jobs.find((j) => j.image)?.image ?? null;
  const autoTarget = spec.canEdit && latest && latest.batchId !== dismissedBatchId && latestImage ? toTarget(latestImage) : null;
  const target = manualTarget ?? autoTarget;

  // 결과 이미지 수가 바뀌면 사이드바 썸네일·순서를 새로 받는다(외부 캐시와 맞추는 일이라 Effect)
  const imageCount = detail.jobs.filter((j) => j.image).length;
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list() });
  }, [imageCount, queryClient]);

  // 새 요청이 붙으면 맨 아래로 스크롤한다
  const endRef = useRef<HTMLDivElement>(null);
  const jobCount = detail.jobs.length;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [jobCount]);

  function handleTargetChange(t: ComposerTarget | null) {
    setManualTarget(t);
    if (t === null && latest) setDismissedBatchId(latest.batchId);
  }

  async function createJobs(body: Omit<ComposerSubmit, "count"> & { count: number }) {
    const created = await apiFetch<JobsCreatedDto>(`/api/conversations/${id}/jobs`, { method: "POST", json: body });
    queryClient.setQueryData<ConversationDetailDto>(queryKeys.conversations.detail(id), (old) =>
      old ? { ...old, jobs: [...old.jobs, ...created.jobs], worker: created.worker } : old,
    );
    void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
  }

  async function handleSubmit(d: ComposerSubmit) {
    try {
      await createJobs(d);
      setManualTarget(null);
      setDismissedBatchId(null);
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : FALLBACK);
      throw e;
    }
  }

  // 같은 프롬프트·장수·투명 배경·고칠 이미지로 다시 만든다(시드는 새로)
  async function handleRegenerate(jobs: JobDto[]) {
    const first = jobs[0];
    try {
      await createJobs({
        prompt: first.prompt,
        ratio: ratioFromSize(first.width, first.height) ?? "1:1",
        count: jobs.length,
        transparent: first.transparent,
        inputImageId: first.inputImage?.id,
      });
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : FALLBACK);
    }
  }

  async function handleCancel(jobId: string) {
    try {
      await apiFetch(`/api/jobs/${jobId}`, { method: "DELETE" });
    } catch (e) {
      // 이미 끝난 잡(409)은 "이미 끝난 작업이에요." 만 알린다
      toast.error(e instanceof ApiClientError ? e.message : FALLBACK);
    } finally {
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(id) });
    }
  }

  return (
    <>
      <Topbar title={detail.title ?? "대화"} model={model} actions={<ConversationMenu id={id} onDeletingChange={setDeleting} />} />
      <div className="mx-auto flex w-full max-w-205 flex-1 flex-col gap-6 px-4 pt-4 pb-6 sm:px-6">
        {!detail.worker.reachable && <WorkerBanner />}
        <Thread detail={detail} onEdit={(img) => setManualTarget(toTarget(img))} onRegenerate={handleRegenerate} onCancel={handleCancel} />
        <div ref={endRef} />
      </div>
      <div className="sticky bottom-0 mx-auto w-full max-w-205 bg-background px-4 pb-4 sm:px-6 sm:pb-6">
        <Composer model={model} mode="chat" target={target} onTargetChange={handleTargetChange} onSubmit={handleSubmit} note={noteFor(model, target !== null)} />
      </div>
    </>
  );
}

export function ThreadSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-205 flex-1 flex-col gap-6 px-4 pt-20 pb-6 sm:px-6" aria-hidden="true">
      <Skeleton className="ml-auto h-10 w-2/3" />
      <Skeleton className="aspect-square w-full max-w-md" />
      <Skeleton className="mt-auto h-32" />
    </div>
  );
}
