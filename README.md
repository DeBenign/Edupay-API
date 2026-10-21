# EduPay

**School fee payment infrastructure for Nigerian schools.**

Every student gets a clear balance that every dashboard agrees on. Fees are collected two ways: **online**, into dedicated virtual bank accounts that reconcile themselves, or **manually**, recorded by the bursar when a parent pays at the school. Either way, the admin, the bursar and the parent all see the same numbers.

---

## The problem

School fee collection in Nigeria still runs on shared bank accounts, paper receipts and manual reconciliation. A bursar has to guess, from names and amounts, which parent paid for which child. Underpayments go unnoticed until a term is underway. Overpayments sit unresolved. Parents cannot check a balance without calling the school.

## What EduPay does

- **One source of truth for fees.** Fee structures per class, term and session; each student has a balance that updates with every payment.
- **Two ways money arrives.**
  - *Online:* each student can hold dedicated accounts on **Nomba** and **Paystack**. A transfer into one identifies the student automatically and reconciles in seconds.
  - *Manual:* the bursar records cash, cheque, POS or a transfer to the school's own account against a receipt number. It reconciles through the same engine.
- **Every payment is classified:** ✅ exact, ⚠️ underpayment (balance tracked), 🔁 overpayment (the parent chooses a refund or a credit toward next term).
- **Real-time dashboards** for admins, bursars and parents, each scoped to what they need.

---

## Who it's for

- **School administrators** who need collection visibility without building finance software.
- **Bursars** reconciling by hand against bank alerts and receipt books.
- **Parents** who want their child's balance, and what to pay, without calling the school.

---

## Flow of operation

### 1. Setup (admin, once)

```
Register as admin → create the school (optional referral code)
   → save the payout bank account (Revenue page)
   → create the bursar and parent accounts (Staff)
   → declare how many students the school has (Settings), which sets the subscription price
   → create a fee structure per class / term / session → assign it to the class
   → enroll students one by one, or import a CSV / Excel list (online accounts are provisioned automatically when the gateways are available)
```

### 2. Money arrives: two paths into one engine

