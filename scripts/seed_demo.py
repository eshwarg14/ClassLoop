"""Seed demo script: Sends sample lecture segments to webhook and triggers end-of-lecture pipeline."""

import json
from pathlib import Path
import sys
import time
import httpx

BASE_URL = "http://localhost:8080"
ROOT_DIR = Path(__file__).resolve().parent.parent
SAMPLE_FILE = ROOT_DIR / "scripts" / "sample_lecture.json"


def seed_demo(base_url: str = BASE_URL) -> None:
    if not SAMPLE_FILE.exists():
        print(f"Error: Sample file {SAMPLE_FILE} not found!")
        sys.exit(1)

    with open(SAMPLE_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    title = data.get("lecture_title", "Sample Lecture")
    segments = data.get("segments", [])
    print(f"[*] Starting Demo Seeding: '{title}' ({len(segments)} segments)")

    lecture_id = None

    with httpx.Client(base_url=base_url, timeout=30.0) as client:
        # Check backend health
        try:
            h = client.get("/healthz")
            if h.status_code != 200:
                print(f"[!] Server returned {h.status_code} at /healthz")
                sys.exit(1)
            print("[+] Backend health check passed.")
        except Exception as e:
            print(f"[!] Cannot connect to {base_url}: {e}")
            sys.exit(1)

        # Send each segment
        for i, seg in enumerate(segments, start=1):
            payload = {
                "session_id": "session_demo_001",
                "lecture_title": title,
                "segments": [seg],
            }
            resp = client.post("/webhook/omi", json=payload)
            if resp.status_code == 200:
                res_data = resp.json()
                lecture_id = res_data.get("lecture_id")
                print(f"[{i}/{len(segments)}] Ingested segment {seg.get('id')}: \"{seg.get('text')[:40]}...\"")
            else:
                print(f"[!] Failed to ingest segment {seg.get('id')}: {resp.status_code} {resp.text}")

        time.sleep(1.0)

        # End lecture
        if lecture_id:
            print(f"\n[*] Ending lecture {lecture_id} to trigger agent pipeline...")
            end_resp = client.post(f"/api/lectures/{lecture_id}/end")
            if end_resp.status_code == 200:
                print(f"[+] Lecture {lecture_id} ended successfully. Orchestrator pipeline queued!")
            else:
                print(f"[!] Error ending lecture: {end_resp.status_code} {end_resp.text}")
        else:
            print("[!] No lecture_id received from webhook calls.")


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else BASE_URL
    seed_demo(url)
