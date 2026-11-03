"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Composer, type ComposerSubmit, type ComposerTarget } from "@/components/chat/composer";
import { ConversationMenu } from "@/components/chat/conversation-menu";
import { DeletedConversation } from "@/components/chat/deleted-conversation";
import { toTarget } from "@/components/chat/target-chip";
import { groupBatches, Thread } from "@/components/chat/thread";
import { PollingLostBanner, WorkerBanner } from "@/components/chat/worker-banner";
import { ImageDeleteDialog } from "@/components/image-delete-dialog";
import { Topbar } from "@/components/shell/topbar";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiClientError, apiFetch, errorMessage } from "@/lib/api-client";
import { getModel, type ModelId } from "@/lib/gpu/models";
import { ratioFromSize } from "@/lib/gpu/sizes";
import { findImage } from "@/lib/jobs/find-image";
import { parseId } from "@/lib/jobs/constants";
import type { ConversationDetailDto, ImageDto, JobDto, JobsDto } from "@/lib/jobs/schemas";
import { isActive } from "@/lib/jobs/transitions";
import { queryKeys } from "@/lib/query-keys";

// 진행 중인 잡이 있을 때 다시 묻는 간격(GET 이 워커와 맞춘다). step 이 나아가는 중이면 1.5초, 대기·0 step 뿐이면 3초
const POLL_MS = 1500;
const QUEUED_POLL_MS = 3000;

function scrollToBottom(): void {
  window.scrollTo({ top: document.documentElement.scrollHeight });
}

// 대화가 사라졌다(다른 탭에서 휴지통으로 갔거나 비워졌다)
function isGone(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 404;
}

function hasActiveJobs(detail: ConversationDetailDto | undefined): boolean {
  return detail?.jobs.some((j) => isActive(j.status)) ?? false;
}

// 활성 잡이 없으면 서버가 그린 상세를 그대로 쓴다(마운트·창 포커스 때 다시 받지 않는다). 무효화나 사용자 동작이 있을 때만 새로 받는다
const IDLE_STALE_MS = 60 * 1000;

export function ConversationView({ id, initialData }: { id: string; initialData: ConversationDetailDto }) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [deleting, setDeleting] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.conversations.detail(id),
    // 진행 중인 잡이 있으면 그 잡만 묻고 합친다. 합친 뒤 진행 중인 잡이 없으면(다 끝남) 다른 곳에서 더한 요청까지 보이게 전체를 한 번 받는다
    queryFn: async ({ queryKey: key }) => {
      const fetchDetail = () => apiFetch<ConversationDetailDto>(`/api/conversations/${id}`);
      const activeIds = queryClient
        .getQueryData<ConversationDetailDto>(key)
        ?.jobs.filter((j) => isActive(j.status))
        .map((j) => j.id);
      // 무효화(이미지 삭제·취소 같은 사용자 동작)로 다시 받을 때는 진행 중인 잡 밖도 바뀌었으니 전체를 받는다
      if (!activeIds?.length || queryClient.getQueryState(key)?.isInvalidated) return fetchDetail();
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
    initialDataUpdatedAt: () => Date.now(),
    staleTime: (q) => (hasActiveJobs(q.state.data) ? 0 : IDLE_STALE_MS),
    refetchOnWindowFocus: (q) => hasActiveJobs(q.state.data),
    enabled: !deleting,
    // 404 는 대화가 사라진 것이라 다시 묻지 않는다. 그 밖의 오류는 잠시 끊긴 것으로 보고 폴링을 이어 간다
    retry: (count, error) => !isGone(error) && count < 3,
    refetchInterval: (q) => {
      if (isGone(q.state.error)) return false;
      const jobs = q.state.data?.jobs ?? [];
      if (!jobs.some((j) => isActive(j.status))) return false;
      // 단계가 실제로 나아갈 때만 짧게 묻는다(대기나 0 step — GPU 가 깨는 동안 — 은 3초)
      return jobs.some((j) => j.status === "RUNNING" && j.step > 0) ? POLL_MS : QUEUED_POLL_MS;
    },
  });
  const detail = query.data;
  const model = detail.model as ModelId;
  const spec = getModel(model);
  const gone = query.isError && isGone(query.error);

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

  // 새 요청이 붙으면 문서 맨 아래로 스크롤한다. 스레드 끝만 맞추면 아래에 붙은 입력창이 마지막 내용을 덮는다
  const jobCount = detail.jobs.length;
  useEffect(() => {
    scrollToBottom();
  }, [jobCount]);

  // 맨 아래(80px 이내)를 보고 있는지. 결과가 나와 아래가 길어질 때 따라 내려갈지 정한다(창 스크롤 구독이라 Effect)
  const atBottom = useRef(true);
  useEffect(() => {
    const onScroll = () => {
      atBottom.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 결과 이미지 수가 바뀌면 사이드바 썸네일·순서를 새로 받고(외부 캐시와 맞추는 일이라 Effect), 맨 아래를 보던 중이면 따라 내려간다. 처음 그릴 때는 하지 않는다
  const imageCount = detail.jobs.filter((j) => j.image).length;
  const prevImageCount = useRef(imageCount);
  useEffect(() => {
    if (prevImageCount.current === imageCount) return;
    prevImageCount.current = imageCount;
    void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    if (atBottom.current) scrollToBottom();
  }, [imageCount, queryClient]);

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
        // 이미 끝난 잡(409)은 "이미 끝난 작업이에요." 만 알린다. 던져서 카드가 '중지하는 중…'을 되돌리게 한다
        toast.error(errorMessage(e));
        throw e;
      } finally {
        void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(id) });
      }
    },
    [id, queryClient],
  );

  const handleEdit = useCallback((img: ImageDto) => setManualTarget(toTarget(img)), []);

  // 이미지 삭제 확인창(공용). 지운 이미지가 고칠 이미지 칩이면 칩을 뺀다(자동 첨부는 남은 결과로 다시 정해진다)
  const [imageToDelete, setImageToDelete] = useState<ImageDto | null>(null);
  const handleDeleteRequest = useCallback((img: ImageDto) => setImageToDelete(img), []);
  function handleDeleted(deletedId: string) {
    setManualTarget((t) => (t?.imageId === deletedId ? null : t));
  }

  return (
    <>
      <Topbar title={detail.title ?? "대화"} model={model} actions={<ConversationMenu id={id} title={detail.title} counts={detail.counts} onDeletingChange={setDeleting} />} />
      <ImageDeleteDialog image={imageToDelete} onOpenChange={(open) => !open && setImageToDelete(null)} onDeleted={handleDeleted} />
      <div className="mx-auto flex w-full max-w-205 flex-1 flex-col gap-6 px-4 pt-4 pb-6 sm:px-6">
        {gone ? (
          <DeletedConversation />
        ) : (
          <>
            {query.isError ? <PollingLostBanner /> : !detail.worker.reachable && <WorkerBanner />}
            <Thread detail={detail} onEdit={handleEdit} onRegenerate={handleRegenerate} onCancel={handleCancel} onDelete={handleDeleteRequest} />
          </>
        )}
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
    <div className="mx-auto flex w-full max-w-205 flex-1 flex-col gap-6 px-4 pt-20 pb-6 sm:px-6" aria-busy="true">
      <span className="sr-only">불러오는 중…</span>
      <Skeleton aria-hidden="true" className="ml-auto h-10 w-2/3" />
      <Skeleton aria-hidden="true" className="aspect-square w-full max-w-md" />
      <Skeleton aria-hidden="true" className="mt-auto h-32" />
    </div>
  );
}
