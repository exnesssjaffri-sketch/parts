#!/usr/bin/env python3
"""Concatenate voiceover clips and render final 4K showcase video."""

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
        "mixed_input_dir": Path(os.getenv("MIXED_OUTPUT_DIR", "docs/submission/video/assets/mixed")).resolve(),
        "final_output_dir": Path(os.getenv("FINAL_OUTPUT_DIR", "docs/submission/video/assets/final")).resolve(),
        "output_filename": os.getenv("FINAL_OUTPUT_FILENAME", "AutoMarts_OpenMontage_Showcase_4K_30fps_Voiceover.mp4"),
    }

    # Ensure output directory exists
    config["final_output_dir"].mkdir(parents=True, exist_ok=True)

    # Verify ffmpeg/ffprobe exist
    for tool_name, tool_path in [("ffmpeg", config["ffmpeg_path"]), ("ffprobe", config["ffprobe_path"])]:
        if not shutil.which(tool_path) and not Path(tool_path).exists():
            print(f"WARNING: {tool_name} not found at '{tool_path}' - ensure it's in PATH")

    return config


import shutil


# Scene definitions matching VOICEOVER_SCRIPT.md
SCENES = [
    "intro", "hero", "products", "categories", "cart",
    "auth", "admin", "security", "stack", "outro"
]


def run(cmd: list, label: str) -> bool:
    """Run a command and return success status."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    except subprocess.TimeoutExpired:
        print(f"  FAIL [{label}]: Command timed out")
        return False

    if result.returncode != 0:
        print(f"  FAIL [{label}]: {result.stderr[-400:]}")
        return False
    return True


def verify_output(ffprobe_path: str, output_path: Path) -> bool:
    """Verify the output video using ffprobe."""
    if not output_path.exists():
        print("  FAIL: output not created")
        return False

    result = subprocess.run([
        ffprobe_path, "-v", "error",
        "-show_entries", "format=duration,size,bit_rate",
        "-show_entries", "stream=codec_name,codec_type,width,height,r_frame_rate,avg_frame_rate,pix_fmt,profile,level,nb_frames",
        "-of", "default", str(output_path)],
        capture_output=True, text=True)

    print(result.stdout)

    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"  Output: {output_path}")
    print(f"  Size:   {size_mb:.2f} MB")
    return True


def decode_test(ffmpeg_path: str, output_path: Path) -> bool:
    """Full decode test to verify video integrity."""
    print("\n5. Full decode verification...")
    result = subprocess.run([ffmpeg_path, "-i", str(output_path), "-f", "null", "-"],
                           capture_output=True, text=True, timeout=120)

    if "frame=" in result.stderr:
        for line in result.stderr.split('\n'):
            if 'frame=' in line and 'fps=' in line:
                print(f"  {line.strip()}")
                break

    if result.returncode == 0:
        print("  OK: Full decode successful - no errors")
        return True
    else:
        print(f"  WARNING: Decode returned code {result.returncode}")
        if result.stderr:
            print(f"  stderr: {result.stderr[-500:]}")
        return False


def main() -> int:
    print("=" * 64)
    print("AutoMarts 4K Showcase - Final Voiceover Render")
    print("=" * 64)

    config = load_config()
    print(f"ffmpeg: {config['ffmpeg_path']}")
    print(f"ffprobe: {config['ffprobe_path']}")
    print(f"Mixed input: {config['mixed_input_dir']}")
    print(f"Final output: {config['final_output_dir']}")
    print(f"Output file: {config['output_filename']}")
    print("=" * 64)

    output_path = config["final_output_dir"] / config["output_filename"]

    # 1. Build concat file for voiceover clips
    print("\n1. Building concat list...")
    concat_file = config["mixed_input_dir"] / "concat_vo.txt"
    missing_count = 0
    with open(concat_file, "w") as f:
        for scene in SCENES:
            clip = config["mixed_input_dir"] / f"clip30_{scene}_vo.mp4"
            if clip.exists():
                f.write(f"file '{clip}'\n")
            else:
                print(f"  MISSING: {clip}")
                missing_count += 1

    if missing_count > 0:
        print(f"  FAIL: {missing_count} clips missing")
        return 1

    print(f"  OK: {concat_file.name} ({len(SCENES)} clips)")

    # 2. Concatenate voiceover clips
    print("\n2. Concatenating voiceover clips...")
    intermediate = config["mixed_input_dir"] / "intermediate_vo.mp4"
    cmd = [
        config["ffmpeg_path"], "-y", "-v", "error",
        "-f", "concat", "-safe", "0",
        "-i", str(concat_file),
        "-c", "copy",
        str(intermediate),
    ]
    if not run(cmd, "concat"):
        return 1
    print(f"  OK: {intermediate.name} ({intermediate.stat().st_size/1024:.0f} KB)")

    # 3. Final encode: force 30 fps, H.264 High, level 5.1, +faststart, AAC audio
    print("\n3. Final encode at 30 fps with AAC 48kHz audio...")
    cmd = [
        config["ffmpeg_path"], "-y", "-v", "error",
        "-i", str(intermediate),
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "slow",
        "-profile:v", "high",
        "-level", "5.1",
        "-pix_fmt", "yuv420p",
        "-r", "30",
        "-g", "60",
        "-c:a", "aac",
        "-b:a", "128k",
        "-ar", "48000",
        "-movflags", "+faststart",
        str(output_path),
    ]
    if not run(cmd, "final encode"):
        return 1

    # 4. Verify
    print("\n4. Verification...")
    if not verify_output(config["ffprobe_path"], output_path):
        return 1

    # 5. Full decode test
    if not decode_test(config["ffmpeg_path"], output_path):
        print("  WARNING: Decode test had issues")

    print("\n" + "=" * 64)
    print("RENDER COMPLETE")
    print("=" * 64)
    return 0


if __name__ == "__main__":
    sys.exit(main())