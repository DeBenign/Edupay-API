# EduPay test plan

Work through the parts in order. Parts A to F, H, K, L, M, N, O, P, Q, R, S and T need **no gateway**. Parts G, I and J need real online money and are blocked until Nomba or Paystack works. Tick each box as it passes. Write down anything that does not match the "Expect" column.

## Before you start

- [ ] Backend and frontend start with no errors in either terminal
- [ ] Browser console (F12) is clean on `/`, `/login` and `/register`
- [ ] You are on a **test database** (not production)
- [ ] One-time scripts run if the database is older: `syncFeeIndexes.js`, `backfillReferralCodes.js`, `migrateVirtualAccounts.js`
- [ ] `PLATFORM_ADMIN_EMAILS` holds your real email, and the owner account exists: `node src/scripts/createPlatformAdmin.js "Name" you@email.com "Password"`
- [ ] Email: set the `SMTP_*` variables to test real delivery. With them unset, every email is printed in the backend terminal instead (links included), which is enough for Parts A to O
- [ ] Use a private window per role, or log out between roles

### Test data

| Item | Value |
|---|---|
| School | Test Academy |
| Class | JSS 1 |
| Term fee | ₦20,000, first term, 2026/2027, due date in the future |
| Students | Ade (partial), Bola (early discount), Chidi (overpay), Dayo (hardship) |
| Accounts | 1 platform admin (you), 1 school admin, 1 bursar, 1 parent (parent links Chidi) |

---

## Part A: Setup (admin)

| # | Do | Expect | ✓ |
|---|---|---|---|
| A1 | Register as admin (tick that you read How it works) | Account created; a **Check your email** screen replaces the app | [ ] |
| A1a | Open the verification link from the email (or the backend terminal) | "Email verified"; Continue opens Settings, where you register the school | [ ] |
| A2 | Settings → fill in the school, phone and your position → **Submit for approval** | "Application received" screen (status pending); nothing else opens | [ ] |
| A2a | Platform admin: `/admin/approvals` → open the school → **Approve** (note, tick the call box) | School moves to Approved; the applicant's screen changes to the dashboard within 30 seconds or on **Check status**; school code and personal code appear in Settings | [ ] |
| A3 | Staff → create a bursar and a parent | Both accounts created | [ ] |
| A4 | Fee Structures → create ₦20,000 for JSS 1, then assign to the class | Success message with the number of students | [ ] |
| A5 | Students → enroll Ade, Bola, Chidi, Dayo in JSS 1 | Each enrolls; "Retry provision" shows if no gateway is available (expected) | [ ] |
| A6 | Assign the fee to the class again | "All students already have this fee" | [ ] |
| A7 | Revenue page → save a payout account (10-digit number, bank code, name) | "Payout account saved" | [ ] |

## Part B: Manual payments (bursar)

Log in as the bursar → Students → open a student → **Record Payment**.

| # | Do | Expect | ✓ |
|---|---|---|---|
| B1 | Ade: Cash, receipt `RCPT-001`, ₦10,000 | Status **partial**, balance ₦10,000; the live feed shows it | [ ] |
| B2 | Ade: Cash, receipt `RCPT-002`, ₦10,000 | Status **paid**, balance ₦0 | [ ] |
| B3 | Ade: reuse `RCPT-001` | Rejected (duplicate receipt); no new payment | [ ] |
| B4 | Bola: POS, `RCPT-003`, ₦18,000 (first payment, before the due date) | **paid** with the early discount; ₦2,000 discount shown | [ ] |
| B5 | Chidi: Cash, `RCPT-004`, ₦25,000 | Status **overpaid**, overpayment ₦5,000 | [ ] |
| B6 | Check the payment history of each student | Source shows "manual"; no service charge on any | [ ] |
| B7 | Reports → class breakdown and a student statement | Totals match what you entered | [ ] |
| B8 | Open the bursar dashboard and the admin dashboard | Both load with totals; no "Could not load" error | [ ] |
| B9 | Click **Sync Transactions** on a student with only a Paystack account | A note says there is nothing to sync; no error | [ ] |

