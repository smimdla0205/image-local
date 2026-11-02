"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Composer, type ComposerSubmit, type ComposerTarget } from "@/components/chat/composer";
import { ConversationMenu } from "@/components/chat/conversation-menu";
import { toTarget } from "@/components/chat/target-chip";
import { groupBatches, Thread } from "@/components/chat/thread";
import { WorkerBanner } from "@/components/chat/worker-banner";
import { Topbar } from "@/components/shell/topbar";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { getModel, type ModelId } from "@/lib/gpu/models";
import { ratioFromSize } from "@/lib/gpu/sizes";
import { findImage } from "@/lib/jobs/find-image";
import { type ConversationDetailDto, type ImageDto, type JobDto, type JobsDto, parseId } from "@/lib/jobs/schemas";
import { isActive } from "@/lib/jobs/transitions";
import { queryKeys } from "@/lib/query-keys";

// 진행 중인 잡이 있을 때 다시 묻는 간격(GET 이 워커와 맞춘다). 생성 중이면 1.5초, 대기만 남았으면 3초
const POLL_MS = 1500;
const QUEUED_POLL_MS = 3000;

export function ConversationView({ id, initialData }: { id: string; initialData: ConversationDetailDto }) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [deleting, setDeleting] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.conversations.detail(id),
    // 진행 중인 잡이 있으면 그 잡만 묻고 합친다. 합친 뒤 진행 중인 잡이 없으면(다 끝남) 다른 곳에서 더한 요청까지 보이게 전체를 한 번 받는다
    queryFn: async () => {
      const key = queryKeys.conversations.detail(id);
      const fetchDetail = () => apiFetch<ConversationDetailDto>(`/api/conversations/${id}`);
      const activeIds = queryClient
        .getQueryData<ConversationDetailDto>(key)
        ?.jobs.filter((j) => isActive(j.status))
        .map((j) => j.id);
      if (!activeIds?.length) return fetchDetail();
      const synced = await apiFetch<JobsDto>(`/api/conversations/${id}/jobs?ids=${activeIds.join(",")}`);
      // 묻는 사이 보낸 요청(setQueryData)을 잃지 않게 응답이 온 뒤의 캐시에 합친다
      const current = queryClient.getQueryData<ConversationDetailDto>(key);
      if (!current) return fetchDetail();
      const byId = new Map(synced.jobs.map((j) => [j.id, j]));
      const jobs = current.jobs.map((j) => byId.get(j.id) ?? j);
      if (!jobs.some((j) => isActive(j.status))) return fetchDetail();
      return { ...current, jobs, worker: synced.worker };
    },
    initialData,
    staleTime: 0,
    enabled: !deleting,
    refetchInterval: (q) => {
      const jobs = q.state.data?.jobs ?? [];
      if (!jobs.some((j) => isActive(j.status))) return false;
      return jobs.some((j) => j.status === "RUNNING") ? POLL_MS : QUEUED_POLL_MS;
    },
  });
  const detail = query.data;
  const model = detail.model as ModelId;
  const spec = getModel(model);

  // 고칠 이미지: 직접 고른 것(manualTarget) > 최신 요청의 첫 결과(자동 첨부). × 로 뺀 요청은 다시 붙이지 않는다
  // ?target= 은 처음 열 때뿐 아니라 같은 대화 안에서 바뀔 때(뷰어의 '이어서 고치기')도 반영한다(렌더 중 조정)
  const targetParam = searchParams.get("target");
  const targetFromParam = (param: string | null): ComposerTarget | null => {
    const imageId = parseId(param);
    const img = imageId ? findImage(detail, imageId) : null;
    return img ? toTarget(img) : null;
  };
  const [manualTarget, setManualTarget] = useState<ComposerTarget | null>(() => targetFromParam(targetParam));
  const [prevTargetParam, setPrevTargetParam] = useState(targetParam);
  if (prevTargetParam !== targetParam) {
    setPrevTargetParam(targetParam);
    const picked = targetFromParam(targetParam);
    if (picked) setManualTarget(picked);
  }
  const [dismissedBatchId, setDismissedBatchId] = useState<string | null>(null);
  const latest = groupBatches(detail.jobs).at(-1);
  const latestImage = latest?.jobs.find((j) => j.image)?.image ?? null;
  const autoTarget = spec.canEdit && latest && latest.batchId !== dismissedBatchId && latestImage ? toTarget(latestImage) : null;
  const target = manualTarget ?? autoTarget;

  // 결과 이미지 수가 바뀌면 사이드바 썸네일·순서를 새로 받는다(외부 캐시와 맞추는 일이라 Effect). 처음 그릴 때는 받지 않는다
  const imageCount = detail.jobs.filter((j) => j.image).length;
  const prevImageCount = useRef(imageCount);
  useEffect(() => {
    if (prevImageCount.current === imageCount) return;
    prevImageCount.current = imageCount;
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

  // 결과 카드(ResultCard)는 같은 잡·핸들러면 다시 그리지 않으므로 핸들러를 고정한다
  const createJobs = useCallback(
    async (body: Omit<ComposerSubmit, "count"> & { count: number }) => {
      const created = await apiFetch<JobsDto>(`/api/conversations/${id}/jobs`, { method: "POST", json: body });
      queryClient.setQueryData<ConversationDetailDto>(queryKeys.conversations.detail(id), (old) =>
        old ? { ...old, jobs: [...old.jobs, ...created.jobs], worker: created.worker } : old,
      );
      // 상세는 위에서 바로 채웠고 진행 중인 잡이 있으면 폴링이 다시 불러오므로 목록만 새로 받는다
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    },
    [id, queryClient],
  );

  async function handleSubmit(d: ComposerSubmit) {
    try {
      await createJobs(d);
      setManualTarget(null);
      setDismissedBatchId(null);
    } catch (e) {
      toast.error(errorMessage(e));
      throw e;
    }
  }

  // 같은 프롬프트·장수·투명 배경·고칠 이미지로 다시 만든다(시드는 새로)
  const handleRegenerate = useCallback(
    async (jobs: JobDto[]) => {
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
        toast.error(errorMessage(e));
      }
    },
    [createJobs],
  );

  const handleCancel = useCallback(
    async (jobId: string) => {
      try {
        await apiFetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      } catch (e) {
        // 이미 끝난 잡(409)은 "이미 끝난 작업이에요." 만 알린다
        toast.error(errorMessage(e));
      } finally {
        void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(id) });
      }
    },
    [id, queryClient],
  );

  const handleEdit = useCallback((img: ImageDto) => setManualTarget(toTarget(img)), []);

  return (
    <>
      <Topbar title={detail.title ?? "대화"} model={model} actions={<ConversationMenu id={id} onDeletingChange={setDeleting} />} />
      <div className="mx-auto flex w-full max-w-205 flex-1 flex-col gap-6 px-4 pt-4 pb-6 sm:px-6">
        {!detail.worker.reachable && <WorkerBanner />}
        <Thread detail={detail} onEdit={handleEdit} onRegenerate={handleRegenerate} onCancel={handleCancel} />
        <div ref={endRef} />
      </div>
      <div className="sticky bottom-0 mx-auto w-full max-w-205 bg-background px-4 pb-4 sm:px-6 sm:pb-6">
        {/* 모델 고정은 상단 자물쇠가, 고칠 이미지는 칩이 알려 준다. 고치기를 못 하는 이유만 여기서 알린다 */}
        <Composer
          model={model}
          mode="chat"
          target={target}
          onTargetChange={handleTargetChange}
          onSubmit={handleSubmit}
          note={spec.canEdit ? undefined : "MOSS-Image 대화는 만들기만 해요. 고치려면 새 대화에서 다른 모델을 고르세요."}
        />
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
