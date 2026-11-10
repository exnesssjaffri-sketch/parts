#!/usr/bin/env python3
"""Mix voiceover audio with video clips, adjusting audio speed to match clip durations."""

import os
import sys
import subprocess
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv


def load_config() -> dict:
    """Load configuration from environment variables."""
    load_dotenv()

    config = {
        "ffmpeg_path": os.getenv("FFMPEG_PATH", "ffmpeg"),
        "ffprobe_path": os.getenv("FFPROBE_PATH", "ffprobe"),
        "project_root": Path(os.getenv("PROJECT_ROOT", ".")).resolve(),
        "source_clips_dir": Path(os.getenv("SOURCE_CLIPS_DIR", "docs/submission/video/assets/source_clips")).resolve(),
        "voiceover_input_dir": Path(os.getenv("VOICEOVER_OUTPUT_DIR", "docs/submission/video/assets/voiceover")).resolve(),
        "mixed_output_dir": Path(os.getenv("MIXED_OUTPUT_DIR", "docs/submission/video/assets/mixed")).resolve(),
    }

    # Ensure output directory exists
    config["mixed_output_dir"].mkdir(parents=True, exist_ok=True)

    # Verify ffmpeg/ffprobe exist
    for tool_name, tool_path in [("ffmpeg", config["ffmpeg_path"]), ("ffprobe", config["ffprobe_path"])]:
        if not shutil.which(tool_path) and not Path(tool_path).exists():
            print(f"WARNING: {tool_name} not found at '{tool_path}' - ensure it's in PATH")

    return config


import shutil


# Scene definitions matching VOICEOVER_SCRIPT.md
SCENES = [
    ("01_intro", "intro", 6.0),
    ("02_hero", "hero", 8.0),
    ("03_products", "products", 8.0),
    ("04_categories", "categories", 8.0),
    ("05_cart", "cart", 8.0),
    ("06_auth", "auth", 8.0),
    ("07_admin", "admin", 8.0),
    ("08_security", "security", 8.0),
    ("09_stack", "stack", 8.0),
    ("10_outro", "outro", 6.0),
]


def get_audio_duration(ffprobe_path: str, wav_path: Path) -> Optional[float]:
    """Get duration of audio file in seconds."""
    try:
        result = subprocess.run([
            ffprobe_path, "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(wav_path)
        ], capture_output=True, text=True, timeout=10)

        if result.returncode != 0:
            print(f"  ERROR: ffprobe failed: {result.stderr.strip()}")
            return None

        return float(result.stdout.strip())
    except subprocess.TimeoutExpired:
        print(f"  ERROR: ffprobe timed out")
        return None
    except ValueError:
        print(f"  ERROR: Could not parse ffprobe output: {result.stdout.strip()}")
        return None
    except Exception as e:
        print(f"  ERROR: {e}")
        return None


def mix_scene(config: dict, scene_id: str, scene_name: str, target_duration: float) -> bool:
    """Mix voiceover with video clip, adjusting audio speed."""
    video_in = config["source_clips_dir"] / f"clip30_{scene_name}.mp4"
    audio_in = config["voiceover_input_dir"] / f"voiceover_{scene_id}.wav"
    video_out = config["mixed_output_dir"] / f"clip30_{scene_name}_vo.mp4"

    if not video_in.exists():
        print(f"  MISSING video: {video_in}")
        return False
    if not audio_in.exists():
        print(f"  MISSING audio: {audio_in}")
        return False

    # Get actual audio duration
    audio_duration = get_audio_duration(config["ffprobe_path"], audio_in)
    if audio_duration is None:
        return False

    speed_ratio = audio_duration / target_duration

    # atempo filter: values between 0.5 and 2.0
    # If ratio > 2.0 or < 0.5, chain multiple atempo filters
    if speed_ratio > 2.0:
        atempo_filter = f"atempo=2.0,atempo={speed_ratio/2.0:.4f}"
    elif speed_ratio < 0.5:
        atempo_filter = f"atempo=0.5,atempo={speed_ratio/0.5:.4f}"
    else:
        atempo_filter = f"atempo={speed_ratio:.4f}"

    print(f"  {scene_name}: audio={audio_duration:.2f}s, target={target_duration}s, speed={speed_ratio:.3f}x -> {atempo_filter}")

    cmd = [
        config["ffmpeg_path"], "-y", "-v", "error",
        "-i", str(video_in),
        "-i", str(audio_in),
        "-filter_complex", f"[1:a]{atempo_filter}[aout]",
        "-map", "0:v",
        "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "128k",
        "-ar", "48000",
        "-shortest",
        str(video_out),
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    except subprocess.TimeoutExpired:
        print(f"  FAIL: ffmpeg timed out")
        return False

    if result.returncode != 0:
        print(f"  FAIL: {result.stderr[-500:]}")
        return False

    if video_out.exists() and video_out.stat().st_size > 1000:
        print(f"  OK: {video_out.name} ({video_out.stat().st_size/1024:.0f} KB)")
        return True
    else:
        print(f"  FAIL: Output not created or empty")
        return False


def main() -> int:
    print("=" * 60)
    print("Mixing Voiceover with Video Clips")
    print("=" * 60)

    config = load_config()
    print(f"ffmpeg: {config['ffmpeg_path']}")
    print(f"ffprobe: {config['ffprobe_path']}")
    print(f"Source clips: {config['source_clips_dir']}")
    print(f"Voiceover input: {config['voiceover_input_dir']}")
    print(f"Mixed output: {config['mixed_output_dir']}")
    print("=" * 60)

    success = 0
    for scene_id, scene_name, target_duration in SCENES:
        print(f"\nProcessing {scene_name}...")
        if mix_scene(config, scene_id, scene_name, target_duration):
            success += 1

    print("\n" + "=" * 60)
    print(f"Mixed: {success}/{len(SCENES)} clips")
    print("=" * 60)

    return 0 if success == len(SCENES) else 1


if __name__ == "__main__":
    sys.exit(main())