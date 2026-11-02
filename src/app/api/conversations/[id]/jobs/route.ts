import { ApiError, handleRoute, parseJsonBody } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { createJobs, submitJobs } from "@/lib/jobs/create";
import { toJobDto } from "@/lib/jobs/queries";
import { createJobsBodySchema } from "@/lib/jobs/schemas";

// POST /api/conversations/[id]/jobs — 대화에 생성·고치기 요청을 더한다(모델은 대화의 모델)
export const POST = handleRoute("jobs.create", async (req, ctx) => {
  const { id } = await ctx.params;
  const body = await parseJsonBody(req, createJobsBodySchema);
  const jobs = await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.findUnique({ where: { id } });
    if (!conversation) throw new ApiError(404, "conversation_not_found");
    // 사이드바가 최근 대화를 위로 올리도록 updatedAt 을 갱신한다
    await tx.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
    return createJobs(tx, conversation, body);
  });
  const submitted = await submitJobs(jobs);
  return Response.json({ jobs: submitted.jobs.map(toJobDto), worker: submitted.worker }, { status: 201 });
});
