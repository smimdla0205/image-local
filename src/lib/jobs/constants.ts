// 클라이언트·서버가 같이 쓰는 상수와 순수 함수. zod 를 쓰지 않아 클라이언트 번들에 zod 가 실리지 않는다. 단위 테스트가 불러오므로 import 가 없다

export const SEED_MAX = 2_147_483_647;
export const PROMPT_MAX = 4000;

// 쿼리스트링의 id 형식(소문자·숫자). 형식이 다르면 null
export const ID_RE = /^[a-z0-9]+$/;
export function parseId(raw: string | null): string | null {
  return raw && ID_RE.test(raw) ? raw : null;
}

// 대화 상세에 싣는 최근 잡 수(그보다 오래된 잡은 화면에 오르지 않는다). 진행 중 잡 GET 이 한 번에 물을 수 있는 수도 같다
export const DETAIL_JOB_LIMIT = 100;

const ALT_MAX = 80;

// 이미지 alt: 프롬프트 앞 80자. 한 요청에 여러 장이면 " (n/N)" 을 붙여 구분한다. 프롬프트가 없으면 올린 사진
export function promptAlt(prompt: string | null, pos?: { n: number; total: number }): string {
  if (!prompt) return "올린 사진";
  const head = Array.from(prompt).slice(0, ALT_MAX).join("");
  return pos && pos.total > 1 ? `${head} (${pos.n}/${pos.total})` : head;
}
