"""Generate free Nigerian-English narration (Microsoft Edge neural voices) for every scene.

Setup once:   pip install -U edge-tts
Run:          npm run voice                               (male voice, Abeo)
              python scripts/make_voice.py en-NG-EzinneNeural   (female voice)
              python scripts/make_voice.py en-NG-AbeoNeural --force   (redo existing files)

Writes public/audio/<pitch|teaser|demo>-<scene>.mp3. The video picks them up automatically.
Edit the wording in src/script.json, then run this again.
"""
import asyncio, json, shutil, subprocess, sys
from pathlib import Path

try:
    import edge_tts
except ImportError:
    sys.exit("Missing package. Run:  pip install -U edge-tts")

ROOT = Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith("--")]
FORCE = "--force" in sys.argv
VOICE = args[0] if args else "en-NG-AbeoNeural"
RATE = "-4%"        # slightly slower = clearer for a pitch
TIMEOUT = 40        # seconds per line before giving up on that try
TRIES = 3

script = json.loads((ROOT / "src" / "script.json").read_text(encoding="utf-8"))
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


async def make_one(text: str, f: Path) -> bool:
    for attempt in range(1, TRIES + 1):
        try:
            await asyncio.wait_for(edge_tts.Communicate(text, VOICE, rate=RATE).save(str(f)), TIMEOUT)
            return True
        except (asyncio.TimeoutError, Exception) as e:  # noqa: BLE001
            print(f"   try {attempt}/{TRIES} failed: {type(e).__name__} {e}".rstrip())
            if f.exists():
                f.unlink()
    return False


async def main():
    failed = []
    for kind, scenes in script.items():
        for s in scenes:
            f = out / f"{kind}-{s['id']}.mp3"
            if f.exists() and not FORCE:
                print(f"{f.name}: already exists (use --force to redo)")
                continue
            print(f"{f.name}: generating...", flush=True)
            if not await make_one(s["text"], f):
                failed.append(f.name)
                continue
            d = seconds(f)
            room = s["seconds"] - 0.4  # voice starts 0.4s into each scene
            if d is None:
                print("   saved")
            elif d > room:
                print(f"   {d:.1f}s of {room:.1f}s  <-- TOO LONG by {d - room:.1f}s: shorten the text or raise 'seconds' in src/script.json")
            else:
                print(f"   {d:.1f}s of {room:.1f}s  ok")
    if failed:
        print("\nCould not reach the voice service for:", ", ".join(failed))
        print("Fix: pip install -U edge-tts, turn off VPN/firewall, or try another network (a phone hotspot works), then run again. Finished files are kept.")
        sys.exit(1)
    print("\nAll voice files ready in public/audio/")


asyncio.run(main())
