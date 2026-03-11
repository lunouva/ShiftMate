# Shiftway Sora Ad Pack

## Main concept (24s total, 6x4s clips)
Single narrative:
From scheduling chaos to one operating system for shift teams.

Single CTA:
Start your 14-day free trial at `shiftway.app/signup`.

### Script (spoken narration + on-screen text cues)
1. `0:00-0:04`
Spoken: "Still building schedules in spreadsheets? That chaos costs hours every week."
On-screen: `Shift chaos costs time.`

2. `0:04-0:08`
Spoken: "Shiftway gives every team a dedicated workspace and a live schedule hub."
On-screen: `One workspace. One schedule hub.`

3. `0:08-0:12`
Spoken: "Build the week, publish shifts, and track open coverage in one board."
On-screen: `Build. Publish. Fill open shifts.`

4. `0:12-0:16`
Spoken: "Handle swaps, time-off approvals, and availability in a single flow."
On-screen: `Swaps + Time off + Availability`

5. `0:16-0:20`
Spoken: "Run tasks, messages, invites, and notifications without app-switching."
On-screen: `Tasks. Messages. Invites. Notifications.`

6. `0:20-0:24`
Spoken: "If you back operators, back the platform built for shift operations. Start your 14-day free trial."
On-screen: `Start free trial -> shiftway.app/signup`

### Shot list (6 shots)
1. Hook: messy schedule artifacts morph into clean digital week board.
2. Workspace setup: slug check and workspace URL lock-in.
3. Schedule control: weekly board, publish state, open shifts.
4. Ops flow: swap request, time-off approvals, availability conflict cue.
5. Team execution: tasks, direct messages, invite flow, notification channels.
6. Close: clean product lockup with direct trial CTA.

## Sora files in this folder
- `shiftway-investor-batch.jsonl` - main 6-shot batch prompt set (24s total).
- `shiftway-alt-investor.prompt.txt` - alternate angle A (investor-forward).
- `shiftway-alt-creator.prompt.txt` - alternate angle B (creator/influencer-forward).
- `run-shiftway-sora.ps1` - dry-run and live generation workflow.

## Safe claims grounded in repo evidence
- Real backend and live mode are implemented (Node/Express + Postgres; live default).
  - Evidence: `README.md`
- Signup supports workspace slug checks and workspace URL routing.
  - Evidence: `src/pages/SignupPage.jsx`, `src/lib/subdomain.js`, `server/src/index.js` (`/api/public/check-slug`, `/api/public/signup`)
- Product workflow includes schedule publish, open shifts, swaps, time-off approvals, unavailability, tasks, messages, and invites.
  - Evidence: `src/App.jsx`, `server/src/index.js` (`/api/invite`)
- CSV and payroll exports are present.
  - Evidence: `src/App.jsx`
- Billing/trial flow exists with subscription status and checkout session endpoints.
  - Evidence: `src/pages/PricingPage.jsx`, `server/src/index.js` (`TRIAL_DAYS`, `/api/billing/*`)

## Assumptions (explicit)
- Notification effectiveness depends on SMTP/Twilio/VAPID environment configuration.
- "No credit card required" appears in signup UI copy, but backend can still return checkout URLs depending on config.
- No performance or ROI metrics are claimed in this ad pack because they are not proven in repo artifacts.

