import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import pluginQuery from "@tanstack/eslint-plugin-query";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // queryKey 누락·불안정한 QueryClient 같은 React Query 실수를 잡는다
  ...pluginQuery.configs["flat/recommended"],
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // prisma generate 결과물
    "src/generated/**",
  ]),
]);

export default eslintConfig;
