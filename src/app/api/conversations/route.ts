import { handleRoute, parseJsonBody } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { createJobs, submitJobs, titleFromPrompt } from "@/lib/jobs/create";
import { listConversations, toConversationDetailDto } from "@/lib/jobs/queries";
import { conversationListQuerySchema, createConversationBodySchema } from "@/lib/jobs/schemas";
import { isActive } from "@/lib/jobs/transitions";

// POST /api/conversations — 모델을 고르고 첫 요청을 보내면 대화와 잡을 만든다(모델은 이 대화에 고정)
export const POST = handleRoute("conversations.create", async (req) => {
  const body = await parseJsonBody(req, createConversationBodySchema);
  // 검증 실패·상한 초과면 트랜잭션이 되돌아가 빈 대화가 남지 않는다
  const { conversation, jobs } = await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({ data: { title: titleFromPrompt(body.prompt), model: body.model } });
    return { conversation, jobs: await createJobs(tx, conversation, body) };
  });
  const submitted = await submitJobs(jobs);
  // 막 만든 대화라 이미지·다른 대화의 참조는 없다
  const counts = { images: 0, activeJobs: submitted.jobs.filter((j) => isActive(j.status)).length, linkedConversations: 0 };
  return Response.json(toConversationDetailDto(conversation, submitted.jobs, submitted.worker, counts), { status: 201 });
});

// GET /api/conversations?limit= — 사이드바 목록(최근 순, 최대 60)
export const GET = handleRoute("conversations.list", async (req) => {
  const { limit } = conversationListQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return Response.json({ items: await listConversations(limit) });
});
