# Bug report

Baseline: starter commit `2b32db7`. Source locations below link to the corrected functions; each entry describes the original behavior and the regression that now guards it. Tests were drafted and run against the starter before implementation. Findings that depend on a clarified contract are identified separately from direct defects.

## B01 — First-page pagination skips records

- **Location:** [getPaginated](task-api/src/services/taskService.js).
- **Reproduction:** Create A, B, C, D; request `/tasks?page=1&limit=2`.
- **Expected / actual:** A, B / C, D.
- **Cause:** The offset was `page * limit` even though API pages start at 1.
- **Discovery:** Service pagination cases and the HTTP pagination test.
- **Fix:** `(page - 1) * limit`; cover first, middle, short final, and out-of-range pages.
- **Regression:** `page %i with limit %i returns %j` in `taskService.test.js` and `uses one-based pages...` in the integration suite.

## B02 — Status filtering accepts substrings

- **Location:** [getByStatus](task-api/src/services/taskService.js).
- **Reproduction:** Create a `done` task, then call `getByStatus('do')`.
- **Expected / actual:** No exact match / the `done` task is returned.
- **Cause:** String `.includes()` was used instead of equality.
- **Discovery:** An exact-match service test using a partial status.
- **Fix:** Compare complete status values. The route additionally rejects unsupported query statuses with 400.
- **Regression:** `matches the entire status, never a substring` and invalid query integration cases.

## B03 — Completing a task overwrites its priority

- **Location:** [completeTask](task-api/src/services/taskService.js).
- **Reproduction:** Create a high-priority task, then complete it.
- **Expected / actual:** Priority stays `high` / priority becomes `medium`.
- **Cause:** Completion hard-coded `priority: 'medium'` into the replacement object.
- **Discovery:** Completion tests for low, medium, and high priorities.
- **Fix:** Reuse the status-update path and preserve unrelated fields.
- **Regression:** `completion preserves %s priority...` plus assignment → completion → list integration coverage.

## B04 — Filtering silently disables pagination

- **Location:** [GET /tasks handler](task-api/src/routes/tasks.js).
- **Reproduction:** Create multiple todo tasks; request `/tasks?status=todo&page=1&limit=1`.
- **Expected / actual:** One matching task / every matching task.
- **Cause:** The filter branch returned before pagination was considered.
- **Discovery:** A combined filter/page integration test. The README itself shows these parameters together.
- **Fix:** Validate the query, filter, then paginate that result.
- **Regression:** `filters before paginating` and `paginates the filtered set`.

## B05 — Falsy enum values bypass validation and corrupt later reads

- **Location:** [create/update validators](task-api/src/utils/validators.js).
- **Reproduction:** POST `{ "title": "Task", "status": null }`, then GET `/tasks?status=todo`.
- **Expected / actual:** Reject creation with 400 / creation succeeds and the later filter can throw.
- **Cause:** Truthiness checks skipped validation for null, false, zero, and empty strings. Destructuring defaults apply only to undefined, so invalid values were stored. Priority had the same validation hole.
- **Discovery:** Table-driven enum tests and a create-then-filter integration case.
- **Fix:** Check whether a field is present and validate every supplied value.
- **Regression:** Invalid enum validator cases and `invalid status cannot poison later filtered requests`.

## B06 — Update requests overwrite identity and timestamps

- **Location:** [update](task-api/src/services/taskService.js) and [validateUpdateTask](task-api/src/utils/validators.js).
- **Reproduction:** PUT `{ "id": "changed", "createdAt": "fake" }` to an existing task.
- **Expected / actual:** Reject server-owned fields / silently replace the ID and creation time.
- **Cause:** The validator ignored unknown fields and the service spread the entire request into the task.
- **Discovery:** Tests attempting to change identity, timestamps, and arbitrary fields.
- **Fix:** Reject unsupported request fields and independently allowlist editable fields in the service.
- **Regression:** `does not accept identity, timestamps, assignment, or arbitrary fields...` and invalid PUT cases.

## B07 — Description and date values violate the documented task shape

- **Location:** [validators](task-api/src/utils/validators.js).
- **Reproduction:** Create tasks with `description: {}`, `dueDate: false`, `dueDate: 123`, or `dueDate: "2026-02-30T10:00:00Z"`.
- **Expected / actual:** Reject invalid types or impossible dates / accept them.
- **Cause:** Description was unchecked; falsy dates bypassed checks; `Date.parse` coerces values and normalizes some impossible dates.
- **Discovery:** Validator tables for wrong types, leap years, invalid calendar dates, and timezone forms.
- **Fix:** Check types and calendar validity. The exact accepted timestamp format is a documented contract decision.
- **Regression:** Description/date validator cases and invalid POST/PUT integration cases.

## B08 — Malformed pagination is coerced into successful requests

- **Location:** [list query parsing](task-api/src/routes/tasks.js).
- **Reproduction:** Request `page=1abc`, `page=-1`, or `limit=0`.
- **Expected / actual:** Reject invalid pagination / accept a truncated number, a negative page, or silently substitute a default.
- **Cause:** `parseInt(value) || default` conflated malformed, zero, and omitted inputs.
- **Discovery:** Query validator and HTTP boundary cases.
- **Fix:** Accept positive safe-integer strings; use defaults only for omitted values. A maximum limit of 100 is an explicit design choice.
- **Regression:** Invalid page/limit tables, repeated/nested query cases, and default-pagination tests.

## B09 — Request parsing errors become server errors

- **Location:** [application error handler](task-api/src/app.js).
- **Reproduction:** POST malformed JSON such as `{"title":` or a body larger than the parser limit.
- **Expected / actual:** 400 or 413 / 500 for either.
- **Cause:** The final error handler replaced every error status with 500.
- **Discovery:** HTTP tests against Express's real JSON parser.
- **Fix:** Return stable JSON errors for malformed and oversized bodies, preserve other client-error statuses, and conceal unexpected server-error details.
- **Regression:** Malformed JSON, oversized body, unsupported charset, and injected unexpected-error cases.

## Contract decisions and smaller hardening fixes

### Completion timestamps

Creating/updating directly to `done` left `completedAt` null; reopening retained a stale timestamp; repeated completion overwrote the first timestamp. The brief did not define the lifecycle, so this is reported as a clarified invariant rather than an unambiguous specification violation. The adopted behavior is documented in the README and verified using a fixed clock in `status updates set, preserve, clear, and renew completion timestamps`.

### Mutable service results

`getAll()` copied the array but shared task objects; create, lookup, and filtered results also exposed stored objects. Mutating a returned object could change the store without an update operation. Scalar task copies now isolate reads and mutation responses. This is service-boundary hardening, not a claim that HTTP JSON responses shared server memory.

### Documentation and dependencies

The README's status names contradicted ASSIGNMENT.md and the implementation. The README now uses the assignment's vocabulary. The starter's dependency audit also reported advisories; the lockfile was refreshed within Express 4/Jest 29, Supertest updated, and the external UUID dependency removed in favor of Node's built-in generator. Audit results are recorded in TEST_RESULTS.md.
