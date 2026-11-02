// 대화 상세에 실린 이미지(결과·고칠 원본)에서 id 로 찾는다. 대화 화면의 ?target= 과 뷰어가 쓴다
import type { ConversationDetailDto, ImageDto } from "./schemas";

export function findImage(detail: ConversationDetailDto, id: string): ImageDto | null {
  for (const j of detail.jobs) {
    if (j.image?.id === id) return j.image;
    if (j.inputImage?.id === id) return j.inputImage;
  }
  return null;
}
