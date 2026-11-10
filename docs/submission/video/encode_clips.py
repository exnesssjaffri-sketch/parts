#!/usr/bin/env python3
"""Encode video clips from PIL-generated frames (no zoompan filter)"""

import subprocess
import os
from pathlib import Path

FFMPEG = r"C:\Users\ALI HAIDER\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe"
FFPROBE = r"C:\Users\ALI HAIDER\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffprobe.exe"

ASSETS = Path("C:/Users/ALI HAIDER/OneDrive/Desktop/parts/.claude/worktrees/elated-mestorf-77dc0f/docs/submission/video/assets")
FRAMES = ASSETS / "frames"
OUTPUT = Path("C:/Users/ALI HAIDER/OneDrive/Desktop/parts/.claude/worktrees/elated-mestorf-77dc0f/docs/submission/video/AutoMarts_Project_Showcase_4K.mp4")

SCENES = [
    ("clip_00_intro.mp4", "intro.png", 5),
    ("clip_01_hero.mp4", "hero.png", 6),
    ("clip_02_products.mp4", "products.png", 6),
    ("clip_03_cart.mp4", "cart.png", 6),
    ("clip_04_auth.mp4", "auth.png", 6),
    ("clip_05_admin.mp4", "admin.png", 6),
    ("clip_06_security.mp4", "security.png", 6),
    ("clip_07_outro.mp4", "outro.png", 5),
]

def encode_clip(clip_name, frame_name, duration):
    """Encode a single clip from a still frame"""
    frame_path = FRAMES / frame_name
    clip_path = ASSETS / clip_name

    if not frame_path.exists():
        print(f"  Missing frame: {frame_name}")
        return False

    # Simple encoding without complex filters
    cmd = [
        FFMPEG, "-y",
        "-loop", "1",
        "-i", str(frame_path),
        "-t", str(duration),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-crf", "18",
        "-preset", "medium",
        "-frames:v", str(int(duration * 30)),
        str(clip_path)
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0 and clip_path.exists() and clip_path.stat().st_size > 1000:
        size_kb = clip_path.stat().st_size / 1024
        print(f"  OK: {clip_name} ({size_kb:.0f} KB)")
        return True
    else:
        print(f"  FAIL: {clip_name}")
        print(f"    {result.stderr[:200]}")
        return False

def main():
    print("Encoding clips (simple, no zoompan)...")

    for clip_name, frame_name, duration in SCENES:
        if not encode_clip(clip_name, frame_name, duration):
            print(f"  WARNING: Failed to encode {clip_name}")

    # Check what we have
    clips = []
    for clip_name, _, _ in SCENES:
        clip_path = ASSETS / clip_name
        if clip_path.exists() and clip_path.stat().st_size > 1000:
            clips.append(str(clip_path))

    if not clips:
        print("\nNo clips created. Check for errors above.")
        return

    print(f"\nConcatenating {len(clips)} clips...")

    # Create concat file
    concat_file = ASSETS / "concat.txt"
    with open(concat_file, "w") as f:
        for clip in clips:
            f.write(f"file '{clip}'\n")

    intermediate = ASSETS / "intermediate.mp4"
    cmd = [FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file), "-c", "copy", str(intermediate)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Concat failed: {result.stderr[:200]}")
        return

    # Final encode
    print("Final encoding...")
    cmd = [
        FFMPEG, "-y", "-i", str(intermediate),
        "-c:v", "libx264", "-crf", "18", "-preset", "medium",
        "-profile:v", "high", "-level", "5.1",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(OUTPUT)
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Final encode failed: {result.stderr[:300]}")
        return

    # Verify
    if OUTPUT.exists():
        size_mb = OUTPUT.stat().st_size / (1024 * 1024)
        print(f"\nSUCCESS: {OUTPUT}")
        print(f"Size: {size_mb:.2f} MB")

        cmd = [FFPROBE, "-v", "error", "-show_entries", "format=duration,size",
               "-show_entries", "stream=codec_name,width,height",
               "-of", "default", str(OUTPUT)]
        result = subprocess.run(cmd, capture_output=True, text=True)
        print(result.stdout)
    else:
        print("Output file not created")

if __name__ == "__main__":
    main()
