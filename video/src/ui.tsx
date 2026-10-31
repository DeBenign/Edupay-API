import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {C, FONT} from './brand';

export const useV = () => {
  const {width, height} = useVideoConfig();
  return height > width;
};

export const useT = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return {f, fps, t: f / fps};
};

export const Reveal: React.FC<{
  at?: number;
  from?: 'up' | 'left' | 'scale';
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({at = 0, from = 'up', style, children}) => {
  const {f, fps} = useT();
  const p = spring({frame: f - Math.round(at * fps), fps, config: {damping: 200}});
  const tf =
    from === 'up'
      ? `translateY(${(1 - p) * 40}px)`
      : from === 'left'
      ? `translateX(${(1 - p) * -60}px)`
      : `scale(${0.85 + 0.15 * p})`;
  return <div style={{opacity: p, transform: tf, ...style}}>{children}</div>;
};

export const Stage: React.FC<{children: React.ReactNode}> = ({children}) => {
  const {f} = useT();
  const drift = Math.sin(f / 60) * 40;
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navy2} 100%)`,
        fontFamily: FONT,
        color: C.white,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 900,
          height: 900,
          borderRadius: '50%',
          left: -250 + drift,
          top: -300,
          background: `radial-gradient(circle, ${C.brand}55 0%, transparent 65%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 800,
          height: 800,
          borderRadius: '50%',
          right: -250 - drift,
          bottom: -300,
          background: `radial-gradient(circle, ${C.brandLight}33 0%, transparent 65%)`,
        }}
      />
      <AbsoluteFill style={{padding: 80, justifyContent: 'center'}}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Card: React.FC<{
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({style, children}) => (
  <div
    style={{
      background: C.white,
      color: C.ink,
      borderRadius: 28,
      padding: 36,
      boxShadow: '0 30px 60px -20px rgba(0,0,0,0.45)',
      ...style,
    }}
  >
    {children}
  </div>
);

export const Pill: React.FC<{
  bg: string;
  fg: string;
  border?: string;
  size?: number;
  children: React.ReactNode;
}> = ({bg, fg, border, size = 28, children}) => (
  <span
    style={{
      display: 'inline-block',
      background: bg,
      color: fg,
      border: `2px solid ${border ?? bg}`,
      borderRadius: 999,
      padding: '8px 22px',
      fontSize: size,
      fontWeight: 700,
    }}
  >
    {children}
  </span>
);

export const Logo: React.FC<{size?: number}> = ({size = 120}) => (
  <Img
    src={staticFile('logo.svg')}
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.23,
      boxShadow: '0 12px 30px -8px rgba(37,99,235,0.6)',
    }}
  />
);

export const Icon: React.FC<{
  name: 'check' | 'alert' | 'refresh' | 'arrow';
  color: string;
  size?: number;
}> = ({name, color, size = 44}) => {
  const paths: Record<string, string> = {
    check: 'M5 13l4 4L19 7',
    alert: 'M12 8v5M12 17h.01',
    refresh: 'M4 12a8 8 0 0 1 14-5.3M20 4v5h-5M20 12a8 8 0 0 1-14 5.3M4 20v-5h5',
    arrow: 'M5 12h14M13 6l6 6-6 6',
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      {name === 'alert' && <circle cx="12" cy="12" r="9" />}
      <path d={paths[name]} />
    </svg>
  );
};

export const naira = (n: number) => '₦' + n.toLocaleString('en-NG');

export const BigLines: React.FC<{
  lines: {text: string; at: number; color?: string}[];
  size?: number;
}> = ({lines, size}) => {
  const v = useV();
  const s = size ?? (v ? 110 : 104);
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 18}}>
      {lines.map((l) => (
        <Reveal key={l.text} at={l.at}>
          <div style={{fontSize: s, fontWeight: 800, lineHeight: 1.08, color: l.color ?? C.white, letterSpacing: -2}}>
            {l.text}
          </div>
        </Reveal>
      ))}
    </div>
  );
};

export const ProgressBar: React.FC<{pct: number; color: string; height?: number}> = ({pct, color, height = 28}) => (
  <div style={{background: '#e2e8f0', borderRadius: 999, height, overflow: 'hidden'}}>
    <div style={{width: `${Math.max(0, Math.min(1, pct)) * 100}%`, height: '100%', background: color, borderRadius: 999}} />
  </div>
);

export const fadeBetween = (f: number, start: number, end: number) =>
  interpolate(f, [start, end], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
