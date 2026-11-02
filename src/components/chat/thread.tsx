"use client";

import { ResultCard } from "@/components/chat/result-card";
import { FadeImage } from "@/components/fade-image";
import type { ModelId } from "@/lib/gpu/models";
import type { ConversationDetailDto, ImageDto, JobDto } from "@/lib/jobs/schemas";

export type Batch = { batchId: string; jobs: JobDto[] };

// 잡을 요청(batchId) 단위로 묶는다. 순서는 잡 순서(오래된 것부터) 그대로
export function groupBatches(jobs: JobDto[]): Batch[] {
  const byId = new Map<string, Batch>();
  for (const job of jobs) {
    const batch = byId.get(job.batchId);
    if (batch) batch.jobs.push(job);
    else byId.set(job.batchId, { batchId: job.batchId, jobs: [job] });
  }
  return [...byId.values()];
}

function UserBubble({ job }: { job: JobDto }) {
  return (
    <div className="flex flex-col items-end gap-2">
      {job.kind === "EDIT" &&
        (job.inputImage ? (
          <figure className="image-frame relative m-0 w-24 overflow-hidden rounded-md bg-muted">
            <FadeImage src={job.inputImage.thumbUrl} alt={`고칠 이미지: 버전 ${job.inputImage.version}`} decoding="async" className="block aspect-square w-full object-cover" />
            <figcaption className="absolute bottom-1 left-1 rounded-sm bg-overlay px-1.5 text-micro text-overlay-foreground">버전 {job.inputImage.version}</figcaption>
          </figure>
        ) : (
          <div className="grid h-24 w-24 place-items-center rounded-md border border-dashed px-2 text-center text-micro text-muted-foreground">삭제한 이미지예요</div>
        ))}
      <p className="max-w-[80%] rounded-lg bg-secondary px-4 py-2.5 whitespace-pre-wrap">{job.prompt}</p>
    </div>
  );
}

type Props = {
  detail: ConversationDetailDto;
  onEdit: (img: ImageDto) => void;
  onRegenerate: (jobs: JobDto[]) => void;
  onCancel: (jobId: string) => void;
};

// 대화 스레드: 요청마다 말풍선 + 결과
export function Thread({ detail, onEdit, onRegenerate, onCancel }: Props) {
  return (
    <div className="flex flex-col gap-8">
      {groupBatches(detail.jobs).map((batch) => (
        <article key={batch.batchId} className="flex flex-col gap-3">
          <UserBubble job={batch.jobs[0]} />
          <ResultCard jobs={batch.jobs} model={detail.model as ModelId} onEdit={onEdit} onRegenerate={onRegenerate} onCancel={onCancel} />
        </article>
      ))}
    </div>
  );
}
