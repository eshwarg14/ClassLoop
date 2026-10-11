"""Replay transcript script: Replays segments at adjustable speed and auto-ends the lecture."""

import argparse
import json
from pathlib import Path
import sys
import time
import httpx

ROOT_DIR = Path(__file__).resolve().parent.parent
SAMPLE_FILE = ROOT_DIR / "scripts" / "sample_lecture.json"


def replay_transcript(speed: float = 10.0, base_url: str = "http://localhost:8080") -> None:
    if not SAMPLE_FILE.exists():
        print(f"Error: Sample file {SAMPLE_FILE} not found!")
        sys.exit(1)

    with open(SAMPLE_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    title = data.get("lecture_title", "Replayed Lecture")
    segments = data.get("segments", [])
    print(f"[*] Starting Replay: '{title}' at {speed}x real-time speed")
    print(f"[*] Total segments: {len(segments)}")

    session_id = f"session_replay_{int(time.time())}"
    lecture_id = None

    with httpx.Client(base_url=base_url, timeout=30.0) as client:
        # Check backend
        try:
            h = client.get("/healthz")
            if h.status_code != 200:
                print(f"[!] Server returned {h.status_code}")
                sys.exit(1)
        except Exception as e:
            print(f"[!] Cannot connect to {base_url}: {e}")
            sys.exit(1)

        prev_end = 0.0

        for i, seg in enumerate(segments, start=1):
            seg_start = seg.get("start", 0.0)
            gap = max(0.0, seg_start - prev_end)
            if gap > 0 and speed > 0:
                sleep_time = gap / speed
                time.sleep(sleep_time)

            payload = {
                "session_id": session_id,
                "lecture_title": title,
                "segments": [seg],
            }

            resp = client.post("/webhook/omi", json=payload)
            if resp.status_code == 200:
                res_data = resp.json()
                lecture_id = res_data.get("lecture_id")
                print(f"[{i:02d}/{len(segments)}] [{seg.get('start', 0.0):.1f}s - {seg.get('end', 0.0):.1f}s] "
                      f"({seg.get('speaker')}): \"{seg.get('text')[:45]}...\"")
            else:
                print(f"[!] Segment {i} failed: {resp.status_code} {resp.text}")

            prev_end = seg.get("end", prev_end)

        time.sleep(1.0)

        # Auto-end lecture
        if lecture_id:
            print(f"\n[*] All segments replayed. Triggering lecture end for {lecture_id}...")
            end_resp = client.post(f"/api/lectures/{lecture_id}/end")
            if end_resp.status_code == 200:
                print(f"[+] Replay complete. Lecture {lecture_id} processing pipeline started!")
            else:
                print(f"[!] Error ending lecture: {end_resp.status_code} {end_resp.text}")
        else:
            print("[!] No lecture_id captured.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Replay lecture transcript to ClassLoop webhook.")
    parser.add_argument("--speed", type=float, default=10.0, help="Playback speed multiplier (default: 10x)")
    parser.add_argument("--url", type=str, default="http://localhost:8080", help="Backend base URL")
    args = parser.parse_args()

    replay_transcript(speed=args.speed, base_url=args.url)
