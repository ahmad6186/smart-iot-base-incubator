# AGENTS.md

## Repository expectations
- Prioritize secure, minimal changes.
- Reuse existing approved patterns and libraries already present in the repo.
- Do not broaden scope beyond the task.
- When a change is security-sensitive, explain the risk and the mitigation in the final summary.
- Add or update tests for security-relevant behavior whenever possible.

## Security rules (highest priority)
- Treat security as a release-blocking requirement.
- Never expose, print, log, copy, hardcode, or commit secrets, API keys, tokens, cookies, private certificates, `.env` contents, or customer data.
- Never weaken authentication, authorization, session handling, CSRF, CORS, rate limits, input validation, encryption, or audit logging just to make code “work”.
- Never add debug backdoors, test passwords, bypass flags, admin shortcuts, disabled checks, or temporary insecure fallbacks.
- Do not make network calls, install new packages, modify CI/CD, change infrastructure, or alter security-sensitive configuration unless the task explicitly requires it.
- Prefer the least-privileged and smallest-change solution.
- Reuse existing secure abstractions and approved dependencies instead of inventing new ones.
- For any work touching auth, secrets, payments, persistence, file uploads, deserialization, shell execution, SQL, templates, external requests, or permissions:
  1. identify the main security risk,
  2. implement the safest fix,
  3. add or update tests,
  4. mention any residual risk in the final message.
- If the request conflicts with these rules, stop and explain why instead of proceeding.

## Code change policy
- Preserve backward compatibility unless the task explicitly requires a breaking change.
- Avoid unnecessary refactors in security-sensitive areas.
- Keep diffs small and auditable.
- Prefer explicit validation, safe defaults, and fail-closed behavior.

## Review checklist
- Check for secret exposure.
- Check input validation and output encoding.
- Check auth/authz implications.
- Check logging for sensitive data leaks.
- Check dependency, network, filesystem, and shell-execution impact.
- Check tests.
