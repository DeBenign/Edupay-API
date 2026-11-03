import React from 'react';
import {interpolate} from 'remotion';
import {C} from './brand';
import {Stage, Reveal, Pill, Logo, useT} from './ui';

const money = (n: number) =>
  '₦' + n.toLocaleString('en-NG', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const ramp = (t: number, at: number, len = 1.2) =>
  interpolate(t, [at, at + len], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

const G = {
  g50: '#f9fafb', g100: '#f3f4f6', g200: '#e5e7eb', g400: '#9ca3af', g500: '#6b7280', g700: '#374151', g900: '#111827',
  blue: '#2563eb', green: '#16a34a', amber: '#d97706', purple: '#9333ea',
};

const Frame: React.FC<{url: string; tag?: boolean; children: React.ReactNode}> = ({url, tag = true, children}) => (
  <div style={{width: '100%', height: 800, background: G.g50, borderRadius: 22, overflow: 'hidden', boxShadow: '0 40px 80px -20px rgba(0,0,0,0.55)', position: 'relative'}}>
    <div style={{height: 56, background: G.g100, display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px', borderBottom: `1px solid ${G.g200}`}}>
      {['#f87171', '#fbbf24', '#4ade80'].map((c) => <div key={c} style={{width: 14, height: 14, borderRadius: 7, background: c}} />)}
      <div style={{marginLeft: 18, background: C.white, borderRadius: 999, padding: '6px 22px', fontSize: 20, color: G.g500, fontWeight: 500}}>{url}</div>
      {tag && <div style={{marginLeft: 'auto'}}><Pill bg="#fef3c7" fg="#92400e" size={18}>Test environment · simulated data</Pill></div>}
    </div>
    <div style={{padding: 26, color: G.g900}}>{children}</div>
  </div>
);

const Caption: React.FC<{items: {from: number; to: number; text: string}[]}> = ({items}) => {
  const {t} = useT();
  const cur = items.find((i) => t >= i.from && t < i.to);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 34, display: 'flex', justifyContent: 'center'}}>
      {cur && (
        <div style={{background: 'rgba(11,23,54,0.88)', color: C.white, fontSize: 38, fontWeight: 700, padding: '14px 34px', borderRadius: 18, border: `2px solid ${C.brand}`}}>
          {cur.text}
        </div>
      )}
    </div>
  );
};

const Card: React.FC<{style?: React.CSSProperties; children: React.ReactNode}> = ({style, children}) => (
  <div style={{background: C.white, border: `1px solid ${G.g200}`, borderRadius: 16, ...style}}>{children}</div>
);

/* ---------------- Bursar dashboard ---------------- */
type Ev = {net?: number; name: string; code: string; cls: string; fee: string; via: string; amount: number; status: 'exact' | 'underpayment'; balance?: number; at: number; note?: string};
const seed: Ev[] = [
  {name: 'Amaka Obi', code: 'STU-0087', cls: 'SS 2', fee: 'Term 1 School Fees', via: 'transfer', amount: 35000, status: 'underpayment', balance: 25000, at: -2, note: '2 min ago'},
  {name: 'Tunde Bakare', code: 'STU-0112', cls: 'JSS 1', fee: 'Term 1 School Fees', via: 'transfer', amount: 60000, status: 'exact', at: -1, note: '9 min ago'},
];
const live: Ev[] = [
  {name: 'Chioma Adeyemi', code: 'STU-0045', cls: 'JSS 2', fee: 'Term 1 School Fees', via: 'transfer', amount: 45787, net: 45000, status: 'exact', at: 6},
  {name: 'Daniel Eze', code: 'STU-0061', cls: 'SS 1', fee: 'Term 1 School Fees', via: 'transfer', amount: 20000, net: 19600, status: 'underpayment', balance: 25400, at: 14},
  {name: 'Zainab Musa', code: 'STU-0133', cls: 'JSS 3', fee: 'Term 1 School Fees', via: 'manual · receipt RCT-0042', amount: 30000, status: 'exact', at: 21},
];

const dot = {exact: '#4ade80', underpayment: '#fbbf24'};
const tag = {exact: {bg: '#f0fdf4', fg: '#15803d', t: 'Exact'}, underpayment: {bg: '#fffbeb', fg: '#b45309', t: 'Underpayment'}};

export const DemoBursar: React.FC = () => {
  const {t} = useT();
  const BASE = 1250000, EXPECTED = 2000000;
  const collected = BASE + live.reduce((a, e) => a + (e.net ?? e.amount) * ramp(t, e.at + 0.3), 0);
  const events = [...live.filter((e) => t >= e.at), ...seed].sort((a, b) => b.at - a.at).slice(0, 4);
  const pct = collected / EXPECTED;
  const stats = [
    {l: 'Total Collected', v: money(collected), c: G.green},
    {l: 'Outstanding', v: money(EXPECTED - collected), c: G.amber},
    {l: 'Total Students', v: '120', c: G.blue},
    {l: 'Overpayments', v: money(0), c: G.purple},
  ];
  return (
    <Stage>
      <Frame url="edupay-web.vercel.app/bursar">
        <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
          <div style={{fontSize: 38, fontWeight: 800}}>Bursar Dashboard</div>
          <div style={{fontSize: 22, color: G.g400}}>Demo School · Live reconciliation</div>
        </div>
        <div style={{display: 'flex', gap: 16, margin: '16px 0'}}>
          {stats.map((s) => (
            <Card key={s.l} style={{flex: 1, padding: '14px 18px', height: 70}}>
              <div style={{fontSize: 18, color: G.g500, fontWeight: 600}}>{s.l}</div>
              <div style={{fontSize: 30, fontWeight: 800, color: s.c}}>{s.v}</div>
            </Card>
          ))}
        </div>
        <Card style={{padding: '14px 20px', marginBottom: 16}}>
          <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700, color: G.g700}}>
            <span>Collection Progress</span><span style={{color: G.blue}}>{Math.round(pct * 100)}%</span>
          </div>
          <div style={{height: 14, background: G.g100, borderRadius: 999, marginTop: 10, overflow: 'hidden'}}>
            <div style={{width: `${pct * 100}%`, height: '100%', background: `linear-gradient(90deg, #3b82f6, ${G.blue})`, borderRadius: 999}} />
          </div>
        </Card>
        <Card style={{overflow: 'hidden'}}>
          <div style={{padding: '12px 20px', borderBottom: `1px solid ${G.g100}`, display: 'flex', alignItems: 'center', gap: 12, fontSize: 22, fontWeight: 700}}>
            Live Payment Feed
            <span style={{width: 12, height: 12, borderRadius: 6, background: '#4ade80', boxShadow: '0 0 0 4px #bbf7d0'}} />
            <span style={{fontSize: 16, background: '#f0fdf4', color: '#15803d', border: '1px solid #dcfce7', borderRadius: 999, padding: '2px 12px', fontWeight: 800}}>LIVE</span>
          </div>
          {events.map((e, i) => {
            const isNew = i === 0 && e.at >= 0;
            const p = isNew ? ramp(t, e.at, 0.6) : 1;
            return (
              <div key={e.code} style={{display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', height: 56, borderBottom: `1px solid ${G.g100}`, opacity: p, transform: `translateY(${(1 - p) * -24}px)`, background: isNew && t < e.at + 2.5 ? '#f5f9ff' : C.white}}>
                <div style={{width: 12, height: 12, borderRadius: 6, background: dot[e.status]}} />
                <div style={{flex: 1}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 10, fontSize: 22, fontWeight: 700}}>
                    {e.name}<span style={{fontSize: 18, color: G.g400, fontWeight: 500}}>· {e.code}</span>
                    <span style={{fontSize: 16, padding: '2px 12px', borderRadius: 999, fontWeight: 700, background: tag[e.status].bg, color: tag[e.status].fg}}>{tag[e.status].t}</span>
                    {isNew && <span style={{fontSize: 16, padding: '2px 12px', borderRadius: 999, fontWeight: 800, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #dbeafe'}}>NEW</span>}
                  </div>
                  <div style={{fontSize: 17, color: G.g400}}>
                    {e.fee} · via {e.via}
                    {e.status === 'underpayment' && e.balance ? <span style={{color: G.amber, fontWeight: 600}}>  ·  Balance: {money(e.balance)}</span> : null}
                  </div>
                </div>
                <div style={{textAlign: 'right'}}>
                  <div style={{fontSize: 24, fontWeight: 800}}>+{money(e.amount)}</div>
                  <div style={{fontSize: 16, color: G.g400}}>{e.note ?? (isNew ? 'just now' : 'moments ago')}</div>
                </div>
              </div>
            );
          })}
        </Card>
      </Frame>
      <Caption items={[
        {from: 0.5, to: 5.5, text: 'Bursar dashboard: live reconciliation'},
        {from: 6, to: 13, text: 'Parent pays by transfer. Matched to Chioma instantly.'},
        {from: 14, to: 20.5, text: 'A short payment is flagged, with the balance'},
        {from: 21, to: 26, text: 'Cash recorded at school joins the same feed'},
      ]} />
    </Stage>
  );
};

/* ---------------- Parent fee balance ---------------- */
export const DemoParent: React.FC = () => {
  const {t} = useT();
  const EXP = 45000;
  const paid = EXP * ramp(t, 3, 1.5);
  const bal = EXP - paid;
  const done = t > 4.6;
  const summary = [
    {l: 'Total Expected', v: money(EXP), c: G.g900},
    {l: 'Total Paid', v: money(paid), c: G.green},
    {l: 'Balance', v: money(bal), c: G.amber},
    {l: 'Overpaid', v: money(0), c: G.purple},
  ];
  return (
    <Stage>
      <Frame url="edupay-web.vercel.app/parent/balance">
        <div style={{fontSize: 38, fontWeight: 800}}>Chioma Adeyemi — Fee Balance</div>
        <div style={{fontSize: 22, color: G.g400, marginBottom: 18}}>JSS 2 · STU-0045</div>
        <div style={{display: 'flex', gap: 16, marginBottom: 18}}>
          {summary.map((s) => (
            <Card key={s.l} style={{flex: 1, padding: 18, textAlign: 'center'}}>
              <div style={{fontSize: 30, fontWeight: 900, color: s.c}}>{s.v}</div>
              <div style={{fontSize: 18, color: G.g400, marginTop: 4}}>{s.l}</div>
            </Card>
          ))}
        </div>
        <Card>
          <div style={{padding: '14px 22px', borderBottom: `1px solid ${G.g100}`, fontSize: 22, fontWeight: 700}}>Term Breakdown</div>
          <div style={{padding: 22}}>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <div>
                <div style={{fontSize: 24, fontWeight: 700}}>Term 1 School Fees</div>
                <div style={{fontSize: 18, color: G.g400}}>1st Term · 2026/2027</div>
              </div>
              <Pill bg={done ? '#dcfce7' : G.g100} fg={done ? '#15803d' : G.g500} size={20}>{done ? 'Paid' : 'Unpaid'}</Pill>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 20, color: G.g500, margin: '16px 0 8px'}}>
              <span>Paid: <strong>{money(paid)}</strong></span><span>of {money(EXP)}</span>
            </div>
            <div style={{height: 14, background: G.g100, borderRadius: 999, overflow: 'hidden'}}>
              <div style={{width: `${(paid / EXP) * 100}%`, height: '100%', background: '#22c55e', borderRadius: 999}} />
            </div>
            {bal > 0 && <div style={{fontSize: 20, color: G.amber, fontWeight: 700, marginTop: 12}}>Balance: {money(bal)}</div>}
          </div>
        </Card>
      </Frame>
      <Reveal at={3.2} from="scale" style={{position: 'absolute', right: 110, top: 700}}>
        <div style={{background: '#16a34a', color: C.white, fontSize: 28, fontWeight: 800, padding: '14px 26px', borderRadius: 16, boxShadow: '0 18px 40px -10px rgba(0,0,0,0.5)'}}>Payment received ✓</div>
      </Reveal>
      <Caption items={[
        {from: 0.5, to: 3, text: 'Parent view: Chioma’s balance'},
        {from: 3.2, to: 13.5, text: 'Balance drops to ₦0. Term shows Paid. No phone call.'},
      ]} />
    </Stage>
  );
};

/* ---------------- Emails ---------------- */
const Mail: React.FC<{label: string; to: string; subject: string; heading: string; paras: React.ReactNode[]; cta: string; at: number}> = ({label, to, subject, heading, paras, cta, at}) => (
  <Reveal at={at} style={{flex: 1}}>
    <div style={{color: C.sky, fontSize: 26, fontWeight: 800, letterSpacing: 3, marginBottom: 12}}>{label}</div>
    <div style={{background: G.g100, borderRadius: 20, overflow: 'hidden', boxShadow: '0 40px 80px -20px rgba(0,0,0,0.55)'}}>
      <div style={{background: C.white, padding: '16px 26px', borderBottom: `1px solid ${G.g200}`, color: G.g900}}>
        <div style={{fontSize: 20, color: G.g500}}>To: {to}</div>
        <div style={{fontSize: 26, fontWeight: 800, marginTop: 4}}>{subject}</div>
      </div>
      <div style={{padding: 22}}>
        <div style={{background: C.white, borderRadius: 14, padding: 28, color: G.g900}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14}}>
            <Logo size={40} />
            <div style={{fontSize: 22, fontWeight: 800, color: C.brand}}>EduPay</div>
          </div>
          <div style={{fontSize: 30, fontWeight: 800, marginBottom: 14, lineHeight: 1.25}}>{heading}</div>
          {paras.map((p, i) => <div key={i} style={{fontSize: 21, lineHeight: 1.55, color: G.g700, marginBottom: 12}}>{p}</div>)}
          <div style={{display: 'inline-block', background: C.brand, color: C.white, fontSize: 21, fontWeight: 800, padding: '12px 24px', borderRadius: 10, marginTop: 6}}>{cta}</div>
        </div>
      </div>
    </div>
  </Reveal>
);

