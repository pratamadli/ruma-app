/**
 * Product version shown in the UI.
 * Sourced from `apps/web/package.json` via `next.config.ts` → `NEXT_PUBLIC_APP_VERSION`.
 * Keep root + `@ruma/web` + `@ruma/api` versions in sync (see docs/DEVELOPMENT_WORKFLOW.md).
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '2.1.0';
