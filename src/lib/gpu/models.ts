// 모델 표. 값은 GPU 워커 gpu/worker/models.py 와 같아야 한다(tests/imagen-local/support/model-table.json 으로 양쪽을 비교)
// 단위 테스트가 별칭 없이 불러오므로 이 파일은 상대 경로 import 만 쓴다

export const MODEL_IDS = ["klein", "qwen-turbo", "moss"] as const;
export type ModelId = (typeof MODEL_IDS)[number];

export type ModelSpec = {
  id: ModelId;
  name: string;
  shortName: string;
  description: string;
  // 생성·고치기 step 수(사용자가 바꾸지 않는다). 스텝 미터 칸수와 같다
  steps: number;
  canEdit: boolean;
  supportsTransparent: boolean;
  badges: string[];
  license: { name: string; note: string | null };
};

export const MODELS: readonly ModelSpec[] = [
  {
    id: "klein",
    name: "FLUX 3 Klein",
    shortName: "Klein",
    description: "고른 품질. 만든 이미지를 이어서 고칠 수 있어요.",
    steps: 16,
    canEdit: true,
    supportsTransparent: false,
    badges: ["고치기 가능"],
    license: { name: "FLUX Kommunity License", note: "연 매출 500만 USD 미만이면 상업 이용 무료" },
  },
  {
    id: "qwen-turbo",
    name: "Qwen-Image-2.1-Turbo",
    shortName: "Qwen Turbo",
    description: "정밀하게 고치기와 투명 배경.",
    steps: 8,
    canEdit: true,
    supportsTransparent: true,
    badges: ["고치기 가능", "비상업"],
    license: { name: "Qwen Research License", note: "비상업 연구·평가 한정" },
  },
  {
    id: "moss",
    name: "MOSS-Image",
    shortName: "MOSS",
    description: "긴 글자와 태그 입력. 만들기만 해요.",
    steps: 4,
    canEdit: false,
    supportsTransparent: false,
    badges: ["생성 전용"],
    license: { name: "Apache-2.0", note: null },
  },
];

export function isModelId(x: unknown): x is ModelId {
  return typeof x === "string" && (MODEL_IDS as readonly string[]).includes(x);
}

export function getModel(id: ModelId): ModelSpec {
  const spec = MODELS.find((m) => m.id === id);
  if (!spec) throw new Error(`알 수 없는 모델: ${id}`);
  return spec;
}
