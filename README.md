# EduPay

**School fee payment infrastructure for Nigerian schools.**

Every student gets dedicated virtual bank accounts. Parents pay from any bank. Every payment is reconciled automatically: no manual matching, no shared accounts, no missed payments.

---

## The problem

School fee collection in Nigeria still runs on shared bank accounts and manual reconciliation. A bursar has to look at a stream of bank alerts and guess, from names and amounts, which parent paid for which child. Typos, same-name students, and payments from a relative's account all break this. Underpayments go unnoticed until a term is already underway. Overpayments sit unresolved because nobody has time to chase them down. Parents have no way to check a balance without calling the school.

## What EduPay does

EduPay gives every student their own dedicated virtual accounts, provisioned automatically on enrollment on **both Nomba and Paystack**, so a parent can pay into either. A payment into one of those accounts is unambiguous the moment it lands: there is no inference and no guessing, because the account itself identifies the student.

Every payment is classified instantly:

- ✅ **Exact**: fee fully paid
- ⚠️ **Underpayment**: partial, with the running balance tracked across future payments
- 🔁 **Overpayment**: excess flagged, with the parent choosing how it is resolved (refund or credit toward next term)

Parents are shown exactly what to transfer, the school fee plus a small service charge, along with any early-payment offer. Admins, bursars, and parents each get a real-time dashboard scoped to what they need: school-wide collection status, a live payment feed, or a single family's balance.

---

## Who it's for

- **School administrators** who need visibility into fee collection without building or maintaining their own finance software.
- **Bursars** who are currently reconciling payments by hand against bank statements or WhatsApp alerts.
- **Parents** who want to know their child's balance, and what to pay, without a phone call to the school office.

---

## How it works

1. **A student is enrolled**, and EduPay provisions a Nomba account and a Paystack account for them. If one gateway is down, the other still provisions, and a retry fills in the missing one.
2. **A parent sees what to transfer** (fee plus service charge, and any early-payment offer) and pays into either account from any Nigerian bank. No new app, no change in behavior.
3. **The payment reconciles itself.** EduPay's engine matches it to the student, updates the balance, and pushes the update live to every relevant dashboard.

## Two accounts per student, not one gateway per school

EduPay integrates **Nomba** and **Paystack** side by side. Each student holds an account on both, so parents get a choice and a school's fee collection does not stop because one provider has an outage. It also gives EduPay room to negotiate and adapt as its own volume grows.

---

## How EduPay sustains itself

EduPay is not a free tool subsidized indefinitely. Its model is built in from the start and is visible to everyone who pays:

- **A service charge**, shown to the parent and added on top of the school fee, so the school always receives its full fee.
- **An early-payment discount**, funded by the school, that rewards parents for paying ahead of the due date.
- **A referral program**: schools that refer other schools earn a month of waived service charges; individual staff and parents who refer a new school earn an airtime reward.

---

## Monetization

### Service charge

The charge is added on top of the school fee and paid by the parent.

| Component | Value |
|---|---|
| Rate | 1.5% of the amount transferred |
| Flat fee | ₦100 (waived for transfers of ₦2,500 or less) |
| Cap | ₦2,000 per transfer |

Parents are shown the exact amount to transfer so the school nets its full balance:

| School fee | Parent transfers | Service charge | School receives |
|---|---|---|---|
| ₦1,000 | ₦1,015 | ₦15 | ₦1,000 |
| ₦10,000 | ₦10,254 | ₦254 | ₦10,000 |
| ₦100,000 | ₦101,624 | ₦1,624 | ₦100,000 |

The charge is taken from each transfer as it arrives, so instalments work the same way: each carries its own charge, and only the remainder counts toward the fee balance. Cash payments recorded by a bursar carry no service charge. A referral reward can waive the charge for a month.

EduPay also records the gateway's own fee on every payment, so platform revenue is reported both gross (service charges) and net (service charges minus gateway fees).

### Early-payment discount

A parent whose first payment on a fee covers at least 90% of it, made on or before the due date, has that fee settled in full. The school absorbs the difference. One-off fees (uniform, trips) never qualify. Parents see the discounted amount and the deadline on their dashboard.

### Referral program

Every school, and every admin, bursar, or parent within it, has a personal referral code. Referrals convert automatically the moment the referred school makes its first payment:

