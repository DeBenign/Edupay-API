# EduPay — School Fee Payment Infrastructure

> Built for the **DevCareer × Nomba Hackathon 2026** — Virtual Account Infrastructure Track
> **Team:** KudiClass | **Builder:** Yusuf Ibrahim Olalekan

---

## What is EduPay?

EduPay assigns every student in a school a dedicated **Nomba virtual account number**. When a parent transfers money to that account, the payment is **automatically reconciled** — no manual matching, no shared accounts, no missed payments.

Every inbound transfer is classified as:
- ✅ **Exact** — fee fully paid
- ⚠️ **Underpayment** — partial, balance tracked, running total accumulated
- 🔁 **Overpayment** — excess flagged, bursar alerted for refund

Parents see their balance in real time. Bursars watch payments land on a live feed. Admins get school-wide collection reports.

---

## Live Demo

| Role    | URL                              | Credentials          |
|---------|----------------------------------|----------------------|
| Admin   | `https://edupay.vercel.app`      | admin@demo.com / demo1234 |
| Bursar  | `https://edupay.vercel.app`      | bursar@demo.com / demo1234 |
| Parent  | `https://edupay.vercel.app`      | parent@demo.com / demo1234 |

**Backend API:** `https://edupay-api.up.railway.app`
**Health check:** `https://edupay-api.up.railway.app/health`

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| Cache / Queue | Redis + BullMQ |
| Real-time | Socket.io |
| Auth | JWT + bcrypt |
| Scheduler | node-cron |
| Deployment | Railway |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| HTTP | Axios |
| Real-time | Socket.io-client |
| Deployment | Vercel |

### Nomba APIs Used
| API | How It's Used |
|---|---|
| **Virtual Account API** | Provision one unique account per student on enrollment |
| **Webhooks** | Receive real-time credit notifications; HMAC-SHA512 verified |
| **Transactions API** | Hourly sync cron — catches any payments missed by webhooks |
| **Transfers API** | Initiate outbound refunds for overpayments |

---

## Project Structure

```
edupay/
├── school-fee-tracker-api/          # Backend
│   ├── server.js                    # Entry point
│   ├── src/
│   │   ├── config/                  # DB, Redis, Nomba, env validation
│   │   ├── models/                  # User, School, Student, FeeStructure,
│   │   │                            # FeeAssignment, Payment, WebhookLog
│   │   ├── controllers/             # auth, school, student, fee, payment,
│   │   │                            # webhook, report, notification, parent
│   │   ├── routes/                  # One route file per controller
│   │   ├── services/
│   │   │   ├── reconciliation.service.js  ⭐ Core engine
│   │   │   ├── nomba.service.js           All Nomba API calls
│   │   │   ├── virtualAccount.service.js  Provision + lookup
│   │   │   ├── transaction.service.js     Sync job logic
│   │   │   ├── notification.service.js    Bursar + parent alerts
│   │   │   └── report.service.js          All reporting queries
│   │   ├── middleware/              # auth, role, webhook, errorHandler
│   │   ├── utils/                   # apiResponse, hashSignature, paginate
│   │   ├── sockets/                 # reconciliation.socket.js
│   │   └── jobs/                    # syncTransactions, feeReminder (cron)
│
└── school-fee-tracker-web/          # Frontend
    ├── src/
    │   ├── api/                     # All API calls + axios instance
    │   ├── context/                 # AuthContext, SocketContext
    │   ├── components/
    │   │   ├── ui/                  # Badge, Modal, Table, StatCard, Toast
    │   │   └── layout/              # DashboardLayout (sidebar + mobile nav)
    │   ├── pages/
    │   │   ├── auth/                # Login, Register
    │   │   ├── admin/               # Dashboard, Students, Fees, Settings
    │   │   ├── bursar/              # Dashboard (live feed), Students, Reports
    │   │   └── parent/              # Dashboard, Children, Payment History
    │   └── utils/                   # formatters (currency, date, status)
```

---

## How the Reconciliation Engine Works

```
Parent transfers ₦50,000 to student's Nomba account
          │
          ▼
Nomba fires webhook → POST /api/webhooks/nomba
          │
          ▼ (HMAC-SHA512 signature verified)
          │
          ▼
reconciliation.service.js:
  1. Idempotency check — reference already processed? Skip.
  2. Look up student by account number (indexed O(1) lookup)
  3. Find oldest open fee assignment
  4. Compute: totalNowPaid = previouslyPaid + amountPaid
  5. Resolve status:
       balance === 0  → PAID (exact)
       balance > 0    → PARTIAL (underpayment)
       balance < 0    → OVERPAID
  6. Atomic write — Payment + FeeAssignment in one DB transaction
  7. Emit Socket.io event → bursar sees it live
  8. Create notifications → bursar + parent alerted
          │
          ▼
Hourly cron (Transactions API) catches anything the webhook missed
```

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| **One virtual account per student** | Parents never mistype a reference. Account is permanent across all terms. |
| **Payment records are append-only** | Immutable audit trail. No record is ever edited after creation. |
| **Idempotency via `reference` unique index** | Webhook can fire multiple times — DB rejects duplicates silently. |
| **Atomic writes (MongoDB sessions)** | Payment log + assignment balance updated together or not at all. |
| **Webhook ACKs 200 before processing** | Nomba never times out. Processing happens async after response. |
| **Hourly Transactions API sync** | Safety net — 100% payment capture even if server was down during a payment. |
| **Oldest-assignment-first logic** | Multi-term arrears are cleared in chronological order automatically. |