export const DemoReceipt: React.FC = () => (
  <Stage>
    <div style={{display: 'flex', gap: 40}}>
      <Mail at={0.4} label="BANK TRANSFER RECEIPT" to="Parent of Chioma Adeyemi" subject="Payment received for Chioma Adeyemi" heading="Payment received, thank you" cta="Open EduPay"
        paras={[
          <>Hi Mrs. Adeyemi, we received <b>₦45,787</b> for Chioma Adeyemi (STU-0045) at Demo School.</>,
          <>Applied to: Term 1 School Fees. Amount applied to the fee: <b>₦45,000</b>. Service charge: ₦787 (the school receives the full fee).</>,
          'This fee is now fully paid. Thank you.',
          'Reference: NMB-84213907. Date: 31 October 2026.',
        ]} />
      <Mail at={3.2} label="CASH RECEIPT (RECORDED BY BURSAR)" to="Parent of Zainab Musa" subject="Payment received for Zainab Musa" heading="Payment received, thank you" cta="Open EduPay"
        paras={[
          <>Hi Mr. Musa, the school office recorded <b>₦30,000</b> for Zainab Musa (STU-0133) at Demo School.</>,
          <>Applied to: Term 1 School Fees. Amount applied to the fee: <b>₦30,000</b>.</>,
          'This fee is now fully paid. Thank you.',
          'Reference: RCT-0042. Date: 31 October 2026.',
        ]} />
    </div>
    <Caption items={[
      {from: 0.5, to: 3.2, text: 'Parent gets a receipt email, automatically'},
      {from: 3.4, to: 12, text: 'Cash recorded at school gets a receipt too'},
    ]} />
  </Stage>
);

export const DemoApproval: React.FC = () => (
  <Stage>
    <div style={{display: 'flex', gap: 40}}>
      <Mail at={0.4} label="1 · EDUPAY IS EMAILED" to="EduPay owner" subject="New school application: Demo School" heading="A school applied to join EduPay" cta="Review application"
        paras={[
          <><b>Demo School</b> (12 Example Road, Abuja).</>,
          'Applicant: Mrs. Ngozi Adebayo, Principal. School phone: 08030000000.',
          'Verify the school before approving.',
        ]} />
      <Mail at={5.6} label="2 · SCHOOL IS APPROVED" to="Mrs. Ngozi Adebayo" subject="Your school is approved on EduPay" heading="Demo School is approved" cta="Open EduPay"
        paras={[
          <>Hi Ngozi, <b>Demo School</b> has been verified and approved. Your free pilot runs until <b>29 January 2027</b>.</>,
          'You can now enrol students, set up fees and save your payout account.',
        ]} />
    </div>
    <Caption items={[
      {from: 0.5, to: 5.4, text: 'Every school is verified before it starts'},
      {from: 5.8, to: 14, text: 'Approved: the school gets its free pilot dates'},
    ]} />
  </Stage>
);

/* ---------------- Onboarding scenes (mirror Register / Login / Students / Children) ---------------- */
const typed = (t: number, start: number, text: string, cps = 16) =>
  text.slice(0, Math.max(0, Math.min(text.length, Math.floor((t - start) * cps))));

const Fld: React.FC<{label: string; value: string; mono?: boolean; active?: boolean; style?: React.CSSProperties}> = ({label, value, mono, active, style}) => (
  <div style={{flex: 1, ...style}}>
    <div style={{fontSize: 19, fontWeight: 600, color: G.g700, marginBottom: 6}}>{label}</div>
    <div style={{boxSizing: 'border-box', height: 52, lineHeight: '32px', border: `2px solid ${active ? G.blue : G.g200}`, borderRadius: 10, padding: '8px 16px', fontSize: 23, fontFamily: mono ? 'monospace' : undefined, color: G.g900, background: C.white, whiteSpace: 'nowrap', overflow: 'hidden'}}>
      {value}
      {active && <span style={{borderLeft: `2px solid ${G.blue}`, marginLeft: 1}} />}
    </div>
  </div>
);

const Btn: React.FC<{label: string; on?: boolean; color?: string; style?: React.CSSProperties}> = ({label, on, color = G.blue, style}) => (
  <div style={{background: on ? '#1d4ed8' : color, color: C.white, fontSize: 24, fontWeight: 700, padding: '14px 0', borderRadius: 12, textAlign: 'center', transform: on ? 'scale(0.97)' : 'none', ...style}}>{label}</div>
);

const Toast: React.FC<{at: number; until: number; children: React.ReactNode}> = ({at, until, children}) => {
  const {t} = useT();
  if (t < at || t > until) return null;
  const p = ramp(t, at, 0.4);
  return (
    <div style={{position: 'absolute', right: 30, top: 80, opacity: p, transform: `translateY(${(1 - p) * -20}px)`, background: '#16a34a', color: C.white, fontSize: 24, fontWeight: 700, padding: '14px 24px', borderRadius: 14, boxShadow: '0 18px 40px -10px rgba(0,0,0,0.4)', maxWidth: 640}}>
      {children}
    </div>
  );
};

const Overlay: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{position: 'absolute', left: 0, right: 0, top: 56, bottom: 0, background: 'rgba(17,24,39,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{children}</div>
);

const AuthShell: React.FC<{title: string; sub: string; children: React.ReactNode}> = ({title, sub, children}) => (
  <div style={{width: 800}}>
    <div style={{textAlign: 'center', marginBottom: 14}}>
      <div style={{display: 'flex', justifyContent: 'center'}}><Logo size={52} /></div>
      <div style={{fontSize: 32, fontWeight: 800, marginTop: 6}}>EduPay</div>
      <div style={{fontSize: 19, color: G.g500}}>School Fee Management</div>
    </div>
    <Card style={{padding: 26}}>
      <div style={{fontSize: 24, fontWeight: 700, marginBottom: 14}}>{title}</div>
      {children}
    </Card>
    <div style={{textAlign: 'center', fontSize: 18, color: G.g500, marginTop: 10}}>{sub}</div>
  </div>
);

export const DemoRegister: React.FC = () => {
  const {t} = useT();
  const sent = t > 8.2;
  return (
    <Stage>
      <Frame url="edupay-web.vercel.app/register">
        <div style={{display: 'flex', justifyContent: 'center'}}>
          <AuthShell title="Create your account" sub="Already have an account? Sign in, How it works">
            <div style={{display: 'flex', gap: 12, marginBottom: 14}}>
              {[['Register a school', 'For owners and administrators', true], ["I'm a parent", 'To pay and track fees', false]].map(([a, b, on]) => (
                <div key={a as string} style={{flex: 1, border: `2px solid ${on ? G.blue : G.g200}`, background: on ? '#eff6ff' : C.white, borderRadius: 12, padding: '10px 16px'}}>
                  <div style={{fontSize: 21, fontWeight: 700}}>{a}</div>
                  <div style={{fontSize: 16, color: G.g500}}>{b}</div>
                </div>
              ))}
            </div>
            <div style={{display: 'flex', gap: 14, marginBottom: 12}}>
              <Fld label="Full name" value={typed(t, 0.8, 'Ngozi Adebayo')} active={t > 0.8 && t < 2.2} />
              <Fld label="Phone number" value={typed(t, 4.6, '08030000000')} active={t > 4.6 && t < 5.7} />
            </div>
            <div style={{display: 'flex', gap: 14, marginBottom: 12}}>
              <Fld label="Email address" value={typed(t, 2.3, 'principal@demoschool.ng')} active={t > 2.3 && t < 4.5} />
              <Fld label="Password" value={'•'.repeat(Math.floor(Math.max(0, Math.min(10, (t - 5.9) * 14))))} active={t > 5.9 && t < 6.8} />
            </div>
            <div style={{background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 12, padding: '10px 16px', fontSize: 17, color: '#1e40af', marginBottom: 12}}>
              EduPay verifies every school before it starts, usually with a phone call, and emails you the decision.
              <div style={{marginTop: 8, color: G.g700, display: 'flex', gap: 10, alignItems: 'center'}}>
                <span style={{width: 20, height: 20, border: `2px solid ${G.blue}`, borderRadius: 5, background: t > 7.1 ? G.blue : C.white, color: C.white, fontSize: 15, textAlign: 'center', lineHeight: '18px'}}>{t > 7.1 ? '✓' : ''}</span>
                I have read how EduPay pricing, privacy and subscription work.
              </div>
            </div>
            {sent
              ? <div style={{background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: 22, fontWeight: 700, padding: '14px 18px', borderRadius: 12, textAlign: 'center'}}>Check your email to confirm your address ✓</div>
              : <Btn label="Create account" on={t > 7.7} />}
          </AuthShell>
        </div>
      </Frame>
      <Caption items={[
        {from: 0.5, to: 7, text: 'A school registers in minutes'},
        {from: 7.2, to: 10, text: 'Confirm email, then EduPay verifies the school'},
      ]} />
    </Stage>
  );
};

const stuRows = [
  {n: 'Tunde Bakare', id: 'DS/2026/012', c: 'JSS 1', acc: '9087650112'},
  {n: 'Amaka Obi', id: 'DS/2026/087', c: 'SS 2', acc: '9087650387'},
];

export const DemoLoginEnrol: React.FC = () => {
  const {t} = useT();
  const login = t < 4;
  const modal = t >= 5 && t < 11.6;
  const added = t >= 11.6;
  const provisioned = t >= 13.4;
  return (
    <Stage>
      <Frame url={login ? 'edupay-web.vercel.app/login' : 'edupay-web.vercel.app/admin/students'}>
        {login ? (
          <div style={{display: 'flex', justifyContent: 'center'}}>
            <AuthShell title="Admin sign in" sub="Don't have an account? Register">
              <div style={{marginBottom: 14}}><Fld label="Email address" value={typed(t, 0.5, 'principal@demoschool.ng', 22)} active={t > 0.5 && t < 1.8} /></div>
              <div style={{marginBottom: 16}}><Fld label="Password" value={'•'.repeat(Math.floor(Math.max(0, Math.min(10, (t - 1.9) * 14))))} active={t > 1.9 && t < 2.7} /></div>
              <Btn label={t > 3.2 ? 'Signing in…' : 'Sign in'} on={t > 3} />
            </AuthShell>
          </div>
        ) : (
          <>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16}}>
              <div style={{fontSize: 38, fontWeight: 800}}>Students</div>
              <div style={{background: G.blue, color: C.white, fontSize: 22, fontWeight: 700, padding: '10px 22px', borderRadius: 12}}>+ Enroll Student</div>
            </div>
            <Card style={{overflow: 'hidden'}}>
              <div style={{display: 'flex', padding: '12px 22px', background: G.g50, fontSize: 17, fontWeight: 700, color: G.g500, letterSpacing: 1}}>
                <div style={{flex: 2}}>STUDENT</div><div style={{flex: 1}}>CLASS</div><div style={{flex: 2}}>VIRTUAL ACCOUNT</div><div style={{flex: 1}}>STATUS</div>
              </div>
              {[...(added ? [{n: 'Chioma Adeyemi', id: 'DS/2026/045', c: 'JSS 2', acc: provisioned ? '9087650045' : ''}] : []), ...stuRows].map((r) => (
                <div key={r.id} style={{display: 'flex', alignItems: 'center', padding: '14px 22px', borderTop: `1px solid ${G.g100}`, fontSize: 22}}>
                  <div style={{flex: 2}}><b>{r.n}</b><div style={{fontSize: 16, color: G.g400}}>{r.id}</div></div>
                  <div style={{flex: 1}}>{r.c}</div>
                  <div style={{flex: 2, fontFamily: 'monospace', fontWeight: 700}}>
                    {r.acc || <span style={{fontFamily: 'inherit', color: G.amber, fontWeight: 600}}>Provisioning…</span>}
                  </div>
                  <div style={{flex: 1}}><Pill bg="#dcfce7" fg="#15803d" size={17}>Active</Pill></div>
                </div>
              ))}
            </Card>
            {modal && (
              <Overlay>
                <Card style={{width: 760, padding: 26}}>
                  <div style={{fontSize: 28, fontWeight: 800, marginBottom: 14}}>Enroll New Student</div>
                  <div style={{display: 'flex', gap: 14, marginBottom: 12}}>
                    <Fld label="Full Name" value={typed(t, 5.6, 'Chioma Adeyemi')} active={t > 5.6 && t < 6.9} />
                    <Fld label="Student ID" value={typed(t, 7, 'DS/2026/045')} active={t > 7 && t < 8} />
                  </div>
                  <div style={{display: 'flex', gap: 14, marginBottom: 12}}>
                    <Fld label="Class" value={typed(t, 8.1, 'JSS 2')} active={t > 8.1 && t < 9} />
                    <Fld label="Gender" value={t > 9.1 ? 'Female' : 'Male'} />
                  </div>
                  <div style={{background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 10, padding: '10px 16px', fontSize: 18, color: '#1d4ed8', marginBottom: 14}}>
                    Nomba and Paystack virtual accounts will be automatically provisioned for this student upon enrollment.
                  </div>
                  <Btn label="Enroll Student" on={t > 10.6} />
                </Card>
              </Overlay>
            )}
            <Toast at={11.7} until={15}>Chioma Adeyemi enrolled successfully! Parent code: K7MX-4Q2A</Toast>
          </>
        )}
      </Frame>
      <Caption items={[
        {from: 0.5, to: 3.9, text: 'Approved: the principal signs in'},
        {from: 4.2, to: 11.4, text: 'Enrol a student: name, ID, class'},
        {from: 11.8, to: 15, text: 'Virtual accounts are provisioned automatically'},
      ]} />
    </Stage>
  );
};

const gw = [
  {g: 'NOMBA', num: '9087650045', bank: 'Nombank MFB (test)'},
  {g: 'PAYSTACK', num: '9912340045', bank: 'Test Bank (Paystack)'},
];

export const DemoAccounts: React.FC = () => {
  const {t} = useT();
  const copied = t > 8.5;
  return (
    <Stage>
      <Frame url="edupay-web.vercel.app/admin/students">
        <div style={{fontSize: 38, fontWeight: 800, marginBottom: 16}}>Students</div>
        <Card style={{height: 200}}><div /></Card>
        <Overlay>
          <Card style={{width: 820, padding: 26}}>
            <div style={{fontSize: 28, fontWeight: 800}}>Virtual Account Details</div>
            <div style={{fontSize: 18, color: G.g500, margin: '6px 0 12px'}}>Share these account numbers with parents. Payments reconcile automatically.</div>
            <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 20, marginBottom: 12}}>
              <span style={{color: G.g500}}>Student</span><b>Chioma Adeyemi · DS/2026/045</b>
            </div>
            <Reveal at={1.0} style={{background: G.g50, borderRadius: 12, padding: '12px 18px', marginBottom: 12}}>
              <div style={{fontSize: 16, color: G.g500}}>Parent link code</div>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <span style={{fontFamily: 'monospace', fontWeight: 800, fontSize: 32}}>K7MX-4Q2A</span>
                <span style={{fontSize: 17, fontWeight: 700, padding: '6px 16px', border: `1px solid ${G.g200}`, borderRadius: 8, background: C.white}}>Copy</span>
              </div>
            </Reveal>
            {gw.map((o, i) => (
              <Reveal key={o.g} at={2.4 + i * 1.8} style={{background: G.g50, borderRadius: 12, padding: '12px 18px', marginBottom: 12}}>
                <div style={{fontSize: 15, letterSpacing: 2, fontWeight: 700, color: G.g400}}>{o.g}</div>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 19, margin: '4px 0'}}><span style={{color: G.g500}}>Account Name</span><b>Demo School / Chioma Adeyemi</b></div>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 19}}>
                  <span style={{color: G.g500}}>Account Number</span>
                  <span style={{fontFamily: 'monospace', fontWeight: 800, fontSize: 30}}>{o.num} {copied && i === 0 ? <span style={{color: G.green, fontSize: 22}}>✓</span> : null}</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 19}}><span style={{color: G.g500}}>Bank</span><b>{o.bank}</b></div>
              </Reveal>
            ))}
          </Card>
        </Overlay>
      </Frame>
      <Caption items={[
        {from: 0.5, to: 2.3, text: 'Every student gets their own account numbers'},
        {from: 2.4, to: 6.5, text: 'Two gateways: pay into either'},
        {from: 6.6, to: 12, text: 'Share the numbers and the parent link code'},
      ]} />
    </Stage>
  );
};

