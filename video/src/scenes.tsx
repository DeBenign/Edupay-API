import React from 'react';
import {C, CONTACT} from './brand';
import {BigLines, Card, Icon, Logo, naira, Pill, ProgressBar, Reveal, Stage, fadeBetween, useT, useV} from './ui';

const row = (v: boolean): React.CSSProperties => ({
  display: 'flex',
  flexDirection: v ? 'column' : 'row',
  gap: v ? 28 : 36,
  alignItems: 'stretch',
});

/* ---------- Hooks ---------- */
export const PitchHook: React.FC = () => (
  <Stage>
    <BigLines
      lines={[
        {text: 'Every term,', at: 0.2},
        {text: 'thousands of school fees', at: 1.0},
        {text: 'land in one bank account.', at: 2.2, color: C.sky},
      ]}
    />
  </Stage>
);

export const TeaserHook: React.FC = () => (
  <Stage>
    <BigLines
      lines={[
        {text: 'School fees.', at: 0.2},
        {text: 'Still tracked on paper?', at: 1.2, color: C.sky},
      ]}
      size={120}
    />
  </Stage>
);

/* ---------- Problem ---------- */
const alerts = [
  'CR ₦45,000  TRF FROM A. ADEYEMI',
  'CR ₦20,000  TRF FROM MR OKAFOR',
  'CR ₦45,000  "school fees"',
  'CR ₦12,500  POS 0042',
];

export const Problem: React.FC = () => {
  const v = useV();
  const shown = v ? alerts.slice(0, 3) : alerts;
  return (
    <Stage>
      <div style={row(v)}>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 16}}>
          {shown.map((a, i) => (
            <Reveal key={a} at={0.3 + i * 0.5} from="left">
              <Card style={{padding: '22px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <span style={{fontSize: 30, fontWeight: 600, fontFamily: 'monospace'}}>{a}</span>
                <Pill bg={C.amberBg} fg={C.amber} border={C.amberBorder} size={26}>Who paid?</Pill>
              </Card>
            </Reveal>
          ))}
        </div>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 18, justifyContent: 'center'}}>
          <Reveal at={2.6}><div style={{fontSize: 64, fontWeight: 800, lineHeight: 1.1}}>Guesswork.</div></Reveal>
          <Reveal at={3.6}><div style={{fontSize: 64, fontWeight: 800, lineHeight: 1.1, color: C.sky}}>Unnoticed shortfalls.</div></Reveal>
          <Reveal at={4.6}><div style={{fontSize: 64, fontWeight: 800, lineHeight: 1.1}}>Parents calling to check.</div></Reveal>
        </div>
      </div>
    </Stage>
  );
};

export const TeaserProblem: React.FC = () => (
  <Stage>
    <BigLines
      lines={[
        {text: 'Shared accounts.', at: 0.2},
        {text: 'Guesswork.', at: 1.0},
        {text: 'Parents calling to ask.', at: 1.8, color: C.sky},
      ]}
      size={104}
    />
  </Stage>
);

