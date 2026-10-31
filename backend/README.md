# EduPay

**School fee payment infrastructure for Nigerian schools.**

Every student gets a dedicated virtual bank account. Parents pay from any bank. Every payment is reconciled automatically — no manual matching, no shared accounts, no missed payments.

---

## The problem

School fee collection in Nigeria still runs on shared bank accounts and manual reconciliation. A bursar has to look at a stream of bank alerts and guess, from names and amounts, which parent paid for which child. Typos, same-name students, and payments from a relative's account all break this. Underpayments go unnoticed until a term is already underway. Overpayments sit unresolved because nobody has time to chase them down. Parents have no way to check a balance without calling the school.

## What EduPay does

EduPay gives every student their own dedicated virtual account — provisioned automatically on enrollment, through **Nomba** or **Paystack**. A payment into that account is unambiguous the moment it lands: there's no inference, no guessing, because the account itself identifies the student.

Every payment is classified instantly:

- ✅ **Exact** — fee fully paid
- ⚠️ **Underpayment** — partial, running balance tracked automatically across future payments
- 🔁 **Overpayment** — excess flagged, with the parent choosing how it's resolved (refund or credit toward next term)

Admins, bursars, and parents each get a real-time dashboard scoped to what they need to see — school-wide collection status, a live payment feed, or a single family's balance.

---

## Who it's for

- **School administrators** who need visibility into fee collection without building or maintaining their own finance software.
- **Bursars** who are currently reconciling payments by hand against bank statements or WhatsApp alerts.
- **Parents** who want to know their child's balance without a phone call to the school office.

---

## How it works

1. **A student is enrolled**, and EduPay provisions a dedicated virtual account for them through Nomba or Paystack — whichever gateway the school has selected.
2. **A parent transfers the fee** from any Nigerian bank — no new app, no change in behavior required on their part.
3. **The payment reconciles itself.** EduPay's reconciliation engine matches it to the student, updates the balance, and pushes the update live to every relevant dashboard.

## Running on two gateways, not one

EduPay integrates both **Nomba** and **Paystack**, selectable per school. This isn't redundancy for its own sake — it means a school's fee collection doesn't go down because one payment provider is having an outage, and it gives EduPay room to negotiate and adapt as its own volume grows.

---

## How EduPay sustains itself

EduPay is not a free tool subsidized indefinitely — it has a monetization model built in from the start, transparent to the schools using it:

- **A platform fee** — a small percentage of each transaction, capped so it never becomes disproportionate on large payments, taken from the school's share, never the student's balance.
- **An early-payment discount** — schools can offer parents 10% off for paying in full ahead of the due date, funded by the school, not the platform.
- **A referral program** — schools that refer other schools earn a month of waived platform fees; individual staff and parents who refer a new school earn an airtime reward, claimed directly from their own dashboard.

