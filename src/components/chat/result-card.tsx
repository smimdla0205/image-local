"use client";

import { cn } from "cn";
import { CopyIcon, DownloadIcon, Maximize2Icon, PencilIcon, RefreshCwIcon, WandSparklesIcon } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { toast } from "sonner";

import { CompareSlider } from "@/components/chat/compare-slider";
import { JobCard } from "@/components/chat/job-card";
import { FadeImage } from "@/components/fade-image";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { getModel, type ModelId } from "@/lib/gpu/models";
import type { ImageDto, JobDto } from "@/lib/jobs/schemas";
import { isActive } from "@/lib/jobs/transitions";

export const FLOAT_CLASS =
  "inline-grid size-8 place-items-center rounded-md bg-overlay text-overlay-foreground transition-colors outline-none hover:bg-secondary hover:text-secondary-foreground focus-visible:shadow-focus-ring max-md:size-11";

type Handlers = { onEdit: (img: ImageDto) => void; onRegenerate: (jobs: JobDto[]) => void; onCancel: (jobId: string) => void };

// 이미지 위 액션: 크게 보기 · 이어서 고치기(MOSS 는 다른 모델로 고치기) · 다운로드
function TileActions({ image, model, onEdit }: { image: ImageDto; model: ModelId; onEdit: Handlers["onEdit"] }) {
  return (
    <div className="hover-actions absolute top-2 right-2 flex gap-1">
      <Link href={`?image=${image.id}`} scroll={false} aria-label="크게 보기" className={FLOAT_CLASS}>
        <Maximize2Icon aria-hidden="true" className="size-4" />
      </Link>
      {getModel(model).canEdit ? (
        <button type="button" aria-label="이어서 고치기" onClick={() => onEdit(image)} className={FLOAT_CLASS}>
          <PencilIcon aria-hidden="true" className="size-4" />
        </button>
      ) : (
        <Link href={`/?edit=${image.id}`} aria-label="다른 모델로 고치기" className={FLOAT_CLASS}>
          <WandSparklesIcon aria-hidden="true" className="size-4" />
        </Link>
      )}
      <a href={image.url} download={`imagen-${image.id}.png`} aria-label="다운로드" className={FLOAT_CLASS}>
        <DownloadIcon aria-hidden="true" className="size-4" />
      </a>
    </div>
  );
}

function ImageTile({ image, model, onEdit }: { image: ImageDto; model: ModelId; onEdit: Handlers["onEdit"] }) {
  return (
    <figure className="image-frame group relative m-0 overflow-hidden rounded-md bg-muted">
      {/* 이미지를 눌러도 크게 본다(키보드는 '크게 보기' 버튼). 이미지를 링크 안에 두어 저장·복사 메뉴와 끌어 놓기는 그대로 된다 */}
      <Link href={`?image=${image.id}`} scroll={false} tabIndex={-1} className="block cursor-zoom-in">
        <FadeImage
          src={image.previewUrl}
          alt={image.prompt ?? ""}
          width={image.width}
          height={image.height}
          loading="lazy"
          decoding="async"
          className={cn("block h-auto w-full", image.hasAlpha && "checker")}
        />
      </Link>
      <TileActions image={image} model={model} onEdit={onEdit} />
    </figure>
  );
}

function DeletedImage() {
  return <div className="grid aspect-square place-items-center rounded-md border border-dashed text-caption text-muted-foreground">삭제한 이미지예요</div>;
}

type ResultCardProps = { jobs: JobDto[]; model: ModelId } & Handlers;

// 폴링마다 대화가 다시 그려져도 잡 객체(캐시가 바뀌지 않은 잡은 그대로)·핸들러가 같으면 이 카드는 다시 그리지 않는다
function sameBatch(a: ResultCardProps, b: ResultCardProps): boolean {
  return (
    a.model === b.model &&
    a.onEdit === b.onEdit &&
    a.onRegenerate === b.onRegenerate &&
    a.onCancel === b.onCancel &&
    a.jobs.length === b.jobs.length &&
    a.jobs.every((j, i) => j === b.jobs[i])
  );
}