export const DemoParentLink: React.FC = () => {
  const {t} = useT();
  const linked = t >= 5.6;
  const copied = t > 10;
  return (
    <Stage>
      <Frame url="edupay-web.vercel.app/parent/children">
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16}}>
          <div style={{fontSize: 38, fontWeight: 800}}>My Children</div>
          <div style={{background: G.blue, color: C.white, fontSize: 22, fontWeight: 700, padding: '10px 22px', borderRadius: 12}}>+ Link child</div>
        </div>
        {!linked && (
          <Reveal at={0.5}>
            <Card style={{padding: 26}}>
              <div style={{fontSize: 24, fontWeight: 700, marginBottom: 6}}>Link your child</div>
              <div style={{fontSize: 18, color: G.g500, marginBottom: 14}}>Enter the code your school gave you.</div>
              <div style={{display: 'flex', gap: 14, alignItems: 'flex-end'}}>
                <Fld label="Link code" mono value={typed(t, 1.6, 'K7MX-4Q2A', 6)} active={t > 1.6 && t < 3.3} />
                <Btn label="Link" on={t > 4.4} style={{width: 160}} />
              </div>
            </Card>
          </Reveal>
        )}
        {linked && (
          <Reveal at={5.6}>
            <Card style={{overflow: 'hidden'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 14, padding: '16px 22px', borderBottom: `1px solid ${G.g100}`}}>
                <div style={{width: 48, height: 48, borderRadius: 24, background: '#fce7f3'}} />
                <div><div style={{fontSize: 26, fontWeight: 800}}>Chioma Adeyemi</div><div style={{fontSize: 17, color: G.g400}}>JSS 2 · DS/2026/045</div></div>
              </div>
              <div style={{padding: '14px 22px', background: G.g50}}>
                <div style={{fontSize: 16, fontWeight: 700, color: G.g400, letterSpacing: 1.5, marginBottom: 8}}>PAYMENT ACCOUNTS (PAY INTO EITHER)</div>
                {gw.map((o, i) => (
                  <div key={o.g} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0'}}>
                    <div><span style={{fontFamily: 'monospace', fontWeight: 800, fontSize: 30}}>{o.num}</span><span style={{fontSize: 17, color: G.g400, marginLeft: 10}}>· {o.bank}</span></div>
                    <span style={{fontSize: 19, fontWeight: 700, color: copied && i === 0 ? G.green : G.blue}}>{copied && i === 0 ? '✓ Copied' : 'Copy'}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
        )}
        <Toast at={5.7} until={9}>Child linked successfully</Toast>
      </Frame>
      <Caption items={[
        {from: 0.5, to: 5.4, text: 'Parent enters the school’s link code'},
        {from: 5.8, to: 13, text: 'Account numbers appear, ready to copy'},
      ]} />
    </Stage>
  );
};

/* ---------------- Policy scenes (mirror HowItWorks.jsx and README pricing) ---------------- */
const SecTitle: React.FC<{children: React.ReactNode; color?: string}> = ({children, color = G.g900}) => (
  <div style={{fontSize: 28, fontWeight: 800, color, marginBottom: 12}}>{children}</div>
);

const Li: React.FC<{ok: boolean; at: number; children: React.ReactNode}> = ({ok, at, children}) => (
  <Reveal at={at} style={{display: 'flex', alignItems: 'center', gap: 14, fontSize: 25, fontWeight: 600, padding: '10px 0'}}>
    <span style={{width: 34, height: 34, borderRadius: 17, background: ok ? '#dcfce7' : '#fee2e2', color: ok ? '#15803d' : '#b91c1c', textAlign: 'center', lineHeight: '34px', fontSize: 22, fontWeight: 800, flexShrink: 0}}>{ok ? '✓' : '✕'}</span>
    {children}
  </Reveal>
);

export const DemoPrivacy: React.FC = () => (
  <Stage>
    <Frame url="edupay-web.vercel.app/pricing" tag={false}>
      <div style={{fontSize: 38, fontWeight: 800}}>Privacy: what EduPay can and cannot see</div>
      <div style={{fontSize: 21, color: G.g500, margin: '4px 0 18px'}}>Pricing, privacy and subscription, explained before you register.</div>
      <div style={{display: 'flex', gap: 20}}>
        <Reveal at={0.6} style={{flex: 1}}>
          <Card style={{padding: 26, height: 360, border: '2px solid #bbf7d0'}}>
            <SecTitle color="#15803d">EduPay can see</SecTitle>
            <Li ok at={1.4}>Your school name and contact details</Li>
            <Li ok at={2.4}>How many students are enrolled</Li>
            <Li ok at={3.4}>Your subscription status</Li>
          </Card>
        </Reveal>
        <Reveal at={4.4} style={{flex: 1}}>
          <Card style={{padding: 26, height: 360, border: '2px solid #fecaca'}}>
            <SecTitle color="#b91c1c">EduPay cannot see</SecTitle>
            <Li ok={false} at={5.2}>What your school collects per term or session</Li>
            <Li ok={false} at={6.2}>Your withdrawals</Li>
            <Li ok={false} at={7.2}>Any parent's balance</Li>
          </Card>
        </Reveal>
      </div>
      <Reveal at={8.6} style={{marginTop: 18}}>
        <div style={{background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: 14, padding: '16px 22px', fontSize: 24, fontWeight: 600}}>
          Your revenue is visible only to your own admin and bursar. This is enforced by the system, not just by policy.
        </div>
      </Reveal>
    </Frame>
    <Caption items={[
      {from: 0.5, to: 4.2, text: 'What EduPay can see'},
      {from: 4.4, to: 8.4, text: 'What EduPay cannot see'},
      {from: 8.6, to: 14, text: 'Enforced by the system, not just by policy'},
    ]} />
  </Stage>
);

const charges: [string, string, string, string][] = [['₦1,000', '₦1,015', '₦15', '₦1,000'], ['₦10,000', '₦10,254', '₦254', '₦10,000'], ['₦100,000', '₦101,624', '₦1,624', '₦100,000']];

export const DemoPricing: React.FC = () => {
  const {t} = useT();
  const phaseA = t < 10.8;
  const entered = typed(t, 4.6, '150', 4);
  const n = entered ? parseInt(entered, 10) : 0;
  const fee = Math.max(30000, n * 300);
  return (
    <Stage>
      <Frame url="edupay-web.vercel.app/pricing" tag={false}>
        {phaseA ? (
          <>
            <Reveal at={0.2}>
              <div style={{fontSize: 42, fontWeight: 800, letterSpacing: -1}}>Simple pricing. Pay per student, once a term.</div>
              <div style={{fontSize: 22, color: G.g500, margin: '6px 0 16px'}}>One price, every feature. No setup fee, and no card needed to start.</div>
            </Reveal>
            <div style={{display: 'flex', gap: 16, marginBottom: 16}}>
              <Reveal at={1.0} style={{flex: 1}}>
                <div style={{background: G.blue, color: C.white, borderRadius: 16, padding: 20, height: 150}}>
                  <div style={{fontSize: 19, opacity: 0.85}}>First 90 days</div>
                  <div style={{fontSize: 44, fontWeight: 800}}>Free</div>
                  <div style={{fontSize: 16, opacity: 0.85}}>The clock starts the day EduPay approves you.</div>
                </div>
              </Reveal>
              <Reveal at={2.0} style={{flex: 1}}>
                <Card style={{padding: 20, height: 150}}>
                  <div style={{fontSize: 19, color: G.g500}}>After that</div>
                  <div style={{fontSize: 44, fontWeight: 800}}>₦300</div>
                  <div style={{fontSize: 16, color: G.g500}}>per student, per term</div>
                </Card>
              </Reveal>
              <Reveal at={3.0} style={{flex: 1}}>
                <Card style={{padding: 20, height: 150}}>
                  <div style={{fontSize: 19, color: G.g500}}>Smallest fee</div>
                  <div style={{fontSize: 44, fontWeight: 800}}>₦30,000</div>
                  <div style={{fontSize: 16, color: G.g500}}>per term, however small the school</div>
                </Card>
              </Reveal>
            </div>
            <Reveal at={4.0}>
              <Card style={{padding: 22}}>
                <div style={{fontSize: 24, fontWeight: 800}}>Work out your fee</div>
                <div style={{fontSize: 17, color: G.g500, margin: '2px 0 12px'}}>Students × ₦300 = your fee for the term (never below ₦30,000).</div>
                <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                  <span style={{fontSize: 20, color: G.g700}}>How many students?</span>
                  <div style={{width: 120, height: 46, boxSizing: 'border-box', border: `2px solid ${G.blue}`, borderRadius: 10, padding: '6px 14px', fontSize: 24, lineHeight: '30px'}}>{entered}</div>
                  <span style={{fontSize: 44, fontWeight: 800, marginLeft: 12}}>{n > 0 ? money(fee).replace('.00', '') : ''}</span>
                  <span style={{fontSize: 20, color: G.g500}}>{n > 0 ? 'per term' : ''}</span>
                </div>
                <div style={{marginTop: 10}}>
                  {[['50 students', '₦30,000'], ['300 students', '₦90,000'], ['1,000 students', '₦300,000']].map(([a, b], i) => (
                    <Reveal key={a} at={7.2 + i * 0.8} style={{display: 'flex', justifyContent: 'space-between', fontSize: 21, padding: '7px 0', borderTop: `1px solid ${G.g100}`}}>
                      <span style={{color: G.g700}}>{a}</span><b>{b} per term</b>
                    </Reveal>
                  ))}
                </div>
              </Card>
            </Reveal>
          </>
        ) : (
          <Reveal at={11.0}>
            <Card style={{padding: 26}}>
              <div style={{fontSize: 32, fontWeight: 800, marginBottom: 6}}>The parent service charge</div>
              <div style={{fontSize: 22, color: G.g700, lineHeight: 1.45, marginBottom: 14}}>
                Parents who pay online add a small charge on top of the fee: <b>1.5% + ₦100</b> per transfer, capped at ₦2,000. The ₦100 part is not charged on transfers of ₦2,500 or less. <b>The school always receives the full fee.</b>
              </div>
              <div style={{display: 'flex', padding: '8px 0', fontSize: 16, fontWeight: 700, color: G.g400, borderBottom: `1px solid ${G.g200}`}}>
                <div style={{flex: 1}}>SCHOOL FEE</div><div style={{flex: 1.2}}>PARENT TRANSFERS</div><div style={{flex: 1}}>CHARGE</div><div style={{flex: 1.2}}>SCHOOL RECEIVES</div>
              </div>
              {charges.map((r, i) => (
                <Reveal key={r[0]} at={12.0 + i * 1.0} style={{display: 'flex', padding: '10px 0', fontSize: 24, borderBottom: `1px solid ${G.g100}`}}>
                  <div style={{flex: 1}}>{r[0]}</div><div style={{flex: 1.2, fontWeight: 700}}>{r[1]}</div><div style={{flex: 1, color: G.amber, fontWeight: 700}}>{r[2]}</div><div style={{flex: 1.2, fontWeight: 800, color: G.green}}>{r[3]}</div>
                </Reveal>
              ))}
              <Reveal at={16.2} style={{display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap'}}>
                <Pill bg="#f0fdf4" fg="#15803d" border="#bbf7d0" size={21}>School receives the full fee</Pill>
                <Pill bg="#eff6ff" fg="#1d4ed8" border="#bfdbfe" size={21}>Cash at the school office: no charge</Pill>
                <Pill bg="#fffbeb" fg="#b45309" border="#fcd34d" size={21}>Same during and after the pilot</Pill>
              </Reveal>
            </Card>
          </Reveal>
        )}
      </Frame>
      <Caption items={[
        {from: 0.5, to: 4, text: '90 days free, then ₦300 per student per term'},
        {from: 4.2, to: 10.6, text: 'Work out your fee: minimum ₦30,000'},
        {from: 11.2, to: 22, text: 'Parents pay a small charge. The school gets the full fee.'},
      ]} />
    </Stage>
  );
};

export const DemoPilot: React.FC = () => {
  const {t} = useT();
  const prog = ramp(t, 1, 8);
  const seg = [{w: 60, bg: '#22c55e', l: '90 days free'}, {w: 10, bg: '#f59e0b', l: '7-day grace'}, {w: 30, bg: '#ef4444', l: 'Paused until paid'}];
  return (
    <Stage>
      <Frame url="edupay-web.vercel.app/pricing" tag={false}>
        <div style={{fontSize: 38, fontWeight: 800}}>Free pilot and subscription</div>
        <div style={{margin: '18px 0 4px', height: 40, display: 'flex', borderRadius: 12, overflow: 'hidden', background: G.g200, position: 'relative'}}>
          {seg.map((x) => <div key={x.l} style={{width: `${x.w}%`, background: x.bg, opacity: 0.35}} />)}
          <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${prog * 100}%`, display: 'flex', overflow: 'hidden'}}>
            <div style={{width: `${(60 / prog / 100) * 100}%`, minWidth: 0}} />
          </div>
          <div style={{position: 'absolute', inset: 0, display: 'flex'}}>
            {seg.map((x, i) => {
              const start = seg.slice(0, i).reduce((a, b) => a + b.w, 0);
              const fill = Math.max(0, Math.min(1, (prog * 100 - start) / x.w));
              return <div key={x.l} style={{width: `${x.w}%`}}><div style={{width: `${fill * 100}%`, height: '100%', background: x.bg}} /></div>;
            })}
          </div>
        </div>
        <div style={{display: 'flex', fontSize: 20, fontWeight: 700}}>
          {seg.map((x) => <div key={x.l} style={{width: `${x.w}%`, color: G.g700}}>{x.l}</div>)}
        </div>
        <div style={{display: 'flex', fontSize: 17, color: G.g500, marginTop: 2}}>
          <div style={{width: '60%'}}>Day 0: EduPay approves your school</div>
          <div style={{width: '10%'}}>Day 90</div>
          <div style={{width: '30%'}}>Day 97: subscription due</div>
        </div>
        <div style={{display: 'flex', gap: 20, marginTop: 22}}>
          <Reveal at={10} style={{flex: 1}}>
            <Card style={{padding: 22, border: '2px solid #fecaca', height: 300}}>
              <SecTitle color="#b91c1c">If unpaid, your school is paused</SecTitle>
              {['Enrol students', 'Create or assign fees', 'Add staff', 'Record cash'].map((x, i) => <Li key={x} ok={false} at={10.6 + i * 0.6}>{x}</Li>)}
            </Card>
          </Reveal>
          <Reveal at={13.5} style={{flex: 1}}>
            <Card style={{padding: 22, border: '2px solid #bbf7d0', height: 300}}>
              <SecTitle color="#15803d">Still works</SecTitle>
              {['Parents can still pay', 'Payments still matched', 'You can still withdraw', 'Reports stay readable'].map((x, i) => <Li key={x} ok at={14 + i * 0.6}>{x}</Li>)}
            </Card>
          </Reveal>
        </div>
        <Reveal at={18} style={{marginTop: 18, display: 'flex', gap: 16}}>
          <div style={{flex: 1, background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 14, padding: '14px 20px', fontSize: 21, fontWeight: 700}}>The parent service charge stays the same after the pilot</div>
          <div style={{flex: 1, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: 14, padding: '14px 20px', fontSize: 21, fontWeight: 700}}>Transfer recorded: everything reopens immediately</div>
        </Reveal>
      </Frame>
      <Caption items={[
        {from: 0.5, to: 9.8, text: '90 days free, then a 7-day grace period'},
        {from: 10, to: 17.8, text: 'Unpaid: new work pauses. Parents can still pay.'},
        {from: 18, to: 25, text: 'Service charge unchanged. Pay, and it reopens.'},
      ]} />
    </Stage>
  );
};