## Part C: Parent views

Log in as the parent → My Children → link Chidi (student ID + school ID).

| # | Do | Expect | ✓ |
|---|---|---|---|
| C1 | Open the dashboard | Chidi shows paid ₦20,000 and a purple overpayment card for ₦5,000 | [ ] |
| C2 | Before Chidi's payment, check a child with a balance | "Balance to pay at the school", no account numbers | [ ] |
| C3 | Payment History | The ₦25,000 payment is listed | [ ] |
| C4 | Notifications | A payment notification exists | [ ] |

## Part D: Overpayments

| # | Do | Expect | ✓ |
|---|---|---|---|
| D1 | Admin: create a second-term fee for JSS 1 (same session) | Fee structure created | [ ] |
| D2 | Parent: Chidi's overpayment → **Credit to next term** | Second-term fee for Chidi shows ₦15,000 | [ ] |
| D3 | Bursar: record another ₦25,000 for Chidi against the second term (or any new overpayment) | Overpaid again | [ ] |
| D4 | Parent: choose **Refund** | Card shows "Refund requested" | [ ] |
| D5 | Admin: Overpayments → **Approve refund** | "Marked as refunded. Return the cash to the parent yourself." | [ ] |
| D6 | Parent: credit to next term when no next-term fee exists | A clear error telling you to choose refund | [ ] |

## Part E: Fee tools (admin)

| # | Do | Expect | ✓ |
|---|---|---|---|
| E1 | Students → **+ Fee** on Ade: Uniform ₦5,000 | New open fee for Ade | [ ] |
| E2 | Bursar records ₦5,000 for Ade | Uniform paid; **no** early discount applied to it | [ ] |
| E3 | Students → View Dayo → **Adjust** the fee to ₦12,000 with a reason | Balance ₦12,000; reason saved | [ ] |
| E3a | The `auditlogs` collection | A `fee_adjust` record with who, old and new amount, amount already paid and the reason | [ ] |
| E3b | As the **bursar**: open a student with an unpaid fee → **Adjust** to a lower amount with a reason | Works; an audit record names the bursar | [ ] |
| E3c | As the bursar: try to raise a fee | "Bursars can only reduce a fee" | [ ] |
| E4 | Adjust without a reason, or with a reason under 5 characters | Rejected | [ ] |
| E5 | Adjust below what was already paid | Student becomes overpaid | [ ] |
| E6 | Students → **Promote class**: JSS 1 to JSS 2, **Preview only** | List of students; nothing changes | [ ] |
| E7 | Confirm the promotion | Students move to JSS 2; old fees stay on their accounts | [ ] |
| E8 | Students → **Import** → **Download template**, add 5 students (one with a bad gender, one reusing an existing Student ID), save as `.csv` | Template downloads with the 5 headers | [ ] |
| E9 | Choose the file | Preview shows 5 in file, 3 ready, 2 with problems, each listed with its row number and reason; nothing is saved yet | [ ] |
| E10 | Click **Import 3 students** | Toast: 3 enrolled, 2 skipped; the table shows the 3 new students; the 2 bad rows are not there | [ ] |
| E11 | Watch the Virtual Account column for a minute | Accounts appear one by one, a few seconds apart; a failed one shows the retry button | [ ] |
| E12 | Repeat E9 with the same file | All rows now report "already enrolled"; Import is disabled | [ ] |
| E13 | Import the same data as an `.xlsx` with headers `Name, Admission No, Class, Sex, DOB` and a real Excel date column | Headers are recognised; dates match the cells; `M`/`F` are accepted | [ ] |
| E14 | Upload a file without a `gender` column; then a file with more than 500 rows; then a `.xls` or `.pdf` | A clear message each time; nothing is sent or saved | [ ] |

## Part F: Revenue and withdrawals (manual only)

