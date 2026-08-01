import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import pluginSecurity from "eslint-plugin-security";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  pluginSecurity.configs.recommended,
  {
    // The `react-hooks` v6 recommended set bundles React-Compiler-oriented
    // rules that flag correct, intentional patterns in this (non-compiler) app:
    //  - set-state-in-effect: SSR-safe client detection (read localStorage after
    //    mount, then setState) — cannot run during render without hydration bugs.
    //  - purity: render-time relative timestamps (Date.now in a `timeAgo` helper).
    //  - immutability: helpers referenced in an effect before their `const` decl.
    // Keep them visible as warnings (still surfaced in dev) instead of build-
    // breaking errors. All other rules remain errors.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored/generated static assets (e.g. the rnnoise WASM audio worklet) —
    // not app source, and not authored against the Next/TS ruleset.
    "public/**",
    // Standalone Node CommonJS utility scripts (require()/module are correct here).
    "scripts/**",
  ]),
]);

export default eslintConfig;
