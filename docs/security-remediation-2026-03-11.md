# Shiftway Security Remediation Tracker (2026-03-11)

Source report: `C:/Users/DELL/Downloads/shiftway-audit.pdf`

| ID | Severity | Finding | Status | Notes |
|---|---|---|---|---|
| 1 | Critical | `/api/state` POST role enforcement | Completed | `requireRole("manager","owner")`, payload validation, size guard |
| 2 | Critical | Manager privilege escalation via `/api/users` | Completed | Role ceiling + ownership checks added |
| 3 | Critical | Magic-link open redirect / token hijack | Completed | Redirect origin allowlist enforcement |
| 4 | Critical | Tenant isolation in `/api/notify` | Completed | Org-scoped recipient queries + mismatch rejection |
| 5 | Critical | Missing billing integration / enforcement | Completed | Billing status, checkout, webhook endpoints + subscription gate middleware |
| 6 | High | Missing public onboarding/signup API | Completed | Added `/api/public/check-slug` and `/api/public/signup` |
| 7 | High | Google OAuth creates generic org | Completed | Org naming + slug derivation updated |
| 8 | High | No migration system | Completed | Added `server/scripts/migrate.js` and `server/migrations/*` |
| 9 | High | In-memory session dependency | Completed | Removed runtime session reliance; signed OAuth state flow |
| 10 | High | No email verification | Completed | Verification token flow + optional login enforcement |
| 11 | High | Missing location ownership validation | Completed | `/api/users` validates location org ownership |
| 12 | High | Invite email sent synchronously | Completed | Invite email moved to background retry path |
| 13 | High | No password reset flow | Completed | Added request/reset endpoints and token storage |
| 14 | High | Missing subdomain/org routing enforcement | Completed | Workspace slug extraction + auth mismatch blocking |
| 15 | Medium | No email retry strategy | Completed | Exponential backoff retry for background email sends |
| 16 | Medium | Debug email endpoint not env-gated | Completed | `DEBUG_EMAIL_LAST_ENABLED` gate added |
| 17 | Medium | Missing DB indexes | Completed | Added indexes in security migration |
| 18 | Medium | No SMTP check in `/api/health` | Completed | SMTP verification included in health response |
| 19 | Medium | Missing startup env validation | Completed | Added startup config validation in server bootstrap |
| 20 | Medium | Long JWT with no refresh | Completed | Short access token + refresh token rotation endpoint |
| 21 | Medium | Native `alert()` usage | Completed | Replaced with non-blocking toast event notifications |
| 22 | Medium | Rollup high vulnerability | Completed | Root lockfile updated to safe Rollup version |
| 23 | Low | No automated tests | Completed | Added `server/tests/state-utils.test.js` and wired server CI to run `npm run test` |
| 24 | Low | No CI workflow in repo | Completed | Added `.github/workflows/ci.yml` |
| 25 | Low | No account deletion / GDPR erase flow | Completed | Added `DELETE /api/me` with password check, last-owner guard, and org-state data erasure |
| 26 | Low | OAuth state CSRF validation missing | Completed | Signed+validated OAuth state token |
| 27 | Low | Missing favicon/meta/OG tags | Completed | Added description/theme/robots plus Open Graph and Twitter tags in `index.html` |
| 28 | Low | Payroll export owner-only gate missing | Completed | UI gate changed to owner-only access |
| 29 | Low | Native confirm dialogs in danger zone | Completed | Replaced all native `confirm()` calls with in-app `ConfirmDialog` modal flow |
