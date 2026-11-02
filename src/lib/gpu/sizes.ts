// 비율 프리셋과 이미지 크기 규칙. 모든 변은 16 배수, 각 변 256~2048, 면적 ≤ 1,048,576(워커 상한 1,200,000 안쪽)
// 단위 테스트가 별칭 없이 불러오므로 이 파일은 상대 경로 import 만 쓴다

export const RATIOS = ["1:1", "4:5", "3:4", "16:9", "9:16"] as const;
export type Ratio = (typeof RATIOS)[number];

export const MAX_PIXELS = 1_048_576;
export const DIM_MULTIPLE = 16;
export const MIN_DIM = 256;
export const MAX_DIM = 2048;

export const SIZE_BY_RATIO: Record<Ratio, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "4:5": { width: 912, height: 1136 },
  "3:4": { width: 864, height: 1152 },
  "16:9": { width: 1360, height: 768 },
  "9:16": { width: 768, height: 1360 },
};

// 부동소수 곱셈이 2047.999… 처럼 경계 바로 아래로 떨어져 16 칸 하나를 잃지 않게 더하는 작은 값
const ROUNDING_EPSILON = 1e-9;

// 임의 크기(업로드·고치기 입력)를 규칙 안으로 맞춘다: 1MP·긴 변 2048 을 넘으면 줄이고, 짧은 변이 256 보다 작으면 비율을 지키며 키운다.
// 가로세로가 8:1 을 넘으면 두 조건을 같이 지킬 수 없어 각 변을 256~2048 로 자른다(업로드는 4:1 초과를 미리 거른다)
export function fitToMegapixel(width: number, height: number): { width: number; height: number } {
  const shrink = Math.min(1, Math.sqrt(MAX_PIXELS / (width * height)), MAX_DIM / Math.max(width, height));
  const scale = Math.max(shrink, MIN_DIM / Math.min(width, height));
  const fit = (d: number) => Math.min(MAX_DIM, Math.max(MIN_DIM, Math.floor((d * scale) / DIM_MULTIPLE + ROUNDING_EPSILON) * DIM_MULTIPLE));
  let w = fit(width);
  let h = fit(height);
  // 보정값 때문에 면적이 넘친 경우에만 긴 변을 한 칸씩 줄인다(긴 변은 이때 1024 이상이라 256 아래로 내려가지 않는다)
  while (w * h > MAX_PIXELS) {
    if (w >= h) w -= DIM_MULTIPLE;
    else h -= DIM_MULTIPLE;
  }
  return { width: w, height: h };
}

// 프리셋과 정확히 같은 크기면 그 비율("다시 생성" 이 같은 비율로 만든다), 아니면 null
export function ratioFromSize(width: number, height: number): Ratio | null {
  return RATIOS.find((r) => SIZE_BY_RATIO[r].width === width && SIZE_BY_RATIO[r].height === height) ?? null;
}
