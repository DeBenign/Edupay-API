# EduPay — School Fee Payment Infrastructure

> Built for the **DevCareer × Nomba Hackathon 2026** — Virtual Account Infrastructure Track
> **Team:** KudiClass | **Builder:** Yusuf Ibrahim Olalekan

---

## What is EduPay?

EduPay assigns every student in a school a dedicated virtual bank account — via **Nomba** or **Paystack**, selectable per school. When a parent transfers money to that account, the payment is **automatically reconciled** against the student's fee balance — no manual matching, no shared accounts, no missed payments.

Every inbound transfer is classified as:

- ✅ **Exact** — fee fully paid
- ⚠️ **Underpayment** — partial, balance tracked, running total accumulated
- 🔁 **Overpayment** — excess flagged, bursar and parent alerted to resolve

Parents see their balance in real time. Bursars watch payments land on a live feed. Admins get school-wide collection and revenue reports.

Beyond reconciliation, EduPay includes a full **monetization layer**: a platform fee on every transaction, an early-payment discount, and a two-sided referral program (school-to-school fee waivers and individual airtime rewards) — all built on top of the same reconciliation engine.

---

## Live Demo

| Role   | URL                         | Credentials                  |
| ------ | --------------------------- | ----------------------------- |
| Admin  | `https://edupay.vercel.app` | admin@demo.com / demo1234    |
| Bursar | `https://edupay.vercel.app` | bursar@demo.com / demo1234   |
| Parent | `https://edupay.vercel.app` | parent@demo.com / demo1234   |

**Backend API:** `https://edupay-api.up.railway.app`
**Health check:** `https://edupay-api.up.railway.app/health`