---

## API Reference

### Authentication
```
POST /api/auth/register          Create account (admin or parent)
POST /api/auth/login             Login → returns JWT
GET  /api/auth/me                Get current user
POST /api/auth/create-staff      Admin creates bursar/parent accounts
```

### Students
```
POST /api/students               Enroll student + auto-provision virtual account
GET  /api/students               List students (paginated, searchable)
GET  /api/students/:id           Student detail + fee assignments
GET  /api/students/:id/account   Get virtual account number for payment
POST /api/students/:id/provision-account  Retry failed provisioning
```

### Fees
```
POST /api/fees/structures        Create fee structure for a class + term
GET  /api/fees/structures        List fee structures
POST /api/fees/assign            Assign fee to one student
POST /api/fees/assign-class      Bulk assign to entire class
GET  /api/fees/assignments/:id   Get all assignments for a student
```

### Payments
```
POST /api/payments/manual        Bursar records cash/cheque payment
GET  /api/payments/student/:id   Student payment history
GET  /api/payments/assignment/:id  Reconciliation summary for one assignment
POST /api/payments/sync/:id      Trigger manual sync for one student
```

### Webhooks
```
POST /api/webhooks/nomba         Nomba posts payment events here
GET  /api/webhooks/logs          Webhook audit log (admin/bursar)
POST /api/webhooks/replay/:id    Replay a failed webhook
```

### Reports
```
GET /api/reports/summary                     School-wide collection stats
GET /api/reports/class                       Per-class breakdown
GET /api/reports/overpayments               Students with excess payments
GET /api/reports/recent                      Last N payments (feeds live dashboard)
GET /api/reports/student/:id/statement      Full student statement
```

### Parent Portal
```
GET  /api/parents/dashboard                  All children + statuses in one call
GET  /api/parents/children                   List linked children
POST /api/parents/link-child                 Self-service child linking
GET  /api/parents/children/:id/account       Account number to pay into
GET  /api/parents/children/:id/balance       Per-term balance breakdown
GET  /api/parents/children/:id/payments      Full payment history
GET  /api/parents/notifications              Alerts (auto-marked read on fetch)
```

---

## Local Development Setup

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Redis (local or Redis Cloud)
- Nomba developer account with API credentials

### Backend
```bash
cd school-fee-tracker-api
npm install
cp .env.example .env
# Fill in your Nomba credentials and DB URIs in .env
npm run dev
# API runs on http://localhost:5000
# Health check: http://localhost:5000/health
```

### Frontend
```bash
cd school-fee-tracker-web
npm install
cp .env.example .env
# Set VITE_API_URL=http://localhost:5000/api
npm run dev
# App runs on http://localhost:5173
```

### Environment Variables

**Backend (`.env`)**
```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173

MONGO_URI=mongodb://localhost:27017/edupay
REDIS_URL=redis://localhost:6379

JWT_SECRET=your_strong_jwt_secret
JWT_EXPIRES_IN=7d

NOMBA_BASE_URL=https://api.nomba.com/v1
NOMBA_ACCOUNT_ID=f666ef9b-888e-4799-85ce-acb505b28023
NOMBA_SUB_ACCOUNT_ID=b038a2cc-ae9c-4a53-81e1-adf703861869
NOMBA_CLIENT_ID=your_client_id
NOMBA_SECRET_KEY=your_private_key
NOMBA_WEBHOOK_SECRET=your_generated_webhook_secret
```

**Frontend (`.env`)**
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## Deployment

### Backend → Railway
1. Push repo to GitHub
2. New project on [railway.app](https://railway.app) → Deploy from GitHub
3. Add all backend `.env` variables in Railway dashboard
4. Railway auto-deploys on every push to `main`
5. Submit webhook URL: `https://your-app.railway.app/api/webhooks/nomba`

### Frontend → Vercel
1. Import repo on [vercel.com](https://vercel.com)
2. Set root directory to `school-fee-tracker-web`
3. Add environment variables: `VITE_API_URL`, `VITE_SOCKET_URL`
4. Deploy

---

## Judging Criteria — How EduPay Addresses Each

| Criterion | Implementation |
|---|---|
| **Reconciliation logic quality** | 9-step engine with idempotency, atomic writes, status resolution, and hourly fallback sync |
| **Underpayment handling** | Running balance tracked across multiple partial payments; oldest-assignment-first accumulation |
| **Overpayment handling** | Classified separately, bursar + admin notified, flagged in reports for refund action |
| **Customer-level reporting** | Per-student statement, per-term breakdown, full payment timeline — accessible to parent and bursar |

---

## Team

**Yusuf Ibrahim Olalekan** — Lead Engineer
- B.Sc. Computer Science & Engineering, OAU Ile-Ife
- 3+ years backend engineering (Node.js, TypeScript, MongoDB, Redis)
- Prior Nomba payment integration experience

**Team name:** KudiClass
**Hackathon track:** Virtual Account as Infrastructure

---

*Built with Node.js, Express, MongoDB, Redis, Socket.io, React, Tailwind CSS, and the Nomba API.*
