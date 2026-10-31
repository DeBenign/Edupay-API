import React from 'react';
import {AbsoluteFill, Audio, Sequence, getStaticFiles, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import script from './script.json';
import {C, FONT} from './brand';
import * as S from './scenes';

type Kind = 'pitch' | 'teaser';

const map: Record<Kind, Record<string, React.FC>> = {
  pitch: {hook: S.PitchHook, problem: S.Problem, meet: S.Meet, online: S.OnlineFlow, manual: S.ManualFlow, classify: S.Classify, roles: S.Roles, cta: S.Cta},
  teaser: {hook: S.TeaserHook, problem: S.TeaserProblem, ways: S.TwoWays, cta: S.Cta},
};

export const totalFrames = (kind: Kind, fps: number) =>
  script[kind].reduce((a, s) => a + Math.round(s.seconds * fps), 0);

const staticNames = (): Set<string> => {
  try {
    return new Set(getStaticFiles().map((f) => f.name));
  } catch {
    return new Set();
  }
};

const SceneFade: React.FC<{dur: number; children: React.ReactNode}> = ({dur, children}) => {
  const {fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const edge = Math.round(0.35 * fps);
  const opacity = interpolate(frame, [0, edge, dur - edge, dur], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
};

export const EduPayVideo: React.FC<{kind: Kind}> = ({kind}) => {
  const {fps} = useVideoConfig();
  const files = staticNames();
  const scenes = script[kind];
  const total = totalFrames(kind, fps);
  const hasVoice = scenes.some((s) => files.has(`audio/${kind}-${s.id}.mp3`));
  const base = hasVoice ? 0.14 : 0.45;
  let from = 0;
  return (
    <AbsoluteFill style={{backgroundColor: C.navy, fontFamily: FONT}}>
      {scenes.map((s) => {
        const dur = Math.round(s.seconds * fps);
        const Comp = map[kind][s.id];
        const voiceFile = `audio/${kind}-${s.id}.mp3`;
        const el = (
          <Sequence key={s.id} from={from} durationInFrames={dur}>
            <SceneFade dur={dur}><Comp /></SceneFade>
            {files.has(voiceFile) && (
              <Sequence from={Math.round(0.4 * fps)}>
                <Audio src={staticFile(voiceFile)} />
              </Sequence>
            )}
          </Sequence>
        );
        from += dur;
        return el;
      })}
      {files.has('music.mp3') && (
        <Audio
          src={staticFile('music.mp3')}
          loop
          volume={(f) => interpolate(f, [0, fps, total - 2 * fps, total], [0, base, base, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
        />
      )}
    </AbsoluteFill>
  );
};
