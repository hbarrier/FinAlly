import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Pre-existing violations in the large client components (transactions,
      // reimbursements). Tracked in the improvement plan (Phase 4.5 — decompose
      // mega-components / extract effect hooks). Restore to "error" once cleared.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
