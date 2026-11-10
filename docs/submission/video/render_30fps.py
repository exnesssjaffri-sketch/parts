#!/usr/bin/env python3
"""Re-render AutoMarts 4K showcase at a genuine constant 30 FPS.

Root cause of the 25 fps defect: produce_video_v2.py set FPS=30 but never
passed an output frame-rate option to FFmpeg. With `-loop 1 -i frame.png`
FFmpeg defaults the input to 25 fps, so `-frames:v` truncated at 25-fps
counts and the emitted clips (and the final video) were 25 fps.

This script re-encodes every scene clip from the existing 3840x2160 PNG
source frames with an explicit `-r 30` output option, then concatenates
and re-encodes the final MP4 at 30 fps. Source PNGs are not modified.
"""

import subprocess
import os
from pathlib import Path

FFMPEG = r"C:\Users\ALI HAIDER\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe"
FFPROBE = r"C:\Users\ALI HAIDER\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffprobe.exe"

VIDEO_DIR = Path("C:/Users/ALI HAIDER/OneDrive/Desktop/parts/.claude/worktrees/vibrant-gagarin-47d9ee/docs/submission/video")
ASSETS = VIDEO_DIR / "assets"
FRAMES = ASSETS / "frames"
BACKUP = VIDEO_DIR / "AutoMarts_Project_Showcase_4K_25fps_BACKUP.mp4"
OUTPUT = VIDEO_DIR / "AutoMarts_Project_Showcase_4K.mp4"

FPS = 30

# (frame_name, duration_seconds) -- sums to 76s, matching storyboard.json
# and the durations of the existing 25-fps source clips.
SCENES = [
    ("intro.png",       6),
    ("hero.png",        8),
    ("products.png",    8),
    ("categories.png",  8),
    ("cart.png",        8),
    ("auth.png",        8),
    ("admin.png",       8),
    ("security.png",    8),
    ("stack.png",       8),
    ("outro.png",       6),
]


def run(cmd, label):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  FAIL [{label}]: {result.stderr[-400:]}")
        return False
    return True


def main():
    print("=" * 64)
    print("AutoMarts 4K Showcase - genuine 30 FPS re-render")
    print("=" * 64)

    # 1. Back up the existing 25-fps output so nothing is destroyed.
    if OUTPUT.exists() and not BACKUP.exists():
        print(f"\n1. Backing up existing output -> {BACKUP.name}")
        os.replace(str(OUTPUT), str(BACKUP))
    elif BACKUP.exists():
        print(f"\n1. Backup already present: {BACKUP.name}")

    # 2. Encode each scene clip at 30 fps directly from the PNG frame.
    print("\n2. Encoding 10 scene clips at 30 fps...")
    clips = []
    for frame_name, duration in SCENES:
        frame_path = FRAMES / frame_name
        if not frame_path.exists():
            print(f"  MISSING source frame: {frame_path}")
            return False
        clip_name = f"clip30_{frame_name[:-4]}.mp4"
        clip_path = ASSETS / clip_name
        total_frames = int(duration * FPS)
        cmd = [
            FFMPEG, "-y", "-v", "error",
            "-loop", "1", "-i", str(frame_path),
            "-t", str(duration),
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-crf", "20",
            "-preset", "medium",
            "-r", str(FPS),          # explicit 30 fps output rate
            "-frames:v", str(total_frames),
            str(clip_path),
        ]
        if not (run(cmd, clip_name)
                and clip_path.exists()
                and clip_path.stat().st_size > 2000):
            print(f"  FAIL: {clip_name}")
            return False
        clips.append(str(clip_path))
        print(f"  OK  {clip_name:28s} {duration}s x {FPS}fps = {total_frames} frames "
              f"({clip_path.stat().st_size/1024:.0f} KB)")

    # 3. Concatenate clips.
    print(f"\n3. Concatenating {len(clips)} clips...")
    concat_file = ASSETS / "concat_30fps.txt"
    with open(concat_file, "w") as f:
        for clip in clips:
            f.write(f"file '{clip}'\n")
    intermediate = ASSETS / "intermediate_30fps.mp4"
    cmd = [FFMPEG, "-y", "-v", "error", "-f", "concat", "-safe", "0",
           "-i", str(concat_file), "-c", "copy", str(intermediate)]
    if not run(cmd, "concat"):
        return False
    print(f"  OK  {intermediate.name} ({intermediate.stat().st_size/1024:.0f} KB)")

    # 4. Final encode: force 30 fps, H.264 High, level 5.1, +faststart.
    print("\n4. Final encode at 30 fps...")
    cmd = [
        FFMPEG, "-y", "-v", "error",
        "-i", str(intermediate),
        "-c:v", "libx264",
        "-crf", "20",
        "-preset", "medium",
        "-profile:v", "high",
        "-level", "5.1",
        "-pix_fmt", "yuv420p",
        "-r", str(FPS),
        "-movflags", "+faststart",
        str(OUTPUT),
    ]
    if not run(cmd, "final encode"):
        return False

    # 5. Verify.
    print("\n5. Verification...")
    if not OUTPUT.exists():
        print("  FAIL: output not created")
        return False
    result = subprocess.run(
        [FFPROBE, "-v", "error",
         "-show_entries", "format=duration,size,bit_rate",
         "-show_entries", "stream=codec_name,codec_type,width,height,"
         "r_frame_rate,avg_frame_rate,pix_fmt,profile,level,nb_frames",
         "-of", "default", str(OUTPUT)],
        capture_output=True, text=True)
    print(result.stdout)

    size_mb = OUTPUT.stat().st_size / (1024 * 1024)
    print(f"  Output: {OUTPUT}")
    print(f"  Size:   {size_mb:.2f} MB")
    print("=" * 64)
    return True


if __name__ == "__main__":
    ok = main()
    print("RESULT:", "PASS" if ok else "FAIL")