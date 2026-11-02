// src/pages/Pricing.jsx: public pricing page. Every number is read from the backend
// (GET /subscriptions/pricing, via usePricing), so it always matches what schools are actually charged.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import usePricing, { naira, pct } from '../hooks/usePricing'
import Logo from '../components/Logo'
import { ShieldCheck, Lock, MessageCircle, Phone, Mail, Check, X } from 'lucide-react'

const Block = ({ id, title, children }) => (
  <section id={id} className="space-y-3">
    <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
    {children}
  </section>
)

const Faq = ({ q, children }) => (
  <details className="card px-5 py-4 group">
    <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-medium text-gray-900 text-sm">
      {q}
      <span className="text-gray-400 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
    </summary>
    <div className="text-sm text-gray-600 mt-3 leading-relaxed space-y-2">{children}</div>
  </details>
)

export default function Pricing() {
  const { data: d } = usePricing()
  const [students, setStudents] = useState(150)
  const { ratePerStudent, minimum, termDays, graceDays, examples } = d.subscription
  const sc = d.serviceCharge
  const count = Math.max(0, parseInt(students, 10) || 0)
  const fee = useMemo(() => Math.max(minimum, count * ratePerStudent), [count, minimum, ratePerStudent])
  const { whatsapp, phone, email } = d.contact
  const hasContact = whatsapp || phone || email

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold text-gray-900"><Logo size={32} /> EduPay</Link>
        <nav className="flex items-center gap-5 text-sm text-gray-600">
          <a href="#pricing" className="font-medium text-gray-900">Pricing</a>
          <a href="#privacy" className="hover:text-gray-900">Privacy</a>
          <Link to="/how-it-works" className="hover:text-gray-900 hidden sm:inline">How it works</Link>
          <Link to="/login" className="font-medium text-gray-900">Sign in</Link>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-4 pb-16 space-y-10">
        <div id="pricing" className="pt-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Simple pricing. Pay per student, once a term.</h1>
          <p className="text-gray-500 mt-3">One price, every feature. No setup fee, and no card needed to start.</p>
        </div>

        {/* Headline numbers */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-xl p-5 bg-blue-600 text-white">
            <p className="text-sm text-blue-100">First {termDays} days</p>
            <p className="text-3xl font-bold mt-1">Free</p>
            <p className="text-xs text-blue-100 mt-3 leading-relaxed">Your school is verified, then the full product is yours. The clock starts the day EduPay approves you.</p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-gray-500">After that</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{naira(ratePerStudent)}</p>
            <p className="text-xs text-gray-500 mt-3">per student, per term</p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-gray-500">Smallest fee</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{naira(minimum)}</p>
            <p className="text-xs text-gray-500 mt-3">per term, however small the school</p>
          </div>
        </div>

        {/* Calculator */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900">Work out your fee</h2>
          <p className="text-xs text-gray-500 mt-1">Students × {naira(ratePerStudent)} = your fee for the term (never below {naira(minimum)}).</p>
          <div className="flex items-center gap-3 mt-4">
            <label htmlFor="students" className="text-sm text-gray-600">How many students?</label>
            <input id="students" type="number" min="0" inputMode="numeric" value={students}
              onChange={(e) => setStudents(e.target.value)} className="input w-28" />
          </div>
          <p className="mt-4"><span className="text-3xl font-bold text-gray-900">{naira(fee)}</span> <span className="text-sm text-gray-500">per term</span></p>
          <p className="text-xs text-gray-500 mt-1">One payment covers a term of about {termDays} days.</p>
          <div className="mt-4 divide-y divide-gray-100 border-t border-gray-100 text-sm">
            {examples.map((e) => (
              <div key={e.students} className="flex justify-between py-2.5">
                <span className="text-gray-600">{e.students.toLocaleString()} students</span>
                <span className="font-medium text-gray-900">{naira(e.perTerm)} per term</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3 leading-relaxed">
            You are never asked to declare a number. EduPay counts the students you enrol. You are billed on the highest active count since your last payment, so removing students just before billing does not lower the bill.
          </p>
        </div>

        {/* Service charge */}
        <Block title="The parent service charge">
          <div className="card p-6 space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              Parents who pay online add a small service charge on top of the fee: <strong>{pct(sc.rate)} + {naira(sc.flat)}</strong> per transfer, capped at {naira(sc.cap)}. The {naira(sc.flat)} part is not charged on transfers of {naira(sc.flatWaivedAtOrBelow)} or less. <strong>The school always receives the full fee.</strong>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                    <th className="py-2 pr-4 font-medium">School fee</th><th className="py-2 pr-4 font-medium">Parent transfers</th>
                    <th className="py-2 pr-4 font-medium">Charge</th><th className="py-2 font-medium">School receives</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sc.examples.map((e) => (
                    <tr key={e.schoolFee}>
                      <td className="py-2.5 pr-4 text-gray-600">{naira(e.schoolFee)}</td>
                      <td className="py-2.5 pr-4 font-medium text-gray-900">{naira(e.parentPays)}</td>
                      <td className="py-2.5 pr-4 text-amber-600 font-medium">{naira(e.charge)}</td>
                      <td className="py-2.5 font-semibold text-green-700">{naira(e.schoolReceives)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="text-sm text-gray-600 space-y-1.5">
              <li className="flex gap-2"><Check size={16} className="text-green-600 mt-0.5 shrink-0" /> Cash recorded at the school office has no charge.</li>
              <li className="flex gap-2"><Check size={16} className="text-green-600 mt-0.5 shrink-0" /> The charge is the same during the free pilot and after it. Only your own subscription starts when the pilot ends.</li>
            </ul>
          </div>
        </Block>

        {/* How paying works */}
        <Block title="How paying works">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              ['1. We tell you the amount', 'Based on the students you have enrolled. Your dashboard always shows what is due and when.'],
              ['2. You pay', d.onlineSubscriptionPayments
                ? 'By bank transfer, or online from your dashboard. Use your school name as the reference.'
                : 'By bank transfer, using your school name as the reference. Online card payment is coming soon.'],
              ['3. Access renews', 'EduPay records your payment and everything reopens at once. We email your admin before access ends.'],
            ].map(([t, b]) => (
              <div key={t} className="card p-5">
                <p className="font-medium text-gray-900 text-sm">{t}</p>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">{b}</p>
              </div>
            ))}
          </div>
        </Block>

        {/* After the pilot */}
        <Block title={`After the ${termDays}-day free pilot`}>
          <div className="card p-6 space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              You have a <strong>{graceDays}-day grace period</strong> to pay by bank transfer. If the subscription is still unpaid after that, your school is paused until payment is recorded.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg border border-red-100 bg-red-50/50 p-4">
                <p className="font-medium text-red-700 mb-2">Paused while unpaid</p>
                {['Enrolling students', 'Creating or assigning fees', 'Adding staff', 'Recording cash payments'].map((x) => (
                  <p key={x} className="flex gap-2 text-gray-700 py-0.5"><X size={16} className="text-red-500 mt-0.5 shrink-0" /> {x}</p>
                ))}
              </div>
              <div className="rounded-lg border border-green-100 bg-green-50/50 p-4">
                <p className="font-medium text-green-700 mb-2">Still works</p>
                {['Parents can still pay', 'Payments are still matched', 'You can still withdraw', 'Reports stay readable'].map((x) => (
                  <p key={x} className="flex gap-2 text-gray-700 py-0.5"><Check size={16} className="text-green-600 mt-0.5 shrink-0" /> {x}</p>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500">Nothing is deleted. Once your payment is recorded, access returns immediately.</p>
          </div>
        </Block>

        {/* Privacy */}
        <Block id="privacy" title="Privacy: what EduPay can and cannot see">
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="card p-5 border-green-200">
              <p className="font-medium text-green-700 mb-2 flex items-center gap-2"><ShieldCheck size={16} /> EduPay can see</p>
              {['Your school name and contact details', 'How many students are enrolled', 'Your subscription status'].map((x) => (
                <p key={x} className="flex gap-2 text-gray-700 py-0.5"><Check size={16} className="text-green-600 mt-0.5 shrink-0" /> {x}</p>
              ))}
            </div>
            <div className="card p-5 border-red-200">
              <p className="font-medium text-red-700 mb-2 flex items-center gap-2"><Lock size={16} /> EduPay cannot see</p>
              {['What your school collects per term or session', 'Your withdrawals', "Any parent's balance"].map((x) => (
                <p key={x} className="flex gap-2 text-gray-700 py-0.5"><X size={16} className="text-red-500 mt-0.5 shrink-0" /> {x}</p>
              ))}
            </div>
          </div>
          <p className="text-sm text-gray-600">Your revenue is visible only to your own admin and bursar. This is enforced by the system, not just by policy.</p>
        </Block>

        {/* FAQ */}
        <Block id="faq" title="Questions">
          <div className="space-y-3">
            <Faq q="What counts as a student?">Only enrolled student accounts. Admins, bursars, staff and parents are free.</Faq>
            <Faq q="Who pays the service charge?">Parents, only when they pay online, and it is added on top of the fee. The school always receives the full fee. Cash recorded at the school office has no charge.</Faq>
            <Faq q="Is the service charge different after the free pilot?">No. It is the same before and after. When the pilot ends, only your school's own subscription starts.</Faq>
            <Faq q="What happens after the free pilot?">You get a {graceDays}-day grace period. After that, an unpaid school is paused for new work (students, fees, staff, cash entries). Parents can still pay and you can still withdraw and read reports. Nothing is deleted.</Faq>
            <Faq q="Can EduPay see how much our school collects?">No. EduPay sees your school details, your enrolled student count and your subscription status. Revenue is visible only to your own admin and bursar.</Faq>
            <Faq q="Will the price change?">The {naira(minimum)} minimum is the starting price and may be raised as more schools join. We plan to tell schools in advance, by email and on the dashboard, before any increase.</Faq>
          </div>
        </Block>

        {/* CTA */}
        <div className="card p-8 text-center space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Start your free pilot</h2>
          <p className="text-sm text-gray-500">{termDays} days free. Register your school, and we verify it before you start.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/register" className="btn-primary">Register your school</Link>
            {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="btn-secondary"><MessageCircle size={16} /> WhatsApp</a>}
            {phone && <a href={`tel:${phone}`} className="btn-secondary"><Phone size={16} /> {phone}</a>}
            {email && <a href={`mailto:${email}`} className="btn-secondary"><Mail size={16} /> {email}</a>}
          </div>
          {!hasContact && <p className="text-xs text-gray-400">Questions? Use the contact details on the homepage.</p>}
        </div>
      </main>
    </div>
  )
}