| Referrer | Reward | How it's delivered |
|---|---|---|
| A school | One month of waived service charges, starting from its next payment | Automatic |
| An individual (admin, bursar, or parent) | Airtime reward | Self-serve: claimed from their own dashboard by entering a phone number |

A referrer earns a separate reward for each different school they successfully refer.

### Revenue visibility and withdrawal

Schools see their own revenue, and platform administrators see revenue across every school, computed live from the payment ledger rather than a separately maintained balance. A school withdraws to its own bank account on request through the gateway's transfer infrastructure.

A school's withdrawable balance counts only money that actually passed through a gateway (cash entries are excluded) and holds back overpayments that are owed back or already refunded.

### Overpayment resolution

When a payment exceeds what is owed, the parent chooses what happens to the excess: a refund to the account it came from (approved by the school), or a credit applied to the student's next term.

---

## School administration

- **Fee structures** per class, term, and session, assigned to a whole class or a single student.
- **One-off fees** (uniform, excursion) added to a single student without touching the class fee.
- **Hardship adjustments**: a school can reduce one student's fee. A written reason is required and kept as an audit note.
- **Class promotion**: promote or graduate a whole class, with a preview first. Old fee records stay on each student's account.
- **Manual payments** for cash or cheque, recorded by a bursar.

---

## Architecture

**Backend:** Node.js, Express, MongoDB, Redis, Socket.io
**Frontend:** React, Vite, Tailwind CSS
**Payments:** Nomba and Paystack, in parallel
**Airtime rewards:** VTpass (MTN, Glo, Airtel, 9mobile)

```
backend/
└── src/
    ├── models/          User, School, Student, FeeStructure, FeeAssignment,
    │                    Payment, Withdrawal, Referral, ReferralReward, WebhookLog
    ├── controllers/     auth, school, student, fee, payment, webhook, report,
    │                    notification, parent, referral, revenue, withdrawal
    ├── routes/
    ├── services/
    │   ├── reconciliation.service.js        core reconciliation engine
    │   ├── virtualAccount.service.js        provisions both accounts per student
    │   ├── paymentInstructions.service.js   what a parent should transfer
    │   ├── platformFee.service.js           service charge
    │   ├── earlyPaymentDiscount.service.js
    │   ├── fee.service.js                   next-term lookup
    │   ├── revenue.service.js, withdrawal.service.js
    │   ├── nomba.service.js, paystack.service.js (+ mappers)
    │   ├── referral.service.js, vtu.service.js
    │   └── transaction.service.js           hourly sync
    ├── middleware/      auth, roles, webhook signature verification
    ├── sockets/
    └── jobs/

frontend/
└── src/
    ├── pages/
    │   ├── Home.jsx                 public marketing site
    │   ├── auth/                    role-aware login and registration
    │   ├── admin/, bursar/, parent/ role-scoped dashboards
    │   └── ReferralClaim.jsx
    ├── components/
    ├── context/
    └── api/
```

### How reconciliation works

```
Parent transfers ₦10,254 to a student's virtual account
(₦10,000 school fee + ₦254 service charge)
          │
          ▼
Gateway fires a webhook → signature verified (rejects if anything is off)
          │
          ▼
Reconciliation engine:
  1. Confirms this payment hasn't already been processed
  2. Finds the student by their virtual account number (either gateway)
  3. Takes the service charge from the amount received (unless waived)
  4. Credits the remainder to the oldest open fee balance
  5. Checks for an early-payment discount
  6. Classifies the result: exact, underpayment, or overpayment
  7. Writes the payment and updated balance together, atomically, and in
     the same step converts any pending referral if this is the school's
     first payment
  8. Pushes the update live to every relevant dashboard
          │
          ▼
An hourly sync job catches anything a webhook missed
```

### Webhooks

| Gateway | Event handled | Verification |
|---|---|---|
| Nomba | `payment_success` where the transaction type is `vact_transfer` | HMAC-SHA256 over the documented field string plus `nomba-timestamp`, keyed with the signature key set in the Nomba dashboard |
| Paystack | `charge.success` | HMAC-SHA512 over the raw body, keyed with the secret key |

Requests that fail verification are rejected and logged. Every accepted webhook is stored for audit and replay, scoped to the school it belongs to.

---

## Design principles

| Decision | Why |
|---|---|
| One permanent account per student per gateway, across terms | Parents never have to type a reference correctly |
| The service charge is added on top of the fee | The school always receives its full fee |
| The charge is calculated on each transfer as it arrives | Full payments and instalments follow the same rule |
| Payment records are append-only | A complete, unmodifiable audit trail |
| Idempotent payment processing | A webhook firing twice never creates a duplicate payment |
| Atomic writes across payment, balance, and referral conversion | These succeed together or not at all |
| Referral rewards trigger on the referred school's first payment | A referral that never pays costs the platform nothing |
| Airtime rewards are claimed by the recipient | The person earning the reward decides when to use it |
| The parent chooses how an overpayment is resolved | It is their money |
| Oldest fee balance is cleared first | Arrears resolve in the order they were incurred |
| Withdrawable balance counts only gateway money | Cash a school already holds can never be paid out of the wallet |
| Webhook verification rejects by default | A forged "payment" cannot mark a student paid |

---

## API overview

```
Authentication     /api/auth/*
Schools            /api/schools/*
Students           /api/students/*
Fees               /api/fees/*
Payments           /api/payments/*
Webhooks           /api/webhooks/*
Reports            /api/reports/*
Revenue            /api/revenue/*
Withdrawals        /api/withdrawals/*
Referrals          /api/referrals/*
Parent portal      /api/parents/*
```

Endpoint-level detail lives alongside each route file in `backend/src/routes/`.

---

## Running EduPay locally

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Redis, if your setup uses queued jobs (confirm before installing, since not every environment needs it)
- Nomba and Paystack developer accounts; a VTpass sandbox account for airtime rewards
- Paystack dedicated virtual accounts must be enabled on your Paystack business (Paystack activates this on request)

### Setup

```bash
# Backend
cd backend
npm install
cp .env.example .env    # fill in real credentials. Never commit this file
npm run dev              # http://localhost:5000

# Frontend
cd frontend
npm install
cp .env.example .env
npm run dev              # http://localhost:5173
```

### Environments

Nomba credentials only work against the matching host, so keep the two environments separate:

| | Credentials | `NOMBA_BASE_URL` | Database |
|---|---|---|---|
| Local | Nomba TEST | `https://sandbox.nomba.com` | its own database |
| Production | Nomba LIVE | `https://api.nomba.com` | production database |

Accounts created with sandbox credentials are simulated and cannot receive real money. Set `NODE_ENV=production` in production.

### Key environment variables

| Variable | Purpose |
|---|---|
| `NOMBA_BASE_URL` | Host only, no `/v1` suffix |
| `NOMBA_CLIENT_ID`, `NOMBA_SECRET_KEY` | Nomba API credentials for the chosen environment |
| `NOMBA_ACCOUNT_ID`, `NOMBA_SUB_ACCOUNT_ID` | Parent account and sub-account |
| `NOMBA_WEBHOOK_SECRET` | Signature key set in Nomba dashboard → Developer → Webhook Setup |
| `PAYSTACK_SECRET_KEY` | Paystack secret key (`sk_test_…` or `sk_live_…`) |
| `PAYSTACK_PREFERRED_BANK` | `test-bank` in Paystack test mode |
| `PAYSTACK_MOCK_MODE` | Development only: fakes Paystack accounts until DVA is enabled |
| `WEBHOOK_SKIP_VERIFY` | Development only: skips signature checks for manual testing. Ignored in production |

**A note on `.env.example`:** it is a template and must only ever contain placeholder values. Never commit a real database URI, API key, or secret. Treat any committed secret as compromised and rotate it immediately, however quickly it is removed.

---

## Roadmap

**Built:** dual-account provisioning, reconciliation, service charge, early-payment discount, referral conversion and airtime claims, revenue and withdrawals, overpayment resolution, hardship adjustments, one-off fees, class promotion.

**Verifying end to end:** live Nomba payments and webhook delivery. Paystack dedicated accounts are waiting on Paystack's activation of the feature.

**Next:** a per-school switch for the early-payment discount, payout webhooks to confirm withdrawals and refunds, confirming each payment with the gateway before crediting, and subscription tiers as the long-term monetization model.

---

## Origin

EduPay began as a project for the DevCareer × Nomba Hackathon (Virtual Account Infrastructure track) and has since continued as an independent product aimed at real school adoption.

**Built by:** Yusuf Ibrahim Olalekan

---

*Node.js · Express · MongoDB · Redis · Socket.io · React · Tailwind CSS · Nomba · Paystack · VTpass*