# NPM Security Audit — 2026-08-18

Baseline: current production `main` at `282c2b8311fafd7ef3c98a3a51c968be644c0266`.

This audit was read-only. It ran `npm audit --json` and `npm audit --omit=dev --json`; it did **not** run `npm audit fix`, change `package.json`, or change `package-lock.json`.

## Results

Full dependency graph:
- info: 0
- low: 1
- moderate: 4
- high: 16
- critical: 0
- total: 21

Production-only graph (`--omit=dev`):
- info: 0
- low: 0
- moderate: 0
- high: 4
- critical: 0
- total: 4

Production-only high findings reported by npm:

1. `next` — direct dependency. npm reports a non-major fix available at `16.3.1`.
2. `nanoid` — transitive. npm reports a fix available.
3. `postcss` — transitive through the Next.js dependency graph; npm reports resolution through the Next.js update path.
4. `sharp` — transitive through the Next.js dependency graph; npm reports resolution through the Next.js update path.

The full graph additionally reports high findings in development/build tooling including `@cloudflare/vite-plugin`, `wrangler`, `miniflare`, `vite`, `vinext`, `ws`, `undici`, `image-size`, `js-yaml`, `brace-expansion`, `fast-uri`, and direct `react-server-dom-webpack`; plus moderate/low findings in `drizzle-kit`, `esbuild`, Babel-related tooling, etc.

## Safety rule for remediation

Do not run `npm audit fix` blindly. Remediation must be split into reviewed upgrades, starting with the production runtime graph. For each upgrade:

- inspect the exact advisory and resolved version;
- prefer semver-compatible patch/minor updates when the framework/toolchain supports them;
- run engine tests, migration tests, lint, production build, and Cloudflare build;
- re-run public/browser smoke tests when Next.js/vinext/runtime dependencies change;
- do not combine major `vinext` or `drizzle-kit` migrations with the runtime security update unless unavoidable;
- keep `main` and Production unchanged until the reviewed upgrade branch is green.

## Evidence

Temporary audit workflow run: `32181239264`, job `95854498305`, conclusion `success`.
Artifact: `npm-security-audit-json`, ID `9340848579`, SHA-256 `95e39a6ff1c151b552be69584947065d8f6717a883e5147637a9dc6a901204d3`.

The temporary workflow must not remain in the final branch diff.