**Path A: online (parents transfer to the student's account)**

```
Parent sees: "Transfer ₦10,254" (₦10,000 fee + ₦254 service charge) and the account numbers
   │
Parent pays from any bank
   │
Gateway webhook → signature verified (rejected if invalid)
   │
Engine: skip if already processed → find the student by account number
   → take the service charge from the amount received
   → credit the rest to the OLDEST open fee
   → apply the early-payment rule → classify exact / under / over
   → save payment + balance together → notify → push live update
   → record the gateway's own fee → check referral rewards
```

**Path B: manual (parent pays at the school)**

```
Parent pays the school: cash, cheque, POS, or a transfer to the school's own account
   │
Bursar opens the student → Record Payment (method + unique receipt number + amount)
   │
Same engine: oldest open fee first → early-payment rule → exact / under / over
   → NO service charge (no gateway touched the money)
   → NOT counted as withdrawable (the school already holds the money)
   → NO referral conversion
   │
Balances update on the admin, bursar and parent dashboards and in the live feed
```

### 3. What each role sees and does

| Role | Does | Sees |
|---|---|---|
| **Admin** | Setup, fees, one-off fees, hardship adjustments, class promotion, overpayment refunds, payout account, withdrawals, manage the school's bursars and parents (People) | Collection totals, students, overpayments, revenue, subscription status, referral codes, the bursars and parents of their own school |
| **Bursar** | Records manual payments, monitors the live feed, reads reports, handles overpayments | Student statements, class breakdown, balances, revenue (view only) |
| **Parent** | Links a child, reads balances, pays online or at the school, resolves overpayments, claims referral rewards | Balance and progress, the exact amount to transfer, any early-payment offer, payment history |
| **Platform admin** | Records subscription payments, reviews schools and referrals | Every school's status and student count |

### 4. Overpayments

```
Payment exceeds the fee → status "overpaid"
   → the parent chooses: refund to the paying account, or credit to next term
   → credit: reduces next term's fee (needs next term's fee structure to exist)
   → refund: the school approves it on the Overpayments page
        online payment → sent back through the gateway
        cash payment   → marked refunded; the school returns the cash itself
```

### 5. Withdrawals

```
Available = online money the school earned − withdrawals − overpayments owed back
   (cash payments never count: that cash was never in the gateway wallet)
Admin requests a withdrawal → it goes ONLY to the saved payout account
   → concurrent requests cannot overdraw
   → the request stays "processing" until the transfer is confirmed
```

---

## Money rules

### Service charge (online payments only)

Added on top of the school fee and paid by the parent, so the school always receives its full fee.

| Component | Value |
|---|---|
| Rate | 1.5% of the amount transferred |
| Flat fee | ₦100 (waived for transfers of ₦2,500 or less) |
| Cap | ₦2,000 per transfer |

| School fee | Parent transfers | Service charge | School receives |
|---|---|---|---|
| ₦1,000 | ₦1,015 | ₦15 | ₦1,000 |
| ₦10,000 | ₦10,254 | ₦254 | ₦10,000 |
| ₦100,000 | ₦101,624 | ₦1,624 | ₦100,000 |

The charge is calculated on each transfer as it arrives, so instalments follow the same rule. EduPay records the gateway's own fee on every payment, so platform revenue is reported gross and net.

### Early-payment discount

A first payment, made on or before the due date, that covers at least 90% (but less than 100%) of a term fee settles that fee in full. The school absorbs the difference. One-off fees never qualify.

### Manual payments

No service charge, no referral conversion, not withdrawable. Each needs a unique receipt number, which also blocks double entry.

---

## How EduPay earns

- **Service charge margin** on online payments (service charge minus the gateway's fee).
- **Subscription** per school per term, recorded by the platform admin. Price = students × ₦300, **never below ₦30,000 per term**. Students billed = the higher of the count the school declared and the number actually enrolled. New schools get a free pilot of 120 days. Schools see a banner as it ends. Nothing is locked.
  - The ₦30,000 minimum is the starting price. It will be raised as more schools join, and schools will be told in advance by email and on their dashboard before any increase takes effect (planned, see Roadmap).
- **Referral rewards** are paid only from real online margin (see below), so they never cost more than they earn.

### Referral program

| Referrer | Reward |
|---|---|
| A school | 30 days of waived service charges (stacks, capped 90 days ahead) |
| An admin, bursar or parent | ₦1,000 as airtime or a data plan, claimed from their own dashboard |

- A reward unlocks when the referred school has earned the platform ₦2,000 of real net margin from online payments. Cash entries never count.
- At most 5 rewards per referrer per 30 days.
- Self-referrals are blocked: same school, the referrer works at the referred school, the same payout bank, or the same phone number.
- Purchases are retry-proof: every attempt has its own provider request ID, and a timed-out attempt is re-checked, never re-bought.

---

## School administration

- **Fee structures** per class, term and session, assigned to a class or one student.
- **One-off fees** (uniform, excursion) added to a single student.
- **Hardship adjustments:** an admin can reduce one student's fee. A written reason is required and kept as an audit note.
- **Class promotion** with a preview first; graduating a class deactivates its students. Old fee records stay on each account.
- **Bulk import:** upload a `.csv` or `.xlsx` list of up to 500 students (columns `fullName, studentId, class, gender`, optional `dateOfBirth`; a template can be downloaded). A preview lists every problem row (missing field, bad gender or date, duplicate or already-enrolled Student ID) and saves nothing until the admin confirms; problem rows are skipped, the rest are imported in one step. Virtual accounts are then created in the background, one student at a time a few seconds apart so the gateways are not rate-limited; any that fail show the existing retry button.
- **People:** an admin can see the bursars and parents of their own school (name, phone, email, status, and each parent's linked children), search them, deactivate or reactivate an account, and reset a bursar's password. A reset issues a one-time temporary password; the existing password can never be read. The bursar must replace it on next login: until they do, the API rejects every call except loading their profile and changing the password. Bursars and parents of other schools are never visible, and password hashes, tokens and link codes are never returned. Deactivation and password resets are recorded in an audit log.

---

## Architecture

**Backend:** Node.js, Express, MongoDB, Redis, Socket.io
**Frontend:** React, Vite, Tailwind CSS
**Payments:** Nomba and Paystack in parallel; **Airtime and data rewards:** VTpass

```
backend/src/
├── models/        User, School, Student, FeeStructure, FeeAssignment, Payment, Withdrawal,
│                  Referral, ReferralReward, SubscriptionPayment, WebhookLog, AuditLog
├── controllers/   auth, school, student, fee, payment, webhook, report, notification, parent,
│                  referral, revenue, withdrawal, subscription, schoolPeople
├── services/      reconciliation, bulkEnroll, virtualAccount, paymentInstructions, platformFee,
│                  earlyPaymentDiscount, fee, revenue, withdrawal, referral, vtu,
│                  nomba, paystack (+ mappers), transaction (hourly sync)
├── middleware/    auth, roles, platform admin, webhook signature verification
└── routes/, sockets/, jobs/

frontend/src/
├── pages/         Home, auth, admin, bursar, parent, shared (referral rewards)
└── components/, context/, api/
```

### Webhooks

| Gateway | Event handled | Verification |
|---|---|---|
| Nomba | `payment_success` where the transaction type is `vact_transfer` | HMAC-SHA256 over the documented field string plus `nomba-timestamp`, keyed with the signature key from the Nomba dashboard |
| Paystack | `charge.success` | HMAC-SHA512 over the raw body, keyed with the secret key |

Requests that fail verification are rejected and logged. Accepted webhooks are stored for audit and replay, scoped to the school. An hourly sync catches anything a webhook missed (Nomba transactions only for now; Paystack payments arrive by webhook).

---

## Design principles

| Decision | Why |
|---|---|
| One engine for online and manual payments | Every dashboard always agrees |
| The service charge is added on top of the fee | The school always receives its full fee |
| Charges are calculated per transfer | Full payments and instalments follow one rule |
| Payment records are append-only and idempotent | A complete audit trail; a webhook firing twice never duplicates |
| Oldest fee is cleared first | Arrears resolve in the order they were incurred |
| Withdrawable balance counts only gateway money | Cash a school already holds is never paid out of the wallet |
| Withdrawals go only to the saved payout account | A compromised login cannot redirect funds |
| Webhook verification rejects by default | A forged "payment" cannot mark a student paid |
| Referral rewards come from real margin | A referral never costs more than it earns |

---

## API overview

```
/api/auth          /api/schools        /api/students      /api/fees
/api/payments      /api/webhooks       /api/reports       /api/revenue
/api/withdrawals   /api/referrals      /api/parents       /api/subscriptions
/api/school-people
```

---

## Running locally

### Prerequisites

Node.js 18+, MongoDB, Redis if your setup uses queued jobs, Nomba and Paystack developer accounts, and a VTpass account for rewards. Paystack dedicated virtual accounts must be enabled on your Paystack business (Paystack activates this on request).

### Setup

```bash
cd backend  && npm install && cp .env.example .env && npm run dev   # http://localhost:5000
cd frontend && npm install && cp .env.example .env && npm run dev   # http://localhost:5173
```

One-time scripts, when upgrading an older database: `scripts/syncFeeIndexes.js`, `scripts/backfillReferralCodes.js`, `scripts/migrateVirtualAccounts.js`.

### Environments

| | Credentials | `NOMBA_BASE_URL` | Database |
|---|---|---|---|
| Local | Nomba TEST | `https://sandbox.nomba.com` | its own database |
| Production | Nomba LIVE | `https://api.nomba.com` | production database |

Sandbox accounts are simulated and cannot receive real money. Set `NODE_ENV=production` in production.

### Key environment variables

| Variable | Purpose |
|---|---|
| `NOMBA_BASE_URL`, `NOMBA_CLIENT_ID`, `NOMBA_SECRET_KEY`, `NOMBA_ACCOUNT_ID`, `NOMBA_SUB_ACCOUNT_ID` | Nomba API access (host only, no `/v1`) |
| `NOMBA_WEBHOOK_SECRET` | Signature key set in Nomba dashboard → Developer → Webhook Setup |
| `PAYSTACK_SECRET_KEY`, `PAYSTACK_PREFERRED_BANK` | Paystack access (`test-bank` in test mode) |
| `PAYSTACK_MOCK_MODE` | Development only: fakes Paystack accounts |
| `WEBHOOK_SKIP_VERIFY` | Development only: skips signature checks. Ignored in production |
| `VTPASS_BASE_URL`, `VTPASS_API_KEY`, `VTPASS_SECRET_KEY`, `VTPASS_PUBLIC_KEY` | Airtime and data rewards |
| `BULK_PROVISION_DELAY_MS` | Optional: pause between students when virtual accounts are created after a bulk import (default 1500) |
| `SUBSCRIPTION_PER_STUDENT`, `SUBSCRIPTION_MINIMUM` | Subscription rate per student per term (default ₦300) and the minimum per school per term (default ₦30,000) |
| `REFERRAL_REWARD_AMOUNT`, `REFERRAL_UNLOCK_MARGIN`, `REFERRAL_MAX_REWARDS_PER_MONTH` | Optional referral tuning |

Never commit real credentials. Treat any committed secret as compromised and rotate it.

---

## Testing

Follow **[TEST.md](./TEST.md)**. It walks through every role in order: setup, manual payments, parent views, overpayments, fee tools, revenue, referrals, subscriptions, school people, online payments and security checks. Manual mode can be tested end to end today with no gateway.

---

## Roadmap

**Built:** bulk student import, forced password change after an admin reset, fee management, manual and online reconciliation, service charge, early discount, overpayment resolution, hardship adjustments, one-off fees, class promotion, referral rewards, revenue and withdrawals, subscription billing.

**Verifying end to end:** live Nomba payments and webhooks; Paystack dedicated accounts, pending Paystack's activation.

**Next:** advance notice of subscription price increases by email and on the dashboard, a Paystack path in the per-student sync, payout webhooks to confirm withdrawals and refunds, per-gateway withdrawable balances, a per-school switch for the early discount, school-issued codes for linking children, and confirming each payment with the gateway before crediting.

---

## Origin

EduPay began as a project for the DevCareer × Nomba Hackathon (Virtual Account Infrastructure track) and has continued as an independent product for real school adoption.

**Built by:** Yusuf Ibrahim Olalekan

*Node.js · Express · MongoDB · Redis · Socket.io · React · Tailwind CSS · Nomba · Paystack · VTpass*