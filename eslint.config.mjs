import json from "@eslint/json";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: ["dist/**", "types/**", "**/*.js", "**/*.map"],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { "args": "none" }],
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-empty-function": "off",
    },
  },
  {
    ...tseslint.configs.disableTypeChecked,
    files: ["package.json"],
    language: "json/json",
    plugins: { json },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      ...json.configs.recommended.rules,
    },
  },
]);
