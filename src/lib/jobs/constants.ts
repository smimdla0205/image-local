// 클라이언트·서버가 같이 쓰는 상수와 순수 함수. zod 를 쓰지 않아 클라이언트 번들에 zod 가 실리지 않는다. 단위 테스트가 불러오므로 import 가 없다

const ALT_MAX = 80;

// 이미지 alt: 프롬프트 앞 80자. 한 요청에 여러 장이면 " (n/N)" 을 붙여 구분한다. 프롬프트가 없으면 올린 사진
export function promptAlt(prompt: string | null, pos?: { n: number; total: number }): string {
  if (!prompt) return "올린 사진";
  const head = Array.from(prompt).slice(0, ALT_MAX).join("");
  return pos && pos.total > 1 ? `${head} (${pos.n}/${pos.total})` : head;
}