Full detail on how each of these works is in [Monetization](#monetization) below.

---

## Monetization

### Platform fee

A percentage-based fee, capped at a fixed naira amount, deducted from the school's share of each payment — never the student's balance — and set to track what the payment gateway itself charges on a dedicated virtual account credit. Because of the cap, the platform's effective take rate is highest on smaller, more frequent payments and lowest on large lump-sum payments — a deliberate design so a family paying an entire year's fees at once isn't charged disproportionately.

### Early-payment discount

Schools can offer a 10% discount for fees paid in full ahead of the due date. The school absorbs this cost; the platform fee still applies to the amount actually paid.

### Referral program

Every school, and every admin/bursar/parent within it, has a personal referral code. Referrals convert automatically the moment the referred school makes its first payment:

| Referrer | Reward | How it's delivered |
|---|---|---|
| A school | One month of waived platform fees, starting from its next payment | Automatic — no action needed |
| An individual (admin, bursar, or parent) | Airtime reward | Self-serve — claimed from their own dashboard by entering a phone number, never pushed by an admin |

A referrer earns a separate reward for each different school they successfully refer.

### Revenue visibility and withdrawal

Schools can see their own revenue, and platform administrators can see revenue across every school, computed live from the payment ledger rather than a separately-maintained balance. A school withdraws its share directly to its own bank account on request, via the gateway's transfer infrastructure.

### Overpayment resolution

When a payment exceeds what's owed, the parent — not the school — chooses what happens to the excess: a refund back to the account it came from, or a credit applied to the student's next term.

---

## Architecture

**Backend:** Node.js, Express, MongoDB, Redis, Socket.io
**Frontend:** React, Vite, Tailwind CSS
**Payments:** Nomba and Paystack, running in parallel
**Airtime rewards:** VTpass (MTN, Glo, Airtel, 9mobile)

```
backend/
└── src/
    ├── models/          User, School, Student, FeeStructure, FeeAssignment,
    │                    Payment, Referral, ReferralReward, WebhookLog
    ├── controllers/      auth, school, student, fee, payment, webhook,
    │                    report, notification, parent, referral
    ├── routes/
    ├── services/
    │   ├── reconciliation.service.js   core reconciliation engine
    │   ├── nomba.service.js, paystack.service.js
    │   ├── platformFee.service.js
    │   ├── earlyPaymentDiscount.service.js
    │   ├── referral.service.js
    │   └── vtu.service.js
    ├── middleware/
    ├── sockets/
    └── jobs/

frontend/
└── src/
    ├── pages/
    │   ├── Home.jsx      public marketing site
    │   ├── auth/         role-aware login, registration
    │   ├── admin/, bursar/, parent/   role-scoped dashboards
    │   └── ReferralClaim.jsx
    ├── components/
    ├── context/
    └── api/
```

### How reconciliation works

```
Parent transfers ₦50,000 to a student's virtual account
          │
          ▼
Gateway fires a webhook → signature verified
          │
          ▼
Reconciliation engine:
  1. Confirms this payment hasn't already been processed
  2. Finds the student by their virtual account number
  3. Applies it to the oldest open fee balance
  4. Checks for an early-payment discount, and resolves the
     platform fee (including any active referral fee waiver)
  5. Classifies the result: exact, underpayment, or overpayment
  6. Writes the payment and updated balance together, atomically —
     and in the same step, converts any pending referral if this
     is the school's first payment
  7. Pushes the update live to every relevant dashboard
          │
          ▼
An hourly sync job catches anything a webhook missed
```

---

## Design principles

| Decision | Why |
|---|---|
| One virtual account per student, permanent across terms | Removes the need for parents to remember or type a reference correctly |
| Payment records are append-only | A complete, unmodifiable audit trail |
| Idempotent payment processing | A webhook firing twice never creates a duplicate payment |
| Atomic writes across payment, balance, and referral conversion | These either all succeed together or none do — no partial states |
| Referral rewards trigger on the referred party's first payment, not on signup | A referral that never becomes a paying customer costs the platform nothing |
| Airtime rewards are claimed by the recipient, not pushed by an admin | The person earning the reward decides when and how to use it |
| The parent chooses how an overpayment is resolved | It's their money to decide what happens with |
| Oldest fee balance is cleared first | Multi-term arrears resolve in the order they were incurred |

---

## API overview

```
Authentication     /api/auth/*
Schools            /api/schools/*
Students           /api/students/*
Fees               /api/fees/*
Payments           /api/payments/*
Webhooks           /api/webhooks/*
Reports & revenue  /api/reports/*
Referrals          /api/referrals/*
Withdrawals        /api/withdrawals/*
Parent portal      /api/parents/*
```
Full endpoint-level documentation lives alongside each route file in `backend/src/routes/`.

---

## Running EduPay locally

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Redis, if your setup uses queued jobs — confirm before installing, since not every environment needs it
- Nomba and Paystack developer accounts; a VTpass sandbox account for airtime rewards

### Setup
```bash
# Backend
cd backend
npm install
cp .env.example .env    # fill in real credentials — never commit this file
npm run dev              # http://localhost:5000

# Frontend
cd frontend
npm install
cp .env.example .env
npm run dev              # http://localhost:5173
```

**A note on `.env.example`:** this file exists as a template and should only ever contain placeholder values. Never commit a real database URI, API key, or secret into it — treat any committed secret as compromised and rotate it immediately, regardless of how quickly it's removed afterward.

---

## Roadmap

**Live:** dual-gateway reconciliation, platform fee, early-payment discount, referral conversion and self-serve airtime claims.

**In progress:** revenue and withdrawal endpoints, overpayment refund/credit actions, the dashboard UI for referrals and revenue.

**Under investigation:** a webhook delivery issue on Nomba's side, currently escalated with their support team; Paystack is validated as the working fallback in the meantime.

---

## About

EduPay is an independent product built for real school adoption.

**Built by:** Yusuf Ibrahim Olalekan

---

*Node.js · Express · MongoDB · Redis · Socket.io · React · Tailwind CSS · Nomba · Paystack · VTpass*