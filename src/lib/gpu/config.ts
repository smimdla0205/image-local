import { z } from "zod";

// 빌릴 GPU 종류와 개수. .env 의 GPU_TYPE, GPU_COUNT 로 정하고, 없거나 비어 있으면 H100 1대다
const gpuEnv = z
  .object({
    GPU_TYPE: z.string().default("H100"),
    GPU_COUNT: z.coerce.number().int().positive().default(1),
  })
  .parse({
    GPU_TYPE: process.env.GPU_TYPE || undefined,
    GPU_COUNT: process.env.GPU_COUNT || undefined,
  });

export const gpuConfig = {
  type: gpuEnv.GPU_TYPE,
  count: gpuEnv.GPU_COUNT,
};
