// src/pages/HowItWorks.jsx: public page every school reads BEFORE registering
import { Link } from 'react-router-dom'
import Logo from '../components/Logo'
import { ShieldCheck, Wallet, CalendarClock, PhoneCall, Users } from 'lucide-react'

const Section = ({ icon: Icon, title, children }) => (
  <section className="card p-6">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center"><Icon size={18} className="text-blue-600" /></div>
      <h2 className="font-semibold text-gray-900">{title}</h2>
    </div>
    <div className="text-sm text-gray-600 space-y-3 leading-relaxed">{children}</div>
  </section>
)

const PRICES = [[50, 30000, '(minimum)'], [100, 30000, ''], [300, 90000, ''], [1000, 300000, '']]
const naira = (n) => `₦${n.toLocaleString()}`

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="text-center mb-2">
          <Logo size={56} className="mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">How EduPay works for schools</h1>
          <p className="text-sm text-gray-500 mt-1">Pricing, privacy and subscription, explained before you register.</p>
        </div>

        <Section icon={Wallet} title="What it costs">
          <p><strong>₦300 per student per term, with a minimum of ₦30,000 per term.</strong> Your student count is used only to calculate this subscription. It is never used to estimate your school&apos;s income.</p>
          <table className="w-full text-left text-sm">
            <thead><tr className="text-gray-400 text-xs"><th className="py-1">Students</th><th>Subscription per term</th></tr></thead>
            <tbody>{PRICES.map(([n, p, note]) => (
              <tr key={n} className="border-t border-gray-100"><td className="py-1.5">{n}</td><td>{naira(p)} {note}</td></tr>
            ))}</tbody>
          </table>
          <p>Parents pay a small service charge on top of the school fee: 1.5% + ₦100 per transfer, capped at ₦2,000 and waived for transfers of ₦2,500 or less. <strong>Your school always receives the full fee.</strong> Cash you record at the school office carries no charge.</p>
        </Section>

        <Section icon={Users} title="How your student numbers are counted">
          <p>You are <strong>never asked to declare a number</strong>. EduPay counts the students you enrol in the system.</p>
          <p><strong>If your numbers change during a term:</strong> nothing extra is charged straight away. Your next subscription is based on the highest number of active students you had since your last payment. For example, you start a term with 150 students and enrol 20 more: the next term is billed for 170. Deactivating students just before billing day does not lower that bill.</p>
        </Section>

        <Section icon={ShieldCheck} title="Privacy: what EduPay can and cannot see">
          <div className="grid grid-cols-2 gap-4">
            <div><p className="font-medium text-gray-900 mb-1">EduPay can see</p>
              <ul className="list-disc ml-4 space-y-1"><li>Your school name and contact details</li><li>How many students are enrolled</li><li>Your subscription status</li></ul></div>
            <div><p className="font-medium text-gray-900 mb-1">EduPay cannot see</p>
              <ul className="list-disc ml-4 space-y-1"><li>What your school collects per term or session</li><li>Your withdrawals</li><li>Any parent&apos;s balance</li></ul></div>
          </div>
          <p>Your revenue is visible only to your own admin and bursar. This is enforced by the system, not just by policy.</p>
        </Section>

        <Section icon={Wallet} title="How parents pay">
          <p>Every student gets their own bank account number. A parent transfers from any Nigerian bank, and EduPay matches the payment to the right child and fee automatically. Your bursar can also record cash and bank-teller payments. Parents get an email receipt for every payment and a reminder before a fee is due. Withdrawals go to your school&apos;s own bank account.</p>
        </Section>

        <Section icon={CalendarClock} title="Free pilot and subscription conditions">
          <ul className="list-disc ml-4 space-y-1">
            <li><strong>120 days free</strong>, starting the day EduPay approves your school.</li>
            <li>After that, a <strong>7-day grace period</strong> while you pay the subscription by bank transfer.</li>
            <li>If the subscription is still unpaid, your school is paused: you cannot enrol students, create or assign fees, add staff or record cash. <strong>Parents can still pay</strong>, payments are still matched, and you can still withdraw and read reports.</li>
            <li>Once EduPay records your transfer, everything reopens immediately.</li>
          </ul>
        </Section>

        <Section icon={PhoneCall} title="Why we approve every school">
          <p>EduPay handles school money, so every school is checked before it starts: you apply, EduPay verifies your school (usually with a phone call to a number we can confirm independently), then approves you. We email you at each step, including the decision, and you can always follow your application on screen even if an email is delayed. Until then you can log in and follow your application, but you cannot enrol students or withdraw money. We may ask you for more information.</p>
        </Section>

        <div className="text-center space-y-3 pt-2">
          <Link to="/register" className="btn-primary">Register your school</Link>
          <p className="text-sm text-gray-500">Already registered? <Link to="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link> · <Link to="/" className="text-blue-600 hover:underline font-medium">Homepage</Link></p>
        </div>
      </div>
    </div>
  )
}
