# EduPay promo video (Remotion)

One codebase, two videos:

| Composition | Size | Length | Command |
|---|---|---|---|
| `Pitch`  | 1920x1080 (16:9) | 85 s | `npm run render:pitch` |
| `Teaser` | 1080x1920 (9:16) | 28 s | `npm run render:teaser` |
| `Demo`   | 1920x1080 (16:9) | 187 s | `npm run render:demo` |

## Run it
1. Install Node 18+ then `npm install`
2. `npm run dev` opens the preview in your browser
3. `npm run render:all` writes both MP4s into `out/` (first run downloads Chrome)

## What to edit
- Wording and timing of each scene: `src/script.json` (the `text` is the narration, `seconds` is the scene length)
- Contact details and colours: `src/brand.ts`
- Scene visuals: `src/scenes.tsx`

## Voice (free, Nigerian English)
1. `pip install edge-tts`  (if pip refuses on Linux/Mac: `pip install --user --break-system-packages edge-tts`)
2. `npm run voice`  (male, Abeo) or `python3 scripts/make_voice.py en-NG-EzinneNeural` (female)
3. Files land in `public/audio/`. The video uses them automatically. The script warns if a line is longer than its scene.

## Music
Download a track, save it as `public/music.mp3`. It is picked up automatically, fades in and out, and ducks under the voice.
Sources with clear licences: Pixabay Music (no attribution), YouTube Audio Library, Incompetech (credit required).
Search "corporate upbeat", "inspiring corporate" or "uplifting acoustic". Keep the licence page for the track.

## Demo video
`Demo` rebuilds the real bursar live feed and parent balance screens (from the frontend code) with simulated data and a visible "Test environment" tag. Narration is under `demo` in `src/script.json`. Swap in real screen recordings later if you prefer.
