"""Generate free Nigerian-English narration (Microsoft Edge neural voices) for every scene.

Setup once:   pip install edge-tts
Run:          npm run voice            (male voice, Abeo)
              python3 scripts/make_voice.py en-NG-EzinneNeural   (female voice)

Writes public/audio/<pitch|teaser>-<scene>.mp3. The video picks them up automatically.
Edit the wording in src/script.json, then run this again.
"""
import asyncio, json, shutil, subprocess, sys
from pathlib import Path

try:
    import edge_tts
except ImportError:
    sys.exit("Missing package. Run:  pip install edge-tts")

ROOT = Path(__file__).resolve().parent.parent
VOICE = sys.argv[1] if len(sys.argv) > 1 else "en-NG-AbeoNeural"
RATE = "-4%"  # slightly slower = clearer for a pitch
script = json.loads((ROOT / "src" / "script.json").read_text())
out = ROOT / "public" / "audio"
out.mkdir(parents=True, exist_ok=True)


def seconds(path: Path):
    if not shutil.which("ffprobe"):
        return None
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    )
    try:
        return float(r.stdout.strip())
    except ValueError:
        return None


async def main():
    for kind, scenes in script.items():
        for s in scenes:
            f = out / f"{kind}-{s['id']}.mp3"
            await edge_tts.Communicate(s["text"], VOICE, rate=RATE).save(str(f))
            d = seconds(f)
            room = s["seconds"] - 0.4  # voice starts 0.4s into each scene
            flag = ""
            if d is not None and d > room:
                flag = f"  <-- TOO LONG by {d - room:.1f}s: shorten the text or raise 'seconds' in src/script.json"
            print(f"{f.name}: {d:.1f}s of {room:.1f}s{flag}" if d else f"{f.name}: saved")

asyncio.run(main())