// 한 요청(배치)의 결과: 배지, 결과 이미지(고치기 1장은 비교 슬라이더), 진행·실패 카드, 다시 생성·프롬프트 복사
export const ResultCard = memo(function ResultCard({ jobs, model, onEdit, onRegenerate, onCancel }: ResultCardProps) {
  const first = jobs[0];
  const isEdit = first.kind === "EDIT";
  const active = jobs.filter((j) => isActive(j.status));
  const succeeded = jobs.filter((j) => j.status === "SUCCEEDED");
  const others = jobs.filter((j) => j.status !== "SUCCEEDED");
  const images = succeeded.flatMap((j) => (j.image ? [j.image] : []));
  const version = isEdit ? (images[0]?.version ?? (first.inputImage ? first.inputImage.version + 1 : null)) : null;
  // 고친 원본이 남아 있을 때만 비교한다(원본을 지웠으면 결과 한 장만)
  const slider = isEdit && jobs.length === 1 && first.image && first.inputImage && first.image.parentId ? { before: first.inputImage, after: first.image } : null;
  // 고치기의 원본을 지웠으면 같은 요청을 다시 보낼 수 없다
  const canRegenerate = !isEdit || first.inputImage !== null;
  const regenerate = canRegenerate ? () => onRegenerate(jobs) : null;
  const label = active.length
    ? active.some((j) => j.status === "RUNNING")
      ? isEdit
        ? "고치는 중"
        : "생성 중"
      : "대기 중"
    : isEdit
      ? `고친 결과${version ? `, 버전 ${version}` : ""}`
      : `만든 이미지 ${images.length}장`;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(first.prompt);
      toast.success("프롬프트를 복사했어요");
    } catch {
      toast.error("프롬프트를 복사하지 못했어요");
    }
  }

  return (
    <section aria-label={label} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{isEdit ? "이어서 고치기" : "텍스트→이미지"}</Badge>
        <Badge variant="outline" className="tabular-nums">
          {first.steps} step
        </Badge>
        <Badge variant="outline" className="tabular-nums">
          {first.width} × {first.height}
        </Badge>
        {version !== null && (
          <Badge variant="outline" data-testid="version-badge" className="tabular-nums">
            버전 {version}
          </Badge>
        )}
      </div>

      {slider ? (
        <>
          <div className="group relative">
            <CompareSlider before={slider.before} after={slider.after} />
            <TileActions image={slider.after} model={model} onEdit={onEdit} />
          </div>
          <p className="text-caption text-muted-foreground">고치면 요청하지 않은 부분도 조금 바뀔 수 있어요. 마음에 들지 않으면 이전 버전에서 다시 고치세요.</p>
        </>
      ) : (
        succeeded.length > 0 && (
          <div className={cn("grid gap-2", succeeded.length > 1 ? "grid-cols-2" : "max-w-md grid-cols-1")}>
            {succeeded.map((j) => (j.image ? <ImageTile key={j.id} image={j.image} model={model} onEdit={onEdit} /> : <DeletedImage key={j.id} />))}
          </div>
        )
      )}

      {others.map((j) => (
        <JobCard key={j.id} job={j} onCancel={() => onCancel(j.id)} onRegenerate={canRegenerate ? () => onRegenerate([j]) : null} />
      ))}

      {active.length === 0 && succeeded.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {regenerate && (
            <Button type="button" variant="ghost" size="sm" onClick={regenerate} className="max-md:h-11">
              <RefreshCwIcon aria-hidden="true" />
              다시 생성
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={copyPrompt} className="max-md:h-11">
            <CopyIcon aria-hidden="true" />
            프롬프트 복사
          </Button>
          {!getModel(model).canEdit && images[0] && (
            <Link href={`/?edit=${images[0].id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "max-md:h-11")}>
              다른 모델로 고치기
            </Link>
          )}
        </div>
      )}
    </section>
  );
}, sameBatch);
