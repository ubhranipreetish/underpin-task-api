# Verification results

Verified locally on 2026-09-28. These results describe local runs; hosted GitHub Actions and the public deployment have not run yet.

## Automated tests

- 3 test suites passed; 276 tests passed; no skipped tests or snapshots.
- The suite passed on Node 22 and Node 24.
- A clean `npm ci --ignore-scripts --no-audit --no-fund` followed by `npm run test:ci` passed.
- Node 24 was checked using `npm exec --yes --package=node@24 -- node node_modules/jest/bin/jest.js --ci --coverage --runInBand`.

## Coverage

Collected from every file under `src/`. The final formatted-source report is:

| Metric | Result | CI minimum |
| --- | ---: | ---: |
| statements | 99% | 95% |
| branches | 99.23% | 95% |
| functions | 97.61% | 95% |
| lines | 98.87% | 95% |

Routes, service logic, and validators each have 100% coverage across all four metrics. The remaining uncovered statements and branch are the direct-process startup in `app.js`; they are not excluded from coverage. The startup path was exercised separately below.

## Regression evidence

A temporary copy of starter commit `2b32db7` was tested with the selected current regression cases for exact status matching, pagination, priority preservation, copied completion results, and repeated completion. Of 10 selected cases, 9 failed and 1 passed against the starter. All 10 pass in the final suite. These are test cases, not a count of distinct defects; repeated-completion behavior is a documented contract decision.

The original source and its original lockfile were used for that check. The backup folder was not changed. The broader tests were also run before implementation; failures included the not-yet-implemented feature and newly documented validation rules, so that initial failure count is not presented as a bug count.

## Real-process smoke check

A temporary server launched through `node src/app.js` with `NODE_ENV=production` passed:

1. `GET /health`.
2. Create a high-priority task.
3. Assign it with surrounding whitespace in the name; verify normalization.
4. Complete it; verify priority and assignment survive.
5. Read it through combined status filtering and pagination.
6. Delete it and verify the list is empty.

The test server was stopped afterward.

## Dependency and configuration checks

- `npm audit --json`: zero reported vulnerabilities across production and development dependencies at verification time.
- CI and Render YAML parse successfully; the Node matrix, pinned action references, and deployment root were checked.
- `git diff --check` passed.

## Reproduce

```bash
cd task-api
npm ci
npm run test:ci
```

The complete HTML report is generated at `task-api/coverage/lcov-report/index.html`. CI uploads this report for each Node version; generated coverage files are not committed.

## Publication status

The submission is prepared on branch `submission/tested-task-api`. Publishing awaits the GitHub account and hosting selection. No public live URL or hosted CI result is claimed in this local report.
