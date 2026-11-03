"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Composer, type ComposerSubmit, type ComposerTarget } from "@/components/chat/composer";
import { ModelPicker } from "@/components/chat/model-picker";
import { TargetChipNotice, TargetChipSkeleton, toTarget } from "@/components/chat/target-chip";
import { Topbar } from "@/components/shell/topbar";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { getModel, type ModelId, MODELS } from "@/lib/gpu/models";
import { parseId } from "@/lib/jobs/constants";
import { useLocationSearch } from "@/lib/location-search";
import type { ConversationDetailDto, ImageDto } from "@/lib/jobs/schemas";
import { queryKeys } from "@/lib/query-keys";

// 모델 표에서 뽑는다: 고치기를 못 하는 모델 id 와, 고칠 이미지가 있을 때 바꿔 보낼 모델(고칠 수 있는 첫 모델)
const NON_EDIT_IDS = MODELS.filter((m) => !m.canEdit).map((m) => m.id);
const EDIT_FALLBACK_ID = MODELS.filter((m) => m.canEdit)[0].id;

// 새 대화: 모델을 고르고 첫 요청을 보내면 대화가 시작된다. ?edit=<id> 는 '다른 모델로 고치기'로 넘어온 고칠 이미지(?image= 는 전역 이미지 뷰어가 쓴다).
// 주소는 useSearchParams 대신 브라우저 location 으로 읽어(서버에서는 빈 값) 제목·모델·입력창이 정적 셸에 들어간다
export function NewChat() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const heroId = useId();
  const linkedId = parseId(new URLSearchParams(useLocationSearch()).get("edit"));

  const [model, setModel] = useState<ModelId>(MODELS[0].id);
  const [manualTarget, setManualTarget] = useState<ComposerTarget | null>(null);
  const [linkedDismissed, setLinkedDismissed] = useState(false);
  const linked = useQuery({
    queryKey: queryKeys.images.detail(linkedId ?? ""),
    queryFn: () => apiFetch<ImageDto>(`/api/images/${linkedId}`),
    enabled: linkedId !== null,
  });
  const target = manualTarget ?? (linked.data && !linkedDismissed ? toTarget(linked.data) : null);
  // 고칠 이미지를 받는 동안·못 찾았을 때 칩 자리에 보일 것(입력창은 target 이 있으면 칩을, 없으면 이 자리를 그린다)
  const linkedSlot =
    linkedId !== null && !linkedDismissed ? (
      linked.isError ? <TargetChipNotice message="고칠 이미지를 찾을 수 없어요" onDismiss={() => setLinkedDismissed(true)} /> : <TargetChipSkeleton label="불러오는 중…" />
    ) : null;
  // 고칠 이미지가 있으면 고칠 수 없는 모델은 고를 수 없다(이미 골랐다면 고칠 수 있는 모델로 보낸다)
  const selected: ModelId = target && !getModel(model).canEdit ? EDIT_FALLBACK_ID : model;

  function handleTargetChange(t: ComposerTarget | null) {
    setManualTarget(t);
    if (t === null) setLinkedDismissed(true);
  }

  async function handleSubmit(d: ComposerSubmit) {
    try {
      const created = await apiFetch<ConversationDetailDto>("/api/conversations", { method: "POST", json: { model: selected, ...d } });
      // 대화 화면이 첫 데이터로 바로 그리고, 사이드바 목록에 새 대화가 보이게 한다
      queryClient.setQueryData(queryKeys.conversations.detail(created.id), created);
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list() });
      router.push(`/c/${created.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
      throw e;
    }
  }

  return (
    <>
      <Topbar title="새 대화" hideTitle />
      <section aria-labelledby={heroId} className="mx-auto flex w-full max-w-205 flex-1 flex-col justify-center gap-6 px-4 pt-10 pb-16 sm:px-6">
        <h2 id={heroId} className="text-center text-display">
          무엇을 만들까요?
        </h2>
        <div className="flex flex-col gap-2">
          <ModelPicker value={selected} onChange={setModel} disabledIds={target ? NON_EDIT_IDS : []} />
          <p className="text-caption text-muted-foreground">모델은 대화를 시작할 때 정해요. 대화 안에서는 바뀌지 않아요.</p>
        </div>
        <Composer model={selected} mode="new" target={target} onTargetChange={handleTargetChange} onSubmit={handleSubmit} targetSlot={linkedSlot} />
      </section>
    </>
  );
}