| # | Do | Expect | ✓ |
|---|---|---|---|
| F1 | Admin: Revenue page | Cash recorded shows your manual total; **Available to withdraw ₦0** | [ ] |
| F2 | Try to withdraw ₦1,000 | Rejected: exceeds available revenue | [ ] |
| F3 | Bursar: open the Revenue page | Cards visible, no payout or withdrawal forms | [ ] |

## Part G: Referrals (needs online money)

| # | Do | Expect | ✓ |
|---|---|---|---|
| G1 | Register a second admin, verify the email, create "Second School" with the first school's code, and approve it in `/admin/approvals` | Referral created (pending) | [ ] |
| G2 | Record **manual** payments for the second school | **No** reward is created (cash never counts) | [ ] |
| G3 | After online payments earn ₦2,000 of margin for the platform | The referring school gets 30 days of waived service charges | [ ] |
| G4 | Referring a person: use a personal code | After the unlock, a ₦1,000 reward appears under Referral Rewards | [ ] |
| G5 | Claim it as airtime (VTpass sandbox) | "Airtime sent" or "being processed" | [ ] |
| G6 | Self-referral: create a school using your own code | No referral is created | [ ] |

## Part H: Subscription (platform admin)

| # | Do | Expect | ✓ |
|---|---|---|---|
| H1 | Admin: Settings | Subscription card: free pilot with an end date, price shown as students × ₦300, minimum ₦30,000 | [ ] |
| H2 | Platform admin: open `/admin/subscriptions` | Every school with status and student count | [ ] |
| H3 | Record the amount due (at least ₦30,000) with a bank reference for a school | Status "active"; period extended by one term | [ ] |
| H4 | Reuse the same reference | Rejected | [ ] |
| H5 | A non-platform admin opens `/admin/subscriptions` | "Platform admin only" | [ ] |
| H6 | Look for a way to declare a student count in Settings | None exists; the card says billing is automatic | [ ] |
| H7 | With 50 active students | Billed ₦30,000: the minimum applies | [ ] |
| H8 | Import 120 students (the bulk-import template) | Billed ₦36,000 (120 × ₦300) | [ ] |
| H9 | Deactivate 30 students | Still billed ₦36,000: the peak count since the last payment is used | [ ] |
| H10 | Platform admin records the payment | The next term's bill is based on the 90 students active now | [ ] |
| H11 | `GET /api/revenue/schools` as the platform admin | 404 (the route is gone); the Subscriptions page shows status and student counts only, never revenue | [ ] |

## Part M: Subscription lock (needs no gateway)

Use a test school, never a real customer. The dates are set from the backend folder with `node src/scripts/setPilotEnd.js "<school name>" [--days-ago N] [--restore] --yes` (without `--yes` it only shows what would change). The server caches lock status for up to a minute, so wait a minute or restart the backend after changing dates.

| # | Do | Expect | ✓ |
|---|---|---|---|
| M1 | Run the script with `--days-ago 3 --yes` | School is in its grace period: the banner says overdue and gives the date new work pauses; everything still works | [ ] |
| M2 | Run it with `--yes` (10 days ago) | School is **LOCKED** | [ ] |
| M3 | As the admin, try to enroll a student, import a file, create a fee structure, assign a fee, create a bursar, and (as the bursar) record a cash payment | Each is refused with the message "Your EduPay subscription ended on …", the amount due and the bank details | [ ] |
| M4 | Still locked: open Students, Reports, a student's detail, Overpayments, Revenue, Settings | All load normally | [ ] |
| M5 | Still locked: edit a student, adjust an existing fee, deactivate a student, approve a refund, use Sync Transactions | All still work | [ ] |
| M6 | Still locked: a parent logs in, views the balance and (with a gateway) transfers into the student's account | The parent side works and the payment reconciles | [ ] |
| M7 | Locked school's Settings page and banner | Both explain the lock and show the amount and where to pay | [ ] |
| M8 | Platform admin: Subscriptions page | The school shows **LOCKED** with an Extend button | [ ] |
| M9 | Click Extend, give 3 days and a reason | School shows "extended to …"; M3 actions work again; after the extension ends it locks again | [ ] |
| M10 | Run the script with `--yes` again, then record a payment of the amount due | The school reopens at once, without waiting a minute; the banner disappears | [ ] |
| M11 | Extend with no reason, with 0 days, and with 31 days | Each is refused | [ ] |
| M12 | A non-platform admin calls `POST /api/subscriptions/schools/<id>/extend` | 403 | [ ] |
| M13 | The platform admin's own login on a locked school | Never blocked | [ ] |
| M14 | Run the script with `--restore --yes` | Pilot ends in 120 days again; school is open | [ ] |

