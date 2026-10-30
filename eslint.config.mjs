import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Existing Supabase relation payloads are still being typed incrementally.
      // Keep these as warnings so production builds can complete while type safety
      // is improved without changing application behavior.
      "@typescript-eslint/no-explicit-any": "warn",
    },
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];
