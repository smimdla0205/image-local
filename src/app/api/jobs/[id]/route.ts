import { ApiError, handleRoute } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { getWorkerClient, isWorkerUnavailable, WorkerError } from "@/lib/gpu/client";
import { jobInclude, toJobDto } from "@/lib/jobs/queries";
import { syncJobs } from "@/lib/jobs/sync";
import { isActive } from "@/lib/jobs/transitions";

const ACTIVE = ["QUEUED", "RUNNING"] as const;

async function findJob(id: string) {
  const job = await prisma.job.findUnique({ where: { id }, include: jobInclude });
  if (!job) throw new ApiError(404, "job_not_found");
  return job;
}

async function cancelInDb(id: string): Promise<void> {
  await prisma.job.updateMany({ where: { id, status: { in: [...ACTIVE] } }, data: { status: "CANCELLED", queuePosition: null } });
}

// GET /api/jobs/[id] — 워커와 맞춘 뒤 잡 하나
export const GET = handleRoute("jobs.get", async (_req, ctx) => {
  const { id } = await ctx.params;
  const { jobs } = await syncJobs([await findJob(id)]);
  return Response.json(toJobDto(jobs[0]));
});

// DELETE /api/jobs/[id] — 대기 중이면 취소, 실행 중이면 중지 요청. 이미 끝난 잡은 409
export const DELETE = handleRoute("jobs.cancel", async (_req, ctx) => {
  const { id } = await ctx.params;
  const job = await findJob(id);
  if (!isActive(job.status)) throw new ApiError(409, "job_finished");

  // 워커에 보낸 적 없는 잡은 워커를 부르지 않고 취소한다(그 사이 제출이 끝났으면 아래에서 워커에 취소를 보낸다)
  const cancelledLocally =
    !job.submittedAt && (await prisma.job.updateMany({ where: { id, status: { in: [...ACTIVE] }, submittedAt: null }, data: { status: "CANCELLED", queuePosition: null } })).count > 0;
  if (!cancelledLocally) {
    const current = await findJob(id);
    if (!isActive(current.status)) throw new ApiError(409, "job_finished");
    try {
      const res = await getWorkerClient().cancelJob(id);
      // cancel_requested 는 워커가 멈춘 뒤 다음 동기화가 CANCELLED 로 바꾼다
      if (res.status === "cancelled") await cancelInDb(id);
    } catch (e) {
      if (e instanceof WorkerError && e.kind === "http" && e.status === 404) {
        await cancelInDb(id);
      } else if (e instanceof WorkerError && e.kind === "http" && e.status === 409) {
        // 워커에서 이미 끝났다. 결과를 반영해 두고 알린다
        await syncJobs([job]);
        throw new ApiError(409, "job_finished");
      } else if (isWorkerUnavailable(e)) {
        throw new ApiError(502, "worker_unreachable");
      } else {
        throw e;
      }
    }
  }
  return Response.json(toJobDto(await findJob(id)));
});