---

## Part I: Online payments (when a gateway works)

| # | Do | Expect | ✓ |
|---|---|---|---|
| I1 | Run `node scripts/nombaCheck.js` | One host prints OK; set `.env` accordingly | [ ] |
| I2 | Nomba dashboard → Developer → Webhook Setup: set the URL, signature key and `payment_success` | Matches `NOMBA_WEBHOOK_SECRET` | [ ] |
| I3 | Students → **+ Nomba** on a student | An account number appears | [ ] |
| I4 | ₦1,000 fee: the parent sees "₦1,015 (incl. ₦15 service charge)" | Matches the README table | [ ] |
| I5 | Transfer ₦1,015 from your bank app | Log shows `[EXACT] … Fee: ₦15`; the student is **paid** within seconds | [ ] |
| I6 | Check the Payment record | `platformFee` 15, `netAmountForSchool` 1000, `gatewayFee` filled | [ ] |
| I7 | Transfer ₦500 | **partial** | [ ] |
| I8 | Transfer more than owed | **overpaid** | [ ] |
| I9 | Replay the same webhook | "Already processed"; no duplicate | [ ] |
| I10 | Send an unsigned POST to `/api/webhooks/nomba` | **401**; a rejected-webhook record is stored | [ ] |

## Part J: Withdrawal (online money)

| # | Do | Expect | ✓ |
|---|---|---|---|
| J1 | Revenue page shows online money as available | Available matches online net minus withdrawals | [ ] |
| J2 | Withdraw less than available | Created as "processing"; goes to the saved payout account | [ ] |
| J3 | Click Withdraw twice quickly for the full balance | Only one succeeds | [ ] |
| J4 | Withdraw more than available | Rejected | [ ] |

## Part K: Security checks

| # | Do | Expect | ✓ |
|---|---|---|---|
| K1 | As a parent, call `GET /api/revenue/schools/<schoolId>` | 403 | [ ] |
| K1a | As the platform admin (not that school's staff), call the same URL and `GET /api/withdrawals/schools/<schoolId>` | 403 on both: EduPay cannot see a school's revenue or withdrawals | [ ] |
| K2 | As the bursar, request a withdrawal | 403 | [ ] |
| K3 | As an admin of another school, open a student's account endpoint | 403 | [ ] |
| K4 | As a parent, open another family's child | 403 | [ ] |
| K5 | Log in with the password you registered with | Works (the password is hashed once) | [ ] |
| K6 | Reload the site with a deliberately broken page | The error screen shows, not a blank page | [ ] |

---

## Part L: School people (admin)

Log in as the admin → **People** in the sidebar. Create a second school with its own admin, bursar and parent so you can check isolation.

| # | Do | Expect | ✓ |
|---|---|---|---|
| L1 | Open the **Bursars** tab | Only this school's bursars, with name, phone, email and status; no password or token anywhere | [ ] |
| L2 | Open the **Parents** tab | This school's parents, each with their linked children and classes | [ ] |
| L3 | Search by name, then email, then phone | The list filters each time | [ ] |
| L4 | Deactivate a bursar (confirm the prompt) | Status becomes Inactive; that bursar can no longer log in ("Account deactivated") | [ ] |
| L5 | Reactivate the same bursar | Status Active; login works again | [ ] |
| L6 | Reset a bursar's password | A temporary password is shown once; the old password stops working and the temporary one logs in | [ ] |
| L6a | Log in as that bursar with the temporary password | A "Choose a new password" screen replaces the app; no dashboard, no sidebar | [ ] |
| L6b | Try to reuse the temporary password as the new one; then use two different new passwords | Rejected; then "Save and continue" opens the bursar dashboard | [ ] |
| L6c | While on the change-password screen, call `GET /api/students` with the bursar's token | 403 with code `PASSWORD_CHANGE_REQUIRED` | [ ] |
| L6d | Reset the bursar again while they are already logged in elsewhere, then click anything there | That session is sent to the change-password screen | [ ] |
| L7 | Look for a reset or deactivate button on a parent row | Parents have Deactivate/Reactivate only; no password reset | [ ] |
| L8 | Log in as the **second school's** admin and open People | None of the first school's bursars or parents appear | [ ] |
| L9 | As the second admin, call `PATCH /api/school-people/<first school's bursar id>/deactivate` | 404; nothing changes | [ ] |
| L10 | As a bursar or parent, call `GET /api/school-people/bursars` | 403 | [ ] |
| L11 | Check the `auditlogs` collection | One record per deactivate, reactivate and reset, with actor, school and target | [ ] |

---

## Part N: School approval

Use a fresh school applicant for each row group. Decisions are made by the platform admin on `/admin/approvals`.

| # | Do | Expect | ✓ |
|---|---|---|---|
| N1 | New applicant submits a school (after verifying email) | Status pending; the owner's Pending tab shows it with applicant, position, phones, address; no student counts or money anywhere on the screen | [ ] |
| N2 | While pending, as that admin call `GET /api/students`, `POST /api/students`, `POST /api/withdrawals` | 403 with code `SCHOOL_PENDING` | [ ] |
| N3 | While pending, `GET /api/auth/me`, `GET /api/schools/me`, `PATCH` the school's name, change password | All work | [ ] |
| N4 | While pending, try to save a payout bank account | Refused: payout details are added after approval | [ ] |
| N5 | Owner: **Ask for more information** with a question | Applicant's screen shows your message and an edit form; every other API is still 403 (`SCHOOL_NEEDS_INFO`) | [ ] |
| N6 | Applicant edits details → **Save and resubmit** | Back in the owner's Pending tab; history shows the resubmission | [ ] |
| N7 | Owner: **Approve** without ticking the call box, then with a one-word note | Both refused | [ ] |
| N8 | Owner: **Approve** properly | Applicant gets the dashboard; pilot now ends 120 days from today (Settings card) | [ ] |
| N9 | Owner: try to approve the same school again | Refused (an approved school cannot be approved) | [ ] |
| N10 | A second applicant: owner **Rejects** with a reason | Applicant sees the reason; every API 403 (`SCHOOL_REJECTED`); no resubmit button | [ ] |
| N11 | Owner: **Suspend** an approved school with a reason | Within 15 seconds its admin and bursars get 403 (`SCHOOL_SUSPENDED`); a parent can still pay and the payment still reconciles | [ ] |
| N12 | Owner: **Reinstate** it | Access returns; the pilot end date did not change | [ ] |
| N13 | A school created before approvals existed (no approval record) | Works normally and shows under the Approved tab | [ ] |
| N14 | The platform admin's own login on a suspended school | Never blocked | [ ] |
| N15 | A non-platform admin opens `/admin/approvals` or calls `POST /api/schools/<id>/approve` | "Platform admin only" / 403 | [ ] |
| N16 | `auditlogs` | One record per approve, reject, request-info, suspend, reinstate and resubmit, with actor and school | [ ] |

## Part O: Sign-up and email verification

| # | Do | Expect | ✓ |
|---|---|---|---|
| O1 | Register choices | Only "Register a school" and "I'm a parent"; no bursar option | [ ] |
| O2 | `POST /api/auth/register` with `role: "bursar"`, then with the platform admin's email, a 5-character password, and an admin without `acceptedTerms` | 400, 403, 400, 400; nothing is created | [ ] |
| O3 | Register a parent | **Check your email** screen; the email arrives (or prints in the terminal) | [ ] |
| O4 | While unverified, `GET /api/children` or `POST /api/students` | 403 with code `EMAIL_NOT_VERIFIED` | [ ] |
| O5 | While unverified, `GET /api/auth/me` and `PATCH /api/auth/change-password` | Both work | [ ] |
| O6 | Click **Resend email**, then again straight away | First sends; then a countdown (60 seconds) and a 429 from the API | [ ] |
| O7 | Open the **old** link after a resend | "Link not valid" (each resend replaces the previous link) | [ ] |
| O8 | Open the newest link | "Email verified"; Continue opens the app; the gate screen (if open in another tab) clears within 15 seconds | [ ] |
| O9 | Open the same link a second time | "Link not valid": it works once | [ ] |
| O10 | Edit the token in the link, or open `/verify-email` with no token | "Link not valid" | [ ] |
| O11 | In the database, look at the user | Only a hash of the token is stored (64 hex characters that do not match the link) | [ ] |
| O12 | Set the token's `emailVerifyExpires` to the past, then open the link | "Link not valid" | [ ] |
| O13 | An account that existed before this feature, and a bursar created by an admin | Neither is asked to verify | [ ] |
| O14 | Turn the mail server off (wrong `SMTP_PASS`), then register | Sign-up still succeeds; **Resend email** shows an error | [ ] |

## Part P: Email notifications and reminders

With SMTP unset, read each message in the backend terminal instead of an inbox.

| # | Do | Expect | ✓ |
|---|---|---|---|
| P1 | Applicant submits a school | Applicant gets "We received your application"; the owner (`PLATFORM_ADMIN_EMAILS`) gets "New school application" with a link to `/admin/approvals` | [ ] |
| P2 | Owner approves | Applicant gets "Your school is approved" with the pilot end date; **the internal verification note is nowhere in it** | [ ] |
| P3 | Owner rejects, asks for more information, suspends, reinstates | Applicant gets the matching email with your reason or question | [ ] |
| P4 | Applicant resubmits | The owner gets "Updated school application" | [ ] |
| P5 | Name a school `<b>Test</b>` and give a reason containing `<script>` | Both appear as plain text in the email, never as markup | [ ] |
| P6 | Platform admin records a subscription payment | School admins get "Payment received" with the new end date | [ ] |
| P7 | Set a test school's pilot to end in 5 days (`setPilotEnd.js`), then run the daily job: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:5000/api/cron/reminders` | School admin gets "Your subscription ends in 5 days" with the amount due and where to pay | [ ] |
| P8 | Run the same command again | No second email (each reminder is sent once) | [ ] |
| P9 | Set the pilot to end tomorrow; then 2 days ago (grace); then 9 days ago (locked) and run the job each time | "Ends tomorrow", then "Has ended", then "Your school is paused"; a school locked 30 days ago gets nothing | [ ] |
| P10 | Extend access for a school, then run the job | No reminder while the extension lasts | [ ] |
| P11 | Run the job while SMTP is broken, fix SMTP, run it again | The reminder is sent on the second run (failures are not recorded as sent) | [ ] |
| P12 | Break SMTP, then approve or reject a school | The decision still saves; only the email is missing; the backend log shows the failure | [ ] |

## Part Q: Hosting on Vercel

| # | Do | Expect | ✓ |
|---|---|---|---|
| Q1 | `GET <backend>/health` | OK | [ ] |
| Q2 | `GET <backend>/api/cron/sync` with no header, and with a wrong token | 401 both times | [ ] |
| Q3 | Same URL with `Authorization: Bearer <CRON_SECRET>` | 200 with `"job":"sync"` | [ ] |
| Q4 | Same for `/api/cron/reminders` and `/api/cron/vtu` | 200 each | [ ] |
| Q5 | Vercel dashboard → Cron Jobs | Three jobs listed; run one by hand and check its log | [ ] |
| Q6 | Send a signed Nomba or Paystack test webhook to the Vercel URL | Accepted and reconciled (the raw body is intact); an unsigned one gets 401 | [ ] |
| Q6a | Send a signed test webhook and watch the Vercel function log | "processed" appears **before** the response is sent; the payment is recorded and the parent's receipt is sent | [ ] |
| Q6b | Make the database slow or unavailable, then send a signed test webhook | Still answers 200 (the failure is logged and the event stays replayable in the webhook logs) | [ ] |
| Q6c | Bulk-import 10 students on Vercel | Reply says provisioning is `scheduled`; after calling `/api/cron/provision` with the bearer token, the students have account numbers (call again for the rest) | [ ] |
| Q6d | Call `/api/cron/emails` with the token | 200 with counts of sent, retrying and failed emails | [ ] |
| Q7 | Frontend with `VITE_DISABLE_SOCKET=true` | No websocket errors in the console; pages load data on refresh | [ ] |
| Q8 | Click through login, a dashboard and a payment on the deployed site | No CORS errors: `CLIENT_URL` matches the frontend URL exactly | [ ] |

---

## Part R: Forgot password

| # | Do | Expect | ✓ |
|---|---|---|---|
| R1 | Open the sign-in page | A **Forgot password?** link sits beside the password field | [ ] |
| R2 | Ask for a reset with an email nobody registered | The same "If an account exists..." message as a real one; no email is sent | [ ] |
| R3 | Ask with your real email | "Reset your EduPay password" arrives (or prints in the terminal) with a link to `/reset-password?token=...` | [ ] |
| R4 | Ask again straight away | Same message on screen; no second email within the first minute | [ ] |
| R5 | Open the link; try mismatched passwords, then a 5-character password | Both refused; the link still works afterwards (a typo does not use it up) | [ ] |
| R6 | Choose a good new password | "Password updated"; signing in with the new password works, the old one is refused | [ ] |
| R7 | Check your inbox | "Your EduPay password was changed" arrives | [ ] |
| R8 | Open the same link again | "Invalid, already used or expired" | [ ] |
| R9 | Ask for two links in a row (wait a minute between), use the **older** one | Refused: a new request replaces the previous link | [ ] |
| R10 | Sign in on two browsers, reset the password, then click anything in the old sessions | Both are signed out ("Your password was changed. Please sign in again") | [ ] |
| R11 | Set `passwordResetExpires` to the past, then open the link | Refused | [ ] |
| R12 | In the database, look at the user | Only a hash of the token (64 hex characters that do not match the link) | [ ] |
| R13 | Ask for a reset on a deactivated account | Same message on screen; no email | [ ] |
| R14 | Reset the password of an account that never verified its email | Afterwards it is verified: no **Check your email** screen | [ ] |
| R15 | Reset the password of a bursar who was forced to change it | No longer asked to change it again | [ ] |
| R16 | Send 11 reset attempts within 15 minutes | The 11th gets 429 "Too many attempts" | [ ] |
| R17 | The platform admin resets their own password | Works, and the owner stays unblocked everywhere | [ ] |

---

## Part S: Email is down

Simulate it with a wrong `SMTP_PASS`, or with no `SMTP_*` set at all.

| # | Do | Expect | ✓ |
|---|---|---|---|
| S1 | Sign up a new school admin | Sign-up works; the **Check your email** screen appears; Resend shows an error or "not configured" | [ ] |
| S2 | As the owner, open **Approvals** | A red banner says email is not configured or failing; **Waiting for email** shows a count of 1 | [ ] |
| S3 | Open the **Waiting for email** tab | The new admin is listed with email, phone and sign-up date; a **School admins / Parents** switch is shown | [ ] |
| S4 | Open them, then try to save with an empty or 3-character reason | Refused | [ ] |
| S5 | Phone the person, then enter a real reason and **Mark email verified** | "Email marked as verified"; they leave the list | [ ] |
| S6 | On the applicant's screen (no refresh needed) | Within 15 seconds the **Check your email** screen is replaced by the school form | [ ] |
| S7 | `auditlogs` | One `email_verify_manual` record with your id, their email and your reason | [ ] |
| S8 | Try the same user again (curl `POST /api/schools/signups/<userId>/verify-email`), and the owner's own account | 400: it does not need verification | [ ] |
| S9 | As a non-owner, call `GET /api/schools/signups/unverified` | 403 | [ ] |
| S10 | Manually verify the school admin, submit the school, then try **Approve** without the call box ticked | Refused: email status never replaces the call | [ ] |
| S11 | Approve properly while email is still down | Approved; the applicant sees the dashboard on screen; the "approved" email is queued (check `emailoutboxes`) | [ ] |
| S12 | Fix SMTP, then call `/api/cron/emails` with the token | The queued email is delivered; its record is `sent` | [ ] |
| S13 | Leave a queued email failing (keep SMTP broken) and call `/api/cron/emails` five times (move `nextAttemptAt` back each time) | After the fifth failure the record is `failed` and is no longer retried | [ ] |
| S14 | Make SMTP hang (wrong host that does not answer) and record a cash payment | The payment is recorded and the page answers within a few seconds, not tens of seconds | [ ] |

## Part T: Parent emails

The parent must be linked to the child and have a verified email.

| # | Do | Expect | ✓ |
|---|---|---|---|
| T1 | Record a cash payment for the child as the bursar | The parent gets "Payment received for <child>": amount, applied to the fee, balance, reference; no service charge line | [ ] |
| T2 | Pay by bank transfer (or send a signed test webhook) | Receipt shows the amount transferred, the service charge, the amount applied to the fee, and that the school receives the full fee | [ ] |
| T3 | Pay the exact balance | Receipt says the fee is now fully paid | [ ] |
| T4 | Pay more than the balance | Receipt says how much extra was received and to choose a refund or credit in the app | [ ] |
| T5 | Send the same webhook twice | One payment, one receipt (duplicates are ignored) | [ ] |
| T6 | A parent whose email is unverified, a deactivated parent, and a child with no linked parent | No receipt is sent to any of them; the payment still works | [ ] |
| T7 | A second parent, linked to a different child, in the same school | Gets nothing about this child | [ ] |
| T8 | Name a student `<b>Kid</b>` | The receipt shows it as plain text, not markup | [ ] |
| T9 | Set a fee's due date to 3 days from now (unpaid), run `/api/cron/reminders` | The parent gets "Fee due in 3 days for <child>" with the balance and due date, in addition to the in-app notification | [ ] |
| T10 | Repeat with a due date tomorrow | "Fee due tomorrow" | [ ] |
| T11 | Pay the fee in full, run the job again | No reminder for a paid fee | [ ] |
| T12 | Break SMTP, record a payment, then fix SMTP and call `/api/cron/emails` | The payment is recorded at once; the receipt arrives after the retry | [ ] |

---

## Result

| Part | Passed | Failed | Notes |
|---|---|---|---|
| A Setup | | | |
| B Manual payments | | | |
| C Parent views | | | |
| D Overpayments | | | |
| E Fee tools | | | |
| F Revenue | | | |
| G Referrals | | | |
| H Subscription | | | |
| I Online payments | | | |
| J Withdrawal | | | |
| K Security | | | |
| L School people | | | |
| M Subscription lock | | | |
| N School approval | | | |
| O Sign-up and email verification | | | |
| P Email notifications and reminders | | | |
| Q Hosting on Vercel | | | |
| R Forgot password | | | |
| S Email is down | | | |
| T Parent emails | | | |