"use client";

import { ArrowUpIcon, PaperclipIcon } from "lucide-react";
import { type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { ComposerOptions, type Count } from "@/components/chat/composer-options";
import { ICON_BUTTON_CLASS } from "@/components/chat/styles";
import { RatioMenu } from "@/components/chat/ratio-menu";
import { StepMeter } from "@/components/chat/step-meter";
import { type ComposerTarget, TargetChip, TargetChipSkeleton, toTarget } from "@/components/chat/target-chip";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { getModel, type ModelId } from "@/lib/gpu/models";
import type { Ratio } from "@/lib/gpu/sizes";
import { type ImageDto, PROMPT_MAX, SEED_MAX } from "@/lib/jobs/schemas";

export type { ComposerTarget };
export type ComposerSubmit = { prompt: string; ratio: Ratio; count: Count; seed?: number; transparent: boolean; inputImageId?: string };

type Props = {
  model: ModelId;
  mode: "new" | "chat";
  target: ComposerTarget | null;
  onTargetChange: (t: ComposerTarget | null) => void;
  // 실패하면 알림을 띄우고 다시 던진다(입력창은 내용을 그대로 둔다)
  onSubmit: (d: ComposerSubmit) => Promise<void>;
  note?: string;
  // 고칠 이미지가 없을 때 칩 자리에 대신 둘 것(받는 중 스켈레톤, 못 찾음 알림)
  targetSlot?: ReactNode;
};

// 시드: 비우면 무작위, 0~SEED_MAX 정수만
function parseSeed(raw: string): { value?: number; invalid: boolean } {
  const s = raw.trim();
  if (!s) return { invalid: false };
  if (!/^\d+$/.test(s)) return { invalid: true };
  const n = Number(s);
  return n <= SEED_MAX ? { value: n, invalid: false } : { invalid: true };
}

function placeholderFor(model: ModelId, mode: Props["mode"], hasTarget: boolean): string {
  if (hasTarget) return "어떻게 고칠지 적어 주세요. 예: 우산을 노란색으로 바꿔 주세요";
  if (model === "moss") return "만들 이미지를 설명해 주세요. 넣을 글자는 따옴표로 감싸고, 태그는 쉼표로 구분해 주세요";
  return mode === "chat" ? "이어서 만들거나 고칠 내용을 적어 주세요" : "만들고 싶은 이미지를 설명해 주세요";
}

export function Composer({ model, mode, target, onTargetChange, onSubmit, note, targetSlot }: Props) {
  const spec = getModel(model);
  const promptId = useId();
  const noteId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<Ratio>("1:1");
  const [count, setCount] = useState<Count>(1);
  const [seed, setSeed] = useState("");
  const [transparent, setTransparent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 모델이 바뀌면 투명 배경을 끈다(렌더 중 조정 — Effect 없이)
  const [prevModel, setPrevModel] = useState(model);
  if (prevModel !== model) {
    setPrevModel(model);
    setTransparent(false);
  }

  const seedState = parseSeed(seed);
  const canSubmit = prompt.trim().length > 0 && !seedState.invalid && !busy && !uploading;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    const submitted = prompt;
    try {
      await onSubmit({
        prompt: submitted.trim(),
        ratio,
        count,
        seed: seedState.value,
        transparent: spec.supportsTransparent && transparent,
        inputImageId: target?.imageId,
      });
      // 보내는 동안 더 쓴 글은 남긴다(보낸 내용 그대로일 때만 비운다)
      setPrompt((current) => (current === submitted ? "" : current));
    } catch {
      // 알림은 onSubmit 이 띄웠다. 다시 보낼 수 있게 입력은 그대로 둔다
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // 한글 조합 중 Enter 는 글자 확정이라 보내지 않는다
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const img = await apiFetch<ImageDto>("/api/uploads", { method: "POST", body });
      onTargetChange(toTarget(img));
    } catch (err) {
      toast.error(errorMessage(err, "사진을 올리지 못했어요. 다시 시도해 주세요."));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        ref={formRef}
        aria-label="이미지 생성"
        onSubmit={handleSubmit}
        className="flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-composer focus-within:shadow-focus-ring"
      >
        {uploading ? <TargetChipSkeleton label="올리는 중…" /> : target ? <TargetChip target={target} onRemove={() => onTargetChange(null)} /> : targetSlot}
        <label htmlFor={promptId} className="sr-only">
          {target ? "어떻게 고칠지" : "프롬프트"}
        </label>
        <textarea
          id={promptId}
          value={prompt}
          rows={2}
          maxLength={PROMPT_MAX}
          placeholder={placeholderFor(model, mode, target !== null)}
          aria-describedby={note ? noteId : undefined}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          className="field-sizing-content block max-h-60 min-h-12 w-full resize-none border-0 bg-transparent px-2 pt-1.5 text-body leading-7 outline-none placeholder:text-muted-foreground"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" tabIndex={-1} aria-hidden="true" className="sr-only" onChange={handleFile} />
          <button
            type="button"
            aria-label={spec.canEdit ? "고칠 사진 올리기" : `${spec.name} 는 사진을 고치지 않아요`}
            disabled={!spec.canEdit || uploading}
            onClick={() => fileRef.current?.click()}
            className={ICON_BUTTON_CLASS}
          >
            <PaperclipIcon aria-hidden="true" className="size-[18px]" />
          </button>
          {target ? <span className="px-1 text-caption text-muted-foreground">원본 비율</span> : <RatioMenu value={ratio} onChange={setRatio} />}
          <ComposerOptions
            count={count}
            onCountChange={setCount}
            transparent={spec.supportsTransparent ? transparent : null}
            onTransparentChange={setTransparent}
            seed={seed}
            seedInvalid={seedState.invalid}
            onSeedChange={setSeed}
          />
          <span className="flex-1" />
          <span data-testid="composer-step-info" className="inline-flex items-center gap-1.5 text-micro whitespace-nowrap text-muted-foreground tabular-nums">
            <StepMeter total={spec.steps} step={0} variant="inline" />
            {spec.steps} step
          </span>
          <button
            type="submit"
            aria-label="생성"
            disabled={!canSubmit}
            className="inline-grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-colors outline-none enabled:hover:bg-primary/80 focus-visible:shadow-focus-ring disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground max-md:size-11"
          >
            {busy ? <Spinner className="size-4" /> : <ArrowUpIcon aria-hidden="true" className="size-[18px]" />}
          </button>
        </div>
      </form>
      {note && (
        <p id={noteId} className="px-1 text-caption text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  );
}
