# Task Manager API — The Untested API

- **Live API:** https://underpin-task-api-perw.onrender.com/
- **GitHub:** https://github.com/ubhranipreetish/underpin-task-api
- **CI:** [Passing verification run](https://github.com/ubhranipreetish/underpin-task-api/actions/runs/36621235314)

A tested Express API for creating, updating, completing, and assigning tasks. The submission keeps the starter's in-memory architecture and adds regression coverage, fixes for the identified defects, and automated CI.

- [Original assignment](ASSIGNMENT.md)
- [Bug report and regression evidence](BUG_REPORT.md)
- [Design decisions and submission notes](SUBMISSION_NOTES.md)
- [Verification and coverage](TEST_RESULTS.md)

## Run locally

Use Node.js 22 or 24. The repository's `.nvmrc` selects Node 22.

```bash
cd task-api
npm ci
npm start
```

The API listens on `http://localhost:3000`. Set `PORT` to override it.

```bash
npm test
npm run coverage
npm run test:ci
```

The CI command runs all tests and fails if statements, branches, functions, or lines fall below 95% coverage. HTML coverage is written to `task-api/coverage/lcov-report/index.html`.

## API

Request bodies use `Content-Type: application/json`. Successful list responses are arrays; errors use `{ "error": "message" }`.

| Method | Path | Success | Behavior |
| --- | --- | --- | --- |
| GET | `/` | 200 | Service information and available endpoints |
| GET | `/health` | 200 | Health check for the hosting platform |
| GET | `/tasks` | 200 | Tasks in insertion order; optional filtering and pagination |
| GET | `/tasks/stats` | 200 | Counts by status and overdue count |
| POST | `/tasks` | 201 | Create a task |
| PUT | `/tasks/:id` | 200 | Update supplied editable fields |
| DELETE | `/tasks/:id` | 204 | Delete a task; empty response body |
| PATCH | `/tasks/:id/complete` | 200 | Complete a task and preserve its other fields |
| PATCH | `/tasks/:id/assign` | 200 | Assign or reassign a task |

Mutations of a missing task return 404. Invalid input returns 400. Malformed JSON returns 400, oversized JSON returns 413, and unsupported JSON charsets return 415. Unexpected server errors return a generic 500 response.

### Task representation

```json
{
  "id": "c14482ca-98d3-4d47-b1ef-2b29d7898d9e",
  "title": "Review the API",
  "description": "Check the assignment workflow",
  "status": "todo",
  "priority": "high",
  "dueDate": "2026-12-01T17:30:00+05:30",
  "assignee": null,
  "completedAt": null,
  "createdAt": "2026-09-28T10:00:00.000Z"
}
```

| Field | Rules |
| --- | --- |
| `title` | Required on creation; non-blank string. Original whitespace is preserved. |
| `description` | String; defaults to `""`. |
| `status` | `todo`, `in_progress`, or `done`; defaults to `todo`. |
| `priority` | `low`, `medium`, or `high`; defaults to `medium`. |
| `dueDate` | `null` or a valid ISO date-time with seconds and an explicit timezone; defaults to `null`. |
| `assignee` | `null` initially; set through the assignment endpoint. |
| `id`, `createdAt`, `completedAt` | Managed by the server. |

Unknown body fields are rejected. Only `title`, `description`, `status`, `priority`, and `dueDate` may be supplied to POST or PUT. Assignment accepts only `assignee`.

Dates accept `YYYY-MM-DDTHH:mm:ssZ` or a numeric timezone offset such as `+05:30`, with optional 1–3 fractional second digits. Impossible dates, timezone-less dates, date-only strings, and non-string values are rejected. `null` clears a due date.

### Filtering and pagination

```text
GET /tasks?status=todo&page=1&limit=10
```

- Status matching is exact. Invalid statuses return 400.
- Pages start at 1. Supplying either pagination parameter enables pagination; omitted `page` defaults to 1 and omitted `limit` to 10.
- Both must be positive integer strings; `limit` is capped at 100.
- Filtering is applied before pagination. A page beyond the last result returns `[]`.
- Without pagination parameters, all matching tasks are returned.
- Unknown, repeated, nested, fractional, negative, and malformed query values are rejected.

### Assignment

```bash
curl -X PATCH http://localhost:3000/tasks/TASK_ID/assign \
  -H 'Content-Type: application/json' \
  -d '{"assignee":"Preeti"}'
```

The endpoint trims surrounding whitespace and stores a non-empty name. It supports Unicode names and reassignment. Assigning the same name again leaves the task unchanged. Completed tasks may also be reassigned. Missing, blank, null, and non-string names return 400. Unassignment is outside this brief.

Validation precedes task lookup, so an invalid assignment to a missing ID returns 400; valid input for a missing ID returns 404.

### Completion and updates

`PUT` preserves the starter's merge behavior: omitted fields remain unchanged, and `{}` is a no-op. The original README described full replacement, but the implementation and update validator allowed partial updates; that compatibility is retained and documented.

Entering `done` sets `completedAt`. Repeated completion preserves that timestamp. Reopening a task clears it; completing the reopened task records a new time. These rules also apply to creation and status changes through PUT. Completion preserves priority and assignment.

An overdue task has a due date strictly before now and is not `done`. A date exactly equal to now is not overdue.

## Quick review

Create a task, copy its returned `id`, then assign and complete it:

```bash
curl -X POST http://localhost:3000/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Review submission","priority":"high"}'

curl -X PATCH http://localhost:3000/tasks/TASK_ID/assign \
  -H 'Content-Type: application/json' \
  -d '{"assignee":"Preeti"}'

curl -X PATCH http://localhost:3000/tasks/TASK_ID/complete
curl 'http://localhost:3000/tasks?status=done&page=1&limit=10'
curl http://localhost:3000/tasks/stats
```

The completed task should retain `priority: "high"` and `assignee: "Preeti"`.

## CI

[API checks](.github/workflows/ci.yml) runs on pushes, pull requests, and manual dispatch. It tests Node 22 and 24, installs from the lockfile, enforces coverage, writes a coverage summary, and uploads reports retained for 14 days. Actions are pinned to commit SHAs and the workflow has read-only repository permissions.

## Hosting

[render.yaml](render.yaml) defines one free Render web service. Connect the submission repository through **New → Blueprint**, choose the submission branch, and deploy. Alternatively, create a Node web service with:

| Setting | Value |
| --- | --- |
| Root directory | `task-api` |
| Build command | `npm ci --omit=dev --ignore-scripts` |
| Start command | `npm start` |
| Node version | `22` |
| Health check | `/health` |

The Blueprint configures subsequent automatic deployments to wait for passing CI checks. After deployment, check `/health`, then run the quick-review requests against the assigned HTTPS URL.

**This is an in-memory demonstration.** Data is shared between visitors and disappears on restart, redeployment, or instance replacement. Run one instance. A free Render service can idle, so its first request may take time to wake it. See [Render's free-service limits](https://render.com/docs/free).

## Structure

```text
.github/workflows/ci.yml       Automated test and coverage checks
render.yaml                    Hosting configuration
BUG_REPORT.md                  Defects, reproduction, root causes, and fixes
SUBMISSION_NOTES.md             Decisions, tradeoffs, and follow-up questions
TEST_RESULTS.md                 Recorded validation and coverage
task-api/
   src/app.js                  Express setup and error handling
   src/routes/tasks.js         HTTP routes
   src/services/taskService.js In-memory task operations
   src/utils/validators.js     Body and query validation
   tests/                      Unit and HTTP integration tests
```