*(Under active local development — redeploy pending once the current feature set is fully tested locally. See [Local Development Setup](#local-development-setup).)*

---

## Tech Stack

### Backend

| Layer         | Technology         |
| ------------- | ------------------ |
| Runtime       | Node.js 18+        |
| Framework     | Express.js         |
| Database      | MongoDB + Mongoose |
| Cache / Queue | Redis + BullMQ     |
| Real-time     | Socket.io          |
| Auth          | JWT + bcrypt       |
| Scheduler     | node-cron          |
| Deployment    | Railway            |

### Frontend

| Layer      | Technology       |
| ---------- | ---------------- |
| Framework  | React 18 + Vite  |
| Styling    | Tailwind CSS     |
| Routing    | React Router v6  |
| HTTP       | Axios            |
| Real-time  | Socket.io-client |
| Deployment | Vercel           |

### Payment Gateways

Both gateways run **in parallel**, selectable per school via `School.paymentGateway` (`'nomba' | 'paystack'`). The same reconciliation engine, platform fee logic, and referral system handle both — gateway-specific code is isolated to `nomba.service.js` and `paystack.service.js`.

| Gateway  | APIs Used                                                                                          | Status                                                                 |
| -------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Nomba    | Virtual Account API, Webhooks (HMAC-SHA512 verified), Transactions API (hourly sync), Transfers API | Live provisioning works; **webhook delivery and transaction sync are currently broken on Nomba's side — escalated to Nomba's hackathon support channel with diagnostic evidence, awaiting response** |
| Paystack | Dedicated Virtual Accounts, Webhooks, Transfers API                                                  | Added as fallback gateway; pilot test-mode validation in progress             |

---

## Monetization

### Platform fee

A flat fee is deducted from the **school's** share of each payment (never the student's balance) — set to match what the gateway itself charges on a DVA credit, so it's currently a pass-through of processing cost rather than a separate margin:

- **Paystack:** 1% of the transaction, capped at ₦300 (confirmed against Paystack's published pricing)
- **Nomba:** currently defaults to the same 1% / ₦300 as a placeholder — **not yet confirmed with Nomba**, needs verifying before scaling volume

Because of the ₦300 cap, the *effective* rate falls as individual payment size rises — e.g. ₦10,000 payments net the full 1%, but ₦50,000 payments net only 0.6%. Computed in `platformFee.service.js`, applied inside the reconciliation engine's atomic write — see [How the Reconciliation Engine Works](#how-the-reconciliation-engine-works).

### Early-payment discount

10% off if a student's fee is paid **in full before the due date**. The school absorbs the discount — the platform fee is still calculated on the actual (discounted) amount paid, not the original amount expected.

### Referral system

Every admin, bursar, and parent has a personal `referralCode` (auto-generated); every school has its own. Both referral paths **convert automatically** the moment the referred school makes its **first payment** — never manually by an admin:

| Referrer          | Reward                                    | How it's claimed                                                                 |
| ----------------- | ------------------------------------------- | ----------------------------------------------------------------------------------- |
| A school           | Referring school's platform fee waived for 1 month, starting from its *next* payment (the payment that triggered conversion already had its own fee locked in first) | Automatic — applies directly to `School.platformFeeWaivedUntil` |
| An individual user | ₦2,000 airtime                            | **Self-serve** — the user claims it from their own dashboard by entering their phone number and network; never pushed by an admin |

Airtime is delivered via **VTpass** (MTN, Glo, Airtel, 9mobile), with an atomic claim guard preventing a reward from ever being paid out twice. A referrer earns a separate reward for *every* referral that converts — there's no cap on how many different schools one person can refer.

Because rewards are funded by the platform before revenue from that referral has necessarily offset the cost, airtime payouts are treated as a tracked `referralExpense` against platform revenue (see below) rather than folded silently into school revenue.

A manual admin-triggered fee-waiver endpoint still exists as a one-off override (e.g. for referrals created before this system shipped) — it's a safe no-op if the waiver was already auto-applied, not the normal path.

### Revenue visibility & withdrawal

- **School revenue** and **platform revenue** are computed on demand via aggregation over the `Payment` collection (`amountPaid − platformFeeAmount` per school; `platformFeeAmount` summed platform-wide) — not a separately-maintained running ledger, so there's no drift to reconcile.
- These numbers are a **scoreboard, not a wallet.** All payments land in one shared Nomba/Paystack merchant balance regardless of which school they belong to.
- **Withdrawal** (school payout): the backend calls the gateway's Transfer API to move a school's share out of that shared merchant balance into the school's own bank account — a real, explicit transfer per request.
- **Platform revenue** isn't "withdrawn" the same way — it's whatever remains in the merchant balance after school payouts and refunds, and it leaves the merchant balance via the gateway's own dashboard settlement (Nomba/Paystack paying out to your linked bank account), not through anything EduPay's backend triggers.

### Refund or credit for overpayment

The reconciliation engine already classifies and flags overpayments (`GET /api/reports/overpayments`). The parent chooses how it's resolved:
- **Refund to source** — a payout back to whoever sent the excess, using the payer's account number/bank code captured from the inflow webhook payload at payment time, via the same Transfer API used for withdrawals.
- **Credit to next term** — the excess reduces the amount owed on the student's next fee assignment, with no external payout needed at all.

**Status: detection exists and both resolution paths are designed; implementation is the next open item.**

---

## Project Structure

```
backend/
├── server.js
├── .env
└── src/
    ├── config/                     # DB, Redis, Nomba/Paystack, env validation
    ├── models/
    │   ├── User.js                 # role, referralCode (auto-generated, unique+sparse)
    │   ├── School.js                # referralCode, paymentGateway, platformFeeWaivedUntil
    │   ├── Student.js, FeeStructure.js, FeeAssignment.js
    │   ├── Payment.js                # platformFee, platformFeeWaived, netAmountForSchool,
    │   │                             # earlyPaymentDiscountApplied, gateway, payer details
    │   ├── WebhookLog.js
    │   ├── Referral.js               # referrerSchoolId/UserId/Role, feeWaiverStatus, airtimeStatus
    │   └── ReferralReward.js         # per-user claimable airtime reward, status lifecycle
    ├── controllers/
    │   ├── auth, school, student, fee, payment, webhook, report, notification, parent
    │   └── referral.controller.js    # listReferrals, rewardFeeWaiver (manual override),
    │                                  # getMyRewards, claimReward (self-serve)
    ├── routes/                      # one route file per controller
    ├── services/
    │   ├── reconciliation.service.js ⭐ core engine — atomic write + referral conversion hook
    │   ├── nomba.service.js, paystack.service.js
    │   ├── virtualAccount.service.js, transaction.service.js
    │   ├── notification.service.js, report.service.js
    │   ├── platformFee.service.js    # resolvePlatformFee — gateway fee rates + waiver check
    │   ├── earlyPaymentDiscount.service.js
    │   ├── referral.service.js       # applyFeeWaiver, createAirtimeReward, checkReferralConversion
    │   └── vtu.service.js            # VTpass wrapper — buyAirtime, verifyTransaction
    ├── middleware/                  # auth, role, webhook, errorHandler, platformAdmin
    ├── utils/                       # apiResponse (success/error/badRequest/created/etc.), paginate
    ├── sockets/                     # reconciliation.socket.js
    └── jobs/
        ├── syncTransactions.job.js, feeReminder.job.js
        └── vtuVerify.job.js         # requeries stuck/failed airtime claims

frontend/
└── src/
    ├── api/                         # axios instance + all API calls
    ├── context/                     # AuthContext, SocketContext
    ├── components/
    │   ├── ui/                     # Badge, Modal, Table, StatCard, Toast, Alert
    │   └── layout/                 # DashboardLayout (sidebar + mobile nav)
    ├── pages/
    │   ├── Home.jsx                 # public marketing homepage — hero, how-it-works, features
    │   ├── auth/                   # Login (role-aware via defaultRole prop), Register
    │   ├── admin/                  # Dashboard, Students, FeeStructures, Staff, Settings
    │   ├── bursar/                 # Dashboard (live feed), Students, StudentDetail, Reports, Overpayments
    │   ├── parent/                 # Dashboard, Children, PaymentHistory, ChildBalance, ChildPayments
    │   └── ReferralClaim.jsx        # self-serve airtime claim UI — not yet built
    └── utils/                       # formatters (currency, date, status)
```

---

## How the Reconciliation Engine Works

```
Parent transfers ₦50,000 to student's virtual account
          │
          ▼
Gateway fires webhook → POST /api/webhooks/{nomba|paystack}
          │
          ▼ (signature verified)
          │
reconciliation.service.js — processPayment():
  1. Idempotency check — reference already processed? Skip.
  2. Look up student by virtual account number
  3. Find oldest open fee assignment
  4a. Check early-payment discount eligibility
  4b. Resolve platform fee via platformFee.service.js
      (reads School.platformFeeWaivedUntil AS IT EXISTS RIGHT NOW —
       this is what guarantees a fee waiver only ever affects the
       NEXT payment, never the one that triggers it)
  5. Compute status: exact / underpayment (partial) / overpayment
  6. Atomic write (MongoDB session, sequential-write fallback on
     standalone local Mongo):
       - Payment + FeeAssignment saved together
       - checkReferralConversion() — if this is the school's FIRST
         payment and a referral is pending, create the airtime
         reward and/or apply the fee waiver, inside the same
         transaction
  7. Emit Socket.io event → bursar sees it live
  8. Create notifications → bursar + parent alerted
          │
          ▼
Hourly cron (Transactions API) catches anything the webhook missed
```

---

## Key Design Decisions

| Decision                                          | Reason                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| One virtual account per student                    | Parents never mistype a reference. Account is permanent across all terms.                        |
| Payment records are append-only                    | Immutable audit trail. No record is ever edited after creation.                                   |
| Idempotency via `reference` unique index          | Webhook can fire multiple times — DB rejects duplicates silently.                                |
| Atomic writes with sequential-write fallback       | Payment + FeeAssignment + referral conversion update together on Atlas; falls back safely on local standalone Mongo, which doesn't support transactions. |
| Platform fee resolved *before* referral conversion | Guarantees a fee waiver only ever applies from the school's next payment, never retroactively.   |
| Referral rewards auto-trigger on first payment     | A referral that never converts to a paying customer never costs the platform anything.            |
| Airtime claimed self-serve, not admin-pushed        | The user, not an admin, decides when and where the reward is spent — admin path is a manual override only. |
| Atomic claim guard on `ReferralReward`             | `findOneAndUpdate` with a status check prevents a reward from ever being paid out twice.           |
| Parent chooses overpayment resolution              | Refund-to-source or credit-to-next-term — it's the parent's money, not the bursar's decision alone. |
| Oldest-assignment-first logic                       | Multi-term arrears are cleared in chronological order automatically.                              |

---

## API Reference

### Authentication
```
POST /api/auth/register          Create account (admin, bursar, or parent)
POST /api/auth/login             Login → returns JWT
GET  /api/auth/me                Get current user
POST /api/auth/create-staff      Admin creates bursar/parent accounts
```

### Schools
```
POST /api/schools                Create school (accepts optional referralCode)
GET  /api/schools/me              Get current user's school
PATCH /api/schools/:id            Update school details / gateway selection
```

### Students / Fees / Payments / Webhooks / Reports
*(see route files for full list — unchanged from original MVP scope)*

### Referrals
```
GET  /api/referrals?status=pending          List referrals (platform admin only)
POST /api/referrals/:id/reward/fee-waiver    Manual override — normal path is automatic
GET  /api/referrals/rewards                  Logged-in user's own reward list
POST /api/referrals/rewards/:rewardId/claim  Self-serve airtime claim (owner only)
```

### Revenue, Withdrawals & Refunds *(designed, implementation next)*
```
GET  /api/reports/school-revenue/:schoolId   School revenue for a term/session
GET  /api/reports/platform-revenue            Platform-wide revenue (admin only)
POST /api/withdrawals                         School payout request → gateway Transfer API
POST /api/payments/:id/refund                 Refund an overpayment to its source
POST /api/payments/:id/credit-next-term       Apply an overpayment to the student's next fee assignment
```

---

## Known Issues

- **Nomba webhooks never arrive** at the registered endpoint — endpoint reachability and signature verification are confirmed working; the gap is on Nomba's delivery side. **Escalated to Nomba's hackathon support channel with diagnostic evidence; awaiting response.**
- **Nomba's hourly transaction-sync fallback fails** against the live transactions endpoint with a generic "unexpected system error."
- **Paystack pilot** (test-mode, demo bank app) is the current validation path while the above is unresolved — not yet confirmed end-to-end.
- **Refund/credit flow for overpayments** is designed but not yet implemented.
- **Referral claim, revenue dashboard, and withdrawal UI** exist as backend endpoints only — frontend pages not yet built.

---

## Local Development Setup

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Redis (local, Redis Cloud, or Railway addon — only needed if BullMQ queues are actually in use; verify before setting this up)
- Nomba developer account, Paystack test account, VTpass sandbox account

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Fill in Nomba, Paystack, VTpass credentials and DB URIs in .env
npm run dev
# API runs on http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Set VITE_API_URL=http://localhost:5000/api
npm run dev
# App runs on http://localhost:5173
```

### Environment Variables

**Backend (`.env`)**
```
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173

MONGO_URI=mongodb://localhost:27017/edupay
REDIS_URL=redis://localhost:6379

JWT_SECRET=your_strong_jwt_secret
JWT_EXPIRES_IN=7d

NOMBA_BASE_URL=https://api.nomba.com/v1
NOMBA_ACCOUNT_ID=your_account_id
NOMBA_SUB_ACCOUNT_ID=your_sub_account_id
NOMBA_CLIENT_ID=your_client_id
NOMBA_SECRET_KEY=your_private_key
NOMBA_WEBHOOK_SECRET=your_generated_webhook_secret
NOMBA_FEE_RATE=0.01
NOMBA_FEE_CAP=300

PAYSTACK_SECRET_KEY=your_paystack_secret_key
PAYSTACK_WEBHOOK_SECRET=your_paystack_webhook_secret
PAYSTACK_FEE_RATE=0.01
PAYSTACK_FEE_CAP=300

VTPASS_BASE_URL=https://sandbox.vtpass.com/api
VTPASS_API_KEY=your_sandbox_api_key
VTPASS_SECRET_KEY=your_sandbox_secret_key
VTPASS_PIN=your_pin

PLATFORM_ADMIN_EMAILS=you@example.com
```

**Frontend (`.env`)**
```
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## Deployment

### Backend → Railway
1. Push repo to GitHub
2. New project on railway.app → Deploy from GitHub, root directory `backend`
3. Add all backend `.env` variables in Railway dashboard
4. Submit webhook URLs: `https://your-app.railway.app/api/webhooks/nomba` and `/api/webhooks/paystack`

### Frontend → Vercel
1. Import repo on vercel.com
2. Set root directory to `frontend`
3. Add `VITE_API_URL`, `VITE_SOCKET_URL`
4. Deploy

---

## Judging Criteria — How EduPay Addresses Each

| Criterion                        | Implementation                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Reconciliation logic quality        | Multi-step engine with idempotency, atomic writes (with local-dev fallback), status resolution, hourly fallback sync |
| Underpayment handling               | Running balance tracked across multiple partial payments; oldest-assignment-first accumulation       |
| Overpayment handling                | Classified separately, bursar + parent notified; parent chooses refund-to-source or next-term credit |
| Customer-level reporting            | Per-student statement, per-term breakdown, full payment timeline                                      |
| Monetization design                 | Gateway-matched platform fee, early-payment discount, two-sided referral program, revenue aggregation |

---

## Team

**Yusuf Ibrahim Olalekan** — Lead Engineer
- B.Sc. Computer Science & Engineering, OAU Ile-Ife
- 3+ years backend engineering (Node.js, TypeScript, MongoDB, Redis)
- Prior Nomba payment integration experience

**Team name:** KudiClass
**Hackathon track:** Virtual Account as Infrastructure

---

*Built with Node.js, Express, MongoDB, Redis, Socket.io, React, Tailwind CSS, Nomba, Paystack, and VTpass.*