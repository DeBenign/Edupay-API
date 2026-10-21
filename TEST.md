# EduPay test plan

Work through the parts in order. Parts A to F, H, K and L need **no gateway**. Parts G, I and J need real online money and are blocked until Nomba or Paystack works. Tick each box as it passes. Write down anything that does not match the "Expect" column.

## Before you start

- [ ] Backend and frontend start with no errors in either terminal
- [ ] Browser console (F12) is clean on `/`, `/login` and `/register`
- [ ] You are on a **test database** (not production)
- [ ] One-time scripts run if the database is older: `syncFeeIndexes.js`, `backfillReferralCodes.js`, `migrateVirtualAccounts.js`
- [ ] Use a private window per role, or log out between roles

### Test data

| Item | Value |
|---|---|
| School | Test Academy |
| Class | JSS 1 |
| Term fee | ₦20,000, first term, 2026/2027, due date in the future |
| Students | Ade (partial), Bola (early discount), Chidi (overpay), Dayo (hardship) |
| Accounts | 1 admin, 1 bursar, 1 parent (parent links Chidi) |

---

## Part A: Setup (admin)

| # | Do | Expect | ✓ |
|---|---|---|---|
| A1 | Register as admin | Account created, you land on the admin dashboard | [ ] |
| A2 | Settings → create the school | School created; school code and your personal code appear | [ ] |
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
| E4 | Adjust without a reason | Rejected | [ ] |
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
| G1 | Register a second admin and create "Second School" with the first school's code | Referral created (pending) | [ ] |
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
| H6 | Declare 50 students in Settings (fewer than 100 enrolled) | Billed ₦30,000: the minimum applies | [ ] |
| H7 | Declare 200 students | Billed ₦60,000 (200 × ₦300) | [ ] |
| H8 | Declare fewer students than are enrolled | Billed on the enrolled count, not the declared one | [ ] |

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