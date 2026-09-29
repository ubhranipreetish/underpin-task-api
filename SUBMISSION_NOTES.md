# Submission notes

## Scope

The submission implements the assignment endpoint, tests every task endpoint, fixes the reproducible defects, and adds CI as the sole optional enhancement. The original assignment brief is unchanged. A health endpoint and Render configuration support the evaluator's live-link requirement. There is no added frontend, database, authentication system, or framework migration.

## Decisions

- **Status vocabulary:** `todo`, `in_progress`, and `done` follow ASSIGNMENT.md and the starter's validators/service. The conflicting README vocabulary was corrected.
- **PUT semantics:** Partial updates remain supported, including an empty-object no-op. Replacing this with strict resource replacement would change existing behavior without a clear requirement.
- **Validation boundary:** HTTP routes validate untrusted input before calling the service. Service functions expect validated values; editable-field filtering and copied results additionally protect identity and store ownership. There is no second, different validation policy inside the service.
- **Assignment:** Names are trimmed but otherwise preserved, including Unicode and internal spaces. Reassignment and assignment of completed tasks are allowed. No user registry or identity claim is implied by a name. Null is not an unassignment operation.
- **Assignment field ownership:** New tasks expose `assignee: null`; only the assignment endpoint can change it. POST/PUT reject it to prevent bypassing assignment validation.
- **Completion lifecycle:** `done` tasks have a completion timestamp. Repeating completion keeps the original time; reopening clears it. POST, PUT, and the completion endpoint share these rules.
- **Dates:** An explicit timezone avoids server-local interpretation. A calendar check rejects impossible dates that JavaScript would otherwise normalize. This deliberately narrows the brief's broad “ISO string” description to a documented format.
- **Pagination:** Filter first, then take a one-based page. Invalid pagination is rejected instead of silently coercing input. The 100-item cap applies when pagination is requested; an unpaginated list remains compatible with the starter.
- **Unknown input:** Unsupported fields and query parameters return 400. This exposes typos and prevents clients from changing server-managed fields. Validation happens before lookup, consistently across PUT and assignment.
- **Store ownership:** Service results are copies. All validated task fields are scalar, so shallow task copies are sufficient. If nested task fields are introduced, this assumption must be revisited.
- **Dependencies:** Express stays on version 4 and Jest on 29. The lockfile was refreshed, Supertest updated to its maintained version, and `uuid` replaced with Node's built-in `crypto.randomUUID()`.

## Test strategy

Service tests isolate business behavior and use a fixed clock for completion and overdue boundaries. Validator tests cover omitted, null, falsy, wrong-type, malformed, and boundary values. Supertest exercises the real Express application and service; only the unexpected-error case injects a service failure to check the 500 response.

Each test resets the in-memory store. HTTP tests confirm subsequent reads, so a correct-looking mutation response is not sufficient to pass. Cross-endpoint cases include assignment followed by completion, invalid creation followed by filtering, status transitions followed by statistics, and deletion followed by completion.

Coverage collects all source files and enforces at least 95% for each metric. The two server-startup statements execute only when launching the application as a process; they remain visible as uncovered instead of being excluded to inflate the report. Startup is checked separately through a real local server.

## What was surprising

The README and assignment disagreed on status names. Small independent defects also compounded: validation accepted `status: null`, after which status filtering could throw. Completion silently changed priority, and the list route made filtering and pagination mutually exclusive. These findings made cross-operation tests especially useful.

## What to test next

1. Persistence and transaction behavior once a database is selected, including competing writes and restart recovery.
2. Authentication, authorization, and tenant isolation once task ownership is defined.
3. More generated date/query cases and mutation testing to assess assertion strength beyond coverage.
4. Load and resource limits against realistic task volumes; the present list and filter operations scan an array.
5. Deployed-service behavior during restarts, cold starts, and failed rollouts.

## Questions before production

- Who can read, change, assign, or delete each task? Is an assignee a display name or a user ID?
- Must tasks survive restarts, and what consistency guarantees are needed across instances?
- Should PUT mean replacement, or should partial updates move to PATCH in a versioned API?
- Should completed tasks be reassignable? Is unassignment required?
- Are due dates precise instants or date-only business deadlines in a user's timezone?
- What are the expected task volume, pagination contract, rate limits, and retention requirements?

The live service is a shared, unauthenticated demo with ephemeral data, matching the assignment's storage scope. Those production questions are documented follow-up work, not claimed capabilities.
