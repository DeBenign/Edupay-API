import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Menu, X, ArrowRight, ShieldCheck, Zap, Users, Percent, Gift, Wallet } from "lucide-react";
import { Link } from 'react-router-dom'

// ─── Design tokens ───────────────────────────────────────────────
// Ink        #0B1B2B  (dark sections, header, text)
// Paper      #F7F8FA  (page background)
// Ledger     #00B87C  (reconciliation / success accent)
// Naira      #F2A93B  (warmth, discounts, rewards accent)
// Slate      #5B6472  (body copy)
// Line       #E4E7EC  (hairlines / dividers)

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
`;

const mockLedger = [
  { parent: "Chinwe A.", student: "Adaeze O. — JSS2", amount: "₦45,000", bank: "GTBank", status: "Reconciled" },
  { parent: "Bola S.", student: "Tunde S. — Primary 4", amount: "₦28,500", bank: "Opay", status: "Reconciled" },
  { parent: "Emeka N.", student: "Chidi N. — SS1", amount: "₦60,000", bank: "Access Bank", status: "Reconciled" },
  { parent: "Fatima Y.", student: "Amina Y. — JSS3", amount: "₦33,200", bank: "Kuda", status: "Reconciled" },
  { parent: "Ifeoma K.", student: "Obi K. — Primary 6", amount: "₦52,000", bank: "Moniepoint", status: "Reconciled" },
];

function LedgerTicker() {
  const [visible, setVisible] = useState([0, 1, 2]);
  const [pulse, setPulse] = useState(null);
  const idxRef = useRef(3);

  useEffect(() => {
    const t = setInterval(() => {
      const next = idxRef.current % mockLedger.length;
      idxRef.current += 1;
      setVisible((v) => [...v.slice(1), next]);
      setPulse(next);
      setTimeout(() => setPulse(null), 900);
    }, 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="rounded-2xl border border-[#1F3247] bg-[#0F2135] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1F3247]">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#00B87C]" />
          <span className="text-[13px] text-[#9FB0C0] font-medium" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Live reconciliation
          </span>
        </div>
        <span className="text-[11px] text-[#5B7085]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          EDUPAY-LEDGER
        </span>
      </div>
      <div className="divide-y divide-[#16283C]">
        {visible.map((i, row) => {
          const entry = mockLedger[i];
          const isPulsing = pulse === i;
          return (
            <div
              key={`${i}-${row}`}
              className={`px-5 py-4 flex items-center justify-between transition-all duration-700 ${
                isPulsing ? "bg-[#0D2A22]" : ""
              }`}
            >
              <div>
                <p className="text-[14px] text-[#E7EDF3] font-medium">{entry.parent}</p>
                <p className="text-[12px] text-[#6E8296]">{entry.student} · via {entry.bank}</p>
              </div>
              <div className="text-right">
                <p className="text-[14px] text-[#E7EDF3]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                  {entry.amount}
                </p>
                <p className="text-[11px] text-[#00B87C] font-medium">✓ {entry.status}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function LoginMenu({ mobile = false }) {
  const [open, setOpen] = useState(false)

  const portals = [
    { label: 'Admin', href: '/login/admin' },
    { label: 'Bursar', href: '/login/bursar' },
    { label: 'Parent', href: '/login/parent' },
  ]

  if (mobile) {
    return (
      <div className="flex flex-col gap-2 mt-2">
        {portals.map((p) => (
          <Link
            key={p.label}
            to={p.href}
            className="px-4 py-2 rounded-lg bg-[#132840] text-[#E7EDF3] text-sm font-medium"
          >
            {p.label} login
          </Link>
        ))}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#00B87C] text-[#0B1B2B] text-sm font-semibold hover:bg-[#00A46E] transition-colors"
      >
        Log in
        <ChevronDown
          size={15}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-xl bg-[#0F2135] border border-[#1F3247] shadow-xl overflow-hidden z-20">
          {portals.map((p) => (
            <Link
              key={p.label}
              to={p.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm text-[#E7EDF3] hover:bg-[#16283C] transition-colors"
            >
              {p.label} portal
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const [navOpen, setNavOpen] = useState(false);
  const navLinks = [
    { label: "About", href: "#about" },
    { label: "How it works", href: "#how-it-works" },
    { label: "For schools", href: "#features" },
    { label: "Pricing & privacy", href: "/how-it-works" },
    { label: "Contact", href: "#contact" },
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{FONT_IMPORT}</style>

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#0B1B2B] border-b border-[#16283C]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <span
              className="text-[20px] font-bold text-white tracking-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Edu<span className="text-[#00B87C]">Pay</span>
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((l) => (
              <a key={l.label} href={l.href} className="text-[14px] text-[#B7C4D1] hover:text-white transition-colors">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:block">
            <LoginMenu />
          </div>

          <button className="md:hidden text-white" onClick={() => setNavOpen((o) => !o)}>
            {navOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {navOpen && (
          <div className="md:hidden px-5 pb-5 border-t border-[#16283C]">
            <nav className="flex flex-col gap-3 pt-4">
              {navLinks.map((l) => (
                <a key={l.label} href={l.href} className="text-[14px] text-[#B7C4D1]">
                  {l.label}
                </a>
              ))}
            </nav>
            <LoginMenu mobile />
          </div>
        )}
      </header>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="bg-[#0B1B2B]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-16 pb-24 grid md:grid-cols-2 gap-14 items-center">
          <div>
            <span
              className="inline-block text-[12px] font-medium text-[#00B87C] bg-[#0F2135] border border-[#1F3247] rounded-full px-3 py-1 mb-6"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              NOMBA + PAYSTACK · LIVE VIRTUAL ACCOUNTS
            </span>
            <h1
              className="text-[38px] sm:text-[46px] leading-[1.08] font-bold text-white tracking-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Every student gets an account.
              <br />
              Every payment finds its way home.
            </h1>
            <p className="mt-6 text-[16px] text-[#9FB0C0] max-w-md leading-relaxed">
              Parents pay school fees from any bank, straight into a dedicated virtual account
              for their child. EduPay reconciles it against the fee balance instantly —
              no statements, no manual matching, no chasing bursars.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/login/admin"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#00B87C] text-[#0B1B2B] text-[14px] font-semibold hover:bg-[#00A46E] transition-colors"
              >
                Set up your school <ArrowRight size={16} />
              </Link>
                <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[#2A3F55] text-[#E7EDF3] text-[14px] font-medium hover:border-[#3D5570] transition-colors"
              >
                See how it works
              </a>
            </div>
          </div>

          <LedgerTicker />
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
        <h2
          className="text-[13px] font-semibold text-[#00A46E] tracking-widest uppercase mb-3"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          How it works
        </h2>
        <p className="text-[28px] font-bold text-[#0B1B2B] max-w-lg mb-12" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Three steps, from onboarding to reconciled revenue.
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              n: "01",
              title: "Issue the account",
              body: "Every student is provisioned a dedicated virtual bank account through Nomba or Paystack the moment they're enrolled.",
            },
            {
              n: "02",
              title: "Parent pays, any bank",
              body: "Parents transfer fees from GTBank, Opay, Kuda — whatever they use. No app, no new habit required.",
            },
            {
              n: "03",
              title: "Balance updates itself",
              body: "The payment is matched to the student automatically and reflected in real time across Admin, Bursar, and Parent dashboards.",
            },
          ].map((s) => (
            <div key={s.n} className="border border-[#E4E7EC] rounded-2xl p-6 bg-white">
              <span
                className="text-[13px] text-[#00A46E] font-semibold"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {s.n}
              </span>
              <h3 className="mt-3 text-[17px] font-semibold text-[#0B1B2B]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {s.title}
              </h3>
              <p className="mt-2 text-[14px] text-[#5B6472] leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features / monetization ────────────────────────── */}
      <section id="features" className="bg-[#0F1420] py-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <h2
            className="text-[13px] font-semibold text-[#F2A93B] tracking-widest uppercase mb-3"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            For schools
          </h2>
          <p className="text-[28px] font-bold text-white max-w-lg mb-12" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Built to run a school's finances, not just collect fees.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: ShieldCheck, title: "Dual-gateway reliability", body: "Nomba and Paystack run side by side — switch per school with one toggle." },
              { icon: Zap, title: "Real-time dashboards", body: "Admin, Bursar, and Parent views update live over Socket.io, no refreshing." },
              { icon: Percent, title: "Early-payment discount", body: "10% off for full payment before the due date — automatically applied." },
              { icon: Gift, title: "Referral rewards", body: "Schools and staff earn a waived platform fee or airtime for referrals — claimed self-serve." },
              { icon: Wallet, title: "Transparent revenue", body: "See platform and school revenue by term or session, and withdraw straight to a bank account." },
              { icon: Users, title: "Built for every role", body: "Separate, focused dashboards so admins, bursars, and parents each see only what they need." },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-[#1F2735] bg-[#141B29] p-6">
                <f.icon size={20} className="text-[#00B87C]" />
                <h3 className="mt-4 text-[15px] font-semibold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {f.title}
                </h3>
                <p className="mt-2 text-[13px] text-[#8A96A6] leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About ──────────────────────────────────────────── */}
      <section id="about" className="max-w-4xl mx-auto px-5 sm:px-8 py-20 text-center">
        <p className="text-[28px] font-bold text-[#0B1B2B] leading-snug" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          EduPay was built by Team KudiClass for the DevCareer × Nomba Hackathon —
          to close the gap between a bank transfer and a bursar's spreadsheet.
        </p>
      </section>

      {/* ── CTA ────────────────────────────────────────────── */}
      <section className="bg-[#00B87C]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-14 flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="text-[22px] font-bold text-[#0B1B2B]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Ready to stop matching statements by hand?
          </p>
          <Link
            to="/login/admin"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#0B1B2B] text-white text-[14px] font-semibold whitespace-nowrap"
          >
            Get started <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer id="contact" className="bg-[#0B1B2B] border-t border-[#16283C]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12 flex flex-col sm:flex-row justify-between gap-8">
          <div>
            <span className="text-[18px] font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Edu<span className="text-[#00B87C]">Pay</span>
            </span>
            <p className="mt-2 text-[13px] text-[#6E8296] max-w-xs">
              School fee infrastructure for Nigerian schools. Team KudiClass.
            </p>
          </div>
          <div className="flex gap-12">
            <div>
              <p className="text-[12px] text-[#5B7085] uppercase tracking-wider mb-3" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                Portals
              </p>
              <div className="flex flex-col gap-2 text-[14px] text-[#B7C4D1]">
                <Link to="/login/admin">Admin</Link>
                <Link to="/login/bursar">Bursar</Link>
                <Link to="/login/parent">Parent</Link>
              </div>
            </div>
            <div>
              <p className="text-[12px] text-[#5B7085] uppercase tracking-wider mb-3" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                Contact
              </p>
              <div className="flex flex-col gap-2 text-[14px] text-[#B7C4D1]">
                <a href="mailto:hello@edupay.ng">hello@edupay.ng</a>
                <a href="#about">About</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}