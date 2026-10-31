import React from 'react';
import {Composition} from 'remotion';
import {loadFont} from '@remotion/google-fonts/Inter';
import {EduPayVideo, totalFrames} from './Video';

loadFont('normal', {weights: ['500', '600', '700', '800'], subsets: ['latin', 'latin-ext']});

const FPS = 30;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Pitch" component={EduPayVideo} durationInFrames={totalFrames('pitch', FPS)} fps={FPS} width={1920} height={1080} defaultProps={{kind: 'pitch' as const}} />
    <Composition id="Teaser" component={EduPayVideo} durationInFrames={totalFrames('teaser', FPS)} fps={FPS} width={1080} height={1920} defaultProps={{kind: 'teaser' as const}} />
  </>
);