/* ---------- Meet EduPay ---------- */
export const Meet: React.FC = () => {
  const v = useV();
  return (
    <Stage>
      <div style={{...row(v), alignItems: 'center', gap: 60}}>
        <Reveal at={0.2} from="scale"><Logo size={v ? 240 : 300} /></Reveal>
        <div style={{display: 'flex', flexDirection: 'column', gap: 22}}>
          <Reveal at={0.6}><div style={{fontSize: 110, fontWeight: 800, letterSpacing: -3}}>EduPay</div></Reveal>
          <Reveal at={1.2}>
            <div style={{fontSize: 40, color: C.sky, fontWeight: 600}}>School fee payment infrastructure for Nigerian schools</div>
          </Reveal>
          <Reveal at={2.4}>
            <Card style={{padding: '24px 30px', marginTop: 10}}>
              <div style={{fontSize: 30, fontWeight: 800}}>Chioma Adeyemi · JSS 2</div>
              <div style={{display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap'}}>
                <Pill bg="#eef5ff" fg={C.brand} size={26}>Nomba · 9•••• 4821</Pill>
                <Pill bg="#eef5ff" fg={C.brand} size={26}>Paystack · 9•••• 0376</Pill>
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </Stage>
  );
};

/* ---------- Online flow ---------- */
const Step: React.FC<{n: number; title: string; body: string; at: number}> = ({n, title, body, at}) => (
  <Reveal at={at} style={{flex: 1}}>
    <Card style={{height: '100%'}}>
      <div style={{width: 56, height: 56, borderRadius: 28, background: C.brand, color: C.white, fontSize: 30, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{n}</div>
      <div style={{fontSize: 38, fontWeight: 800, marginTop: 18}}>{title}</div>
      <div style={{fontSize: 28, color: C.muted, marginTop: 10, lineHeight: 1.35, fontWeight: 500}}>{body}</div>
    </Card>
  </Reveal>
);

export const OnlineFlow: React.FC = () => {
  const v = useV();
  return (
    <Stage>
      <Reveal at={0.1}><div style={{fontSize: 30, fontWeight: 800, color: C.sky, letterSpacing: 4}}>PAYING ONLINE</div></Reveal>
      <Reveal at={0.4}><div style={{fontSize: v ? 72 : 80, fontWeight: 800, margin: '10px 0 36px', letterSpacing: -2}}>Transfer. Identified. Reconciled.</div></Reveal>
      <div style={row(v)}>
        <Step n={1} at={1.5} title="Parent transfers" body={`${naira(10254)} from any bank = ${naira(10000)} fee + ${naira(254)} service charge`} />
        <Step n={2} at={4.5} title="Student found" body="Signature verified, account number matched to the student automatically" />
        <Step n={3} at={7.5} title="Balance updated" body="Chioma: PAID in full. The school receives the full ₦10,000" />
      </div>
    </Stage>
  );
};

/* ---------- Manual flow ---------- */
const methods = ['Cash', 'Cheque', 'POS', 'Bank transfer'];

export const ManualFlow: React.FC = () => {
  const v = useV();
  const {t} = useT();
  const sel = t < 2.5 ? -1 : Math.min(methods.length - 1, Math.floor((t - 2.5) / 0.6));
  const finalSel = t > 5 ? 0 : sel;
  const receipt = 'RCT-0042';
  const typed = receipt.slice(0, Math.max(0, Math.floor((t - 5.2) * 8)));
  const recorded = t > 8;
  const pct = fadeBetween(t * 30, 8 * 30, 10 * 30);
  return (
    <Stage>
      <Reveal at={0.1}><div style={{fontSize: 30, fontWeight: 800, color: C.sky, letterSpacing: 4}}>PAYING AT THE SCHOOL</div></Reveal>
      <Reveal at={0.4}><div style={{fontSize: v ? 72 : 80, fontWeight: 800, margin: '10px 0 32px', letterSpacing: -2}}>The bursar records it.</div></Reveal>
      <div style={row(v)}>
        <Reveal at={1.0} style={{flex: 1.2}}>
          <Card style={{height: '100%'}}>
            <div style={{fontSize: 34, fontWeight: 800}}>Record Payment</div>
            <div style={{display: 'flex', gap: 12, flexWrap: 'wrap', margin: '20px 0'}}>
              {methods.map((m, i) => (
                <Pill key={m} bg={finalSel === i ? C.brand : '#f1f5f9'} fg={finalSel === i ? C.white : C.muted} size={26}>{m}</Pill>
              ))}
            </div>
            <div style={{fontSize: 24, color: C.muted, fontWeight: 600}}>Receipt number</div>
            <div style={{fontSize: 40, fontWeight: 800, fontFamily: 'monospace', borderBottom: '3px solid #e2e8f0', padding: '6px 0', minHeight: 62}}>{typed}</div>
            <div style={{fontSize: 24, color: C.muted, fontWeight: 600, marginTop: 18}}>Amount</div>
            <div style={{fontSize: 40, fontWeight: 800}}>{t > 6.6 ? naira(10000) : ''}</div>
            <div style={{marginTop: 22}}>
              <Pill bg={recorded ? C.green : C.brand} fg={C.white} size={30}>{recorded ? 'Recorded' : 'Record payment'}</Pill>
            </div>
          </Card>
        </Reveal>
        <Reveal at={1.4} style={{flex: 1}}>
          <Card style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 18}}>
            <div style={{fontSize: 34, fontWeight: 800}}>Chioma Adeyemi</div>
            <div style={{fontSize: 28, color: C.muted, fontWeight: 600}}>Balance: {recorded ? '₦0' : naira(10000)}</div>
            <ProgressBar pct={pct} color={C.green} />
            <div style={{display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8}}>
              <Pill bg={C.greenBg} fg={C.green} border={C.greenBorder} size={24}>No service charge</Pill>
              <Pill bg="#eef5ff" fg={C.brand} size={24}>Same reconciliation engine</Pill>
              <Pill bg={C.violetBg} fg={C.violet} border={C.violetBorder} size={24}>Unique receipt blocks double entry</Pill>
            </div>
          </Card>
        </Reveal>
      </div>
    </Stage>
  );
};

/* ---------- Classification ---------- */
const kinds = [
  {t: 'Exact', d: '₦10,000 of ₦10,000', r: 'Settled', bg: C.greenBg, fg: C.green, bd: C.greenBorder, icon: 'check' as const},
  {t: 'Underpaid', d: '₦6,000 of ₦10,000', r: '₦4,000 balance tracked', bg: C.amberBg, fg: C.amber, bd: C.amberBorder, icon: 'alert' as const},
  {t: 'Overpaid', d: '₦12,000 of ₦10,000', r: 'Refund, or credit to next term', bg: C.violetBg, fg: C.violet, bd: C.violetBorder, icon: 'refresh' as const},
];

export const Classify: React.FC = () => {
  const v = useV();
  return (
    <Stage>
      <Reveal at={0.1}><div style={{fontSize: v ? 72 : 80, fontWeight: 800, marginBottom: 36, letterSpacing: -2}}>Every payment, classified.</div></Reveal>
      <div style={row(v)}>
        {kinds.map((k, i) => (
          <Reveal key={k.t} at={1.0 + i * 1.2} style={{flex: 1}}>
            <Card style={{background: k.bg, border: `3px solid ${k.bd}`, height: '100%'}}>
              <Icon name={k.icon} color={k.fg} size={56} />
              <div style={{fontSize: 44, fontWeight: 800, color: k.fg, marginTop: 10}}>{k.t}</div>
              <div style={{fontSize: 28, fontWeight: 600, marginTop: 8}}>{k.d}</div>
              <div style={{fontSize: 28, color: C.muted, marginTop: 6, fontWeight: 600}}>{k.r}</div>
            </Card>
          </Reveal>
        ))}
      </div>
    </Stage>
  );
};

/* ---------- Roles ---------- */
const roles = [
  {n: 'Admin', d: 'Setup, fees, refunds, withdrawals'},
  {n: 'Bursar', d: 'Records payments, reports, live feed'},
  {n: 'Parent', d: 'Balance, what to pay, history'},
];

export const Roles: React.FC = () => {
  const v = useV();
  return (
    <Stage>
      <Reveal at={0.1}><div style={{fontSize: v ? 72 : 80, fontWeight: 800, marginBottom: 36, letterSpacing: -2}}>One balance. Every dashboard.</div></Reveal>
      <div style={row(v)}>
        {roles.map((r, i) => (
          <Reveal key={r.n} at={1.0 + i * 1.3} style={{flex: 1}}>
            <Card style={{height: '100%'}}>
              <div style={{fontSize: 30, fontWeight: 800, color: C.brand, letterSpacing: 3}}>{r.n.toUpperCase()}</div>
              <div style={{fontSize: 34, fontWeight: 800, marginTop: 14}}>Chioma Adeyemi</div>
              <div style={{fontSize: 52, fontWeight: 800, color: C.green, margin: '6px 0'}}>₦0 owing</div>
              <div style={{fontSize: 26, color: C.muted, fontWeight: 600}}>{r.d}</div>
            </Card>
          </Reveal>
        ))}
      </div>
    </Stage>
  );
};

/* ---------- Teaser: two ways to pay ---------- */
export const TwoWays: React.FC = () => (
  <Stage>
    <div style={{display: 'flex', flexDirection: 'column', gap: 26}}>
      <Reveal at={0.2}>
        <Card>
          <div style={{fontSize: 26, fontWeight: 800, color: C.brand, letterSpacing: 3}}>ONLINE</div>
          <div style={{fontSize: 48, fontWeight: 800, marginTop: 8}}>Parent transfers {naira(10254)}</div>
          <div style={{fontSize: 30, color: C.green, fontWeight: 700, marginTop: 8}}>Reconciled in seconds</div>
        </Card>
      </Reveal>
      <Reveal at={2.8}>
        <Card>
          <div style={{fontSize: 26, fontWeight: 800, color: C.brand, letterSpacing: 3}}>AT SCHOOL</div>
          <div style={{fontSize: 48, fontWeight: 800, marginTop: 8}}>Bursar records the payment</div>
          <div style={{fontSize: 30, color: C.green, fontWeight: 700, marginTop: 8}}>Receipt RCT-0042 · No service charge</div>
        </Card>
      </Reveal>
      <Reveal at={5.6}>
        <div style={{fontSize: 70, fontWeight: 800, color: C.sky, letterSpacing: -2, marginTop: 10}}>Same balance everywhere.</div>
      </Reveal>
    </div>
  </Stage>
);

/* ---------- CTA ---------- */
export const Cta: React.FC = () => {
  const v = useV();
  return (
    <Stage>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: v ? 'flex-start' : 'center', gap: 26, textAlign: v ? 'left' : 'center'}}>
        <Reveal at={0.2} from="scale"><Logo size={150} /></Reveal>
        <Reveal at={0.7}><div style={{fontSize: v ? 104 : 108, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05}}>Know who paid.<br />Instantly.</div></Reveal>
        <Reveal at={1.6}><Pill bg={C.brand} fg={C.white} size={40}>Free 120-day pilot for your school</Pill></Reveal>
        <Reveal at={2.6}>
          <div style={{fontSize: 36, color: C.sky, fontWeight: 600, lineHeight: 1.5}}>
            {CONTACT.website}<br />{CONTACT.phone}<br />{CONTACT.email}
          </div>
        </Reveal>
      </div>
    </Stage>
  );
};
