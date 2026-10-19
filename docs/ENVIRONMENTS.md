# Environments

## Official Topology

The project currently has only two operational targets:

```text
LOCAL DEV -> PRODUCTION CONTROLLED
```

There is no STAGING environment. The remote Supabase project
`epjshcgsjvrydwuyqixi` is the current controlled production target, even while
the product is still in a limited rollout.

| Target | `VITE_APP_ENV` | Supabase | Allowed data |
| --- | --- | --- | --- |
| Local development | `development` | Local Supabase or local mock | Test data only |
| Controlled production | `production` | `epjshcgsjvrydwuyqixi` | Pilot/real data |

The only approved browser origins for document Edge Functions are
`https://profissionaliza-gestao.pages.dev` and single-label Cloudflare Pages
previews under `*.profissionaliza-gestao.pages.dev`. Unknown or similar domains
are denied. There is no staging origin.

`VITE_APP_ENV` accepts only `development` and `production`. Missing or invalid
values fail the Vite bootstrap/build. Production does not display the DEV
badge.

## Production Safety Rules

- No destructive E2E against production.
- No automated cleanup against production.
- No fixture creation against production.
- No `db reset`, bulk cleanup, `DROP`, `TRUNCATE`, or unscoped `DELETE` against production.
- No automatic use of `E2E_SECRET_KEY` against production.
- Production schema changes use versioned migrations only.
- Production data operations require explicit operator approval.
- The legacy `SUPABASE_SERVICE_ROLE_KEY` is not removed by this phase.
- The active document-function secret is `SUPABASE_SECRET_KEYS.default`.
- Remote secret names were audited read-only; legacy removal still requires human approval.

## Migration Workflow

```text
feature -> local tests -> main -> review -> dry-run -> operator approval -> production db push -> smoke
```

Never move production data through a manual DEV dump. Seeds and fixtures are
local-only unless a separately approved, non-destructive operation says
otherwise.

## Destructive Scripts

Destructive Node scripts call `scripts/lib/assert-safe-target.mjs` before any
Supabase client is created. The guard denies:

- `production` environment;
- the production project ref;
- unknown remote project refs;
- missing environment or URL.

The SQL reset script requires an explicitly local session marker and must be
run against the local database only.

## Data Classification

- **TEST**: local fixtures and generated E2E records.
- **PILOT**: controlled remote records requiring manual classification.
- **REAL**: records belonging to actual users or operations.

Existing remote records are not deleted or reclassified automatically. A
manual inventory and cleanup decision is required before expanding operations.
