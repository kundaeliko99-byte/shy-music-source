import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      ".output/**",
      "android/**",
      "dist/**",
      "node_modules/**",
      "src/routeTree.gen.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: [
      "*.config.{js,mjs,ts}",
      "capacitor.config.ts",
      "scripts/**/*.{js,mjs,cjs}",
      "vite*.ts",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        fetch: "readonly",
      },
    },
  },
  {
    files: ["supabase/functions/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.browser,
        Deno: "readonly",
      },
    },
  },
  prettier,
];
