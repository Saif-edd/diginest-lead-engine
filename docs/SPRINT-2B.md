# Sprint 2B: qualitative website analysis

Sprint 2B keeps the certified Sprint 2A crawler and signal rules unchanged. The new qualitative layer is server-only and runs after an objective audit is `COMPLETE`.

## Flow

`OBJECTIVE COMPLETE` → `QUALITATIVE PENDING` → `ANALYZING` → `COMPLETE` or `FAILED`

`POST /api/qualitative` requires the existing Diginest admin authentication and rate limit. It loads only verified lead fields, objective audit fields, structured deterministic evidence, and the private Blob screenshot when available. Screenshot retrieval failures do not create invented visual facts; the model is told that visual evidence is unavailable.

The provider is modular behind `QualitativeProvider`. The default implementation is OpenAI-compatible Chat Completions with JSON mode, but every response is validated by `lib/qualitative/schema.ts` before it can be persisted. Invalid output, provider errors, timeouts, and missing configuration produce a persisted qualitative `FAILED` state.

## Persistence

Qualitative results are persisted in the Turso `qualitative_results` table with a unique idempotency key. The latest validated result is also stored inside the lead audit JSON and the existing `audit_jobs` record. A retry gets a new attempt key; repeating the same key returns the stored result without creating a duplicate result record.

## Qualification and score safety

The model's opportunity gate is recomputed server-side from the eight dimension severities. A website lead can become automatically qualified only when qualitative analysis is complete, the gate passes, and the validated decision is `QUALIFY`. Manual `QUALIFY`, `HOLD`, and `SKIP` decisions continue to take precedence. Preview potential and commercial profile values remain preliminary until the qualitative result supplies reviewed values.

The UI adds qualitative status, a controlled Analyze next/selected action, and a compact result section to the existing Website Audit and Lead detail views. No preview builder or outreach automation is included.

