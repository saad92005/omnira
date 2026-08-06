// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/target/**",
      "**/src-tauri/target/**",
      // Prisma-generated client (schema.prisma's generator `output`) — same
      // "don't lint generated code" treatment as dist/.
      "apps/api/src/generated/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": [
        "warn",
        { allowExpressions: true }
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }]
    }
  },
  prettierConfig
);
