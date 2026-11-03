import { ApiError, handleRoute, parseJsonBody } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { createJobs, submitJobs } from "@/lib/jobs/create";
import { jobInclude, toJobDto } from "@/lib/jobs/queries";
import { createJobsBodySchema, jobIdsQuerySchema } from "@/lib/jobs/schemas";
import { syncJobs } from "@/lib/jobs/sync";

// GET /api/conversations/[id]/jobs?ids=… — 물은 잡(이 대화의 것만)을 워커와 맞춰 돌려준다. 대화 화면이 진행 중인 잡만 폴링한다
export const GET = handleRoute("jobs.sync", async (req, ctx) => {
  const { id } = await ctx.params;
  const { ids } = jobIdsQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const jobs = await prisma.job.findMany({ where: { conversationId: id, id: { in: ids } }, include: jobInclude });
  // 대화가 있는지는 맞는 잡이 없을 때만 따로 본다(폴링마다 한 번 더 묻지 않게)
  if (jobs.length === 0) {
    const conversation = await prisma.conversation.findUnique({ where: { id }, select: { id: true } });
    if (!conversation) throw new ApiError(404, "conversation_not_found");
  }
  const synced = await syncJobs(jobs);
  return Response.json({ jobs: synced.jobs.map(toJobDto), worker: synced.worker });
});

// POST /api/conversations/[id]/jobs — 대화에 생성·고치기 요청을 더한다(모델은 대화의 모델)
export const POST = handleRoute("jobs.create", async (req, ctx) => {
  const { id } = await ctx.params;
  const body = await parseJsonBody(req, createJobsBodySchema);
  const jobs = await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.findUnique({ where: { id } });
    if (!conversation || conversation.deletedAt) throw new ApiError(404, "conversation_not_found");
    // 사이드바가 최근 대화를 위로 올리도록 updatedAt 을 갱신한다
    await tx.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
    return createJobs(tx, conversation, body);
  });
  const submitted = await submitJobs(jobs);
  return Response.json({ jobs: submitted.jobs.map(toJobDto), worker: submitted.worker }, { status: 201 });
});
