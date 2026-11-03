import { after } from "next/server";

import { handleRoute, parseJsonBody } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { createJobs, submitJobs, titleFromPrompt } from "@/lib/jobs/create";
import { listConversations, toConversationDetailDto } from "@/lib/jobs/queries";
import { conversationListQuerySchema, createConversationBodySchema } from "@/lib/jobs/schemas";

// POST /api/conversations — 모델을 고르고 첫 요청을 보내면 대화와 잡을 만든다(모델은 이 대화에 고정)
export const POST = handleRoute("conversations.create", async (req) => {
  const body = await parseJsonBody(req, createConversationBodySchema);
  // 검증 실패·상한 초과면 트랜잭션이 되돌아가 빈 대화가 남지 않는다
  const { conversation, jobs } = await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({ data: { title: titleFromPrompt(body.prompt), model: body.model } });
    return { conversation, jobs: await createJobs(tx, conversation, body) };
  });
  // 워커 접수는 응답 뒤에 한다(접수·입력 업로드를 기다리지 않는다). 워커 상태는 다음 동기화(폴링)가 알린다
  after(() => submitJobs(jobs));
  // 막 만든 대화라 이미지·다른 대화의 참조는 없고 잡은 모두 대기 중이다
  const counts = { images: 0, activeJobs: jobs.length, linkedConversations: 0 };
  return Response.json(toConversationDetailDto(conversation, jobs, { reachable: true }, counts), { status: 201 });
});

// GET /api/conversations?limit= — 사이드바 목록(최근 순, 최대 60)
export const GET = handleRoute("conversations.list", async (req) => {
  const { limit } = conversationListQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return Response.json({ items: await listConversations(limit) });
});
