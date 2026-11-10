#!/usr/bin/env python3
"""Generate video frames for AutoMarts 4K Showcase"""

import subprocess
import os
from pathlib import Path

# FFmpeg full path (winget install)
FFMPEG = r"C:\Users\ALI HAIDER\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe"
FFPROBE = r"C:\Users\ALI HAIDER\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffprobe.exe"

# Paths
VIDEO_DIR = Path("C:/Users/ALI HAIDER/OneDrive/Desktop/parts/.claude/worktrees/elated-mestorf-77dc0f/docs/submission/video")
ASSETS_DIR = VIDEO_DIR / "assets"
FRAMES_DIR = ASSETS_DIR / "frames"

# Specs
WIDTH = 3840
HEIGHT = 2160
FPS = 30

SCENES = [
    {"name": "intro", "title": "AutoMarts", "subtitle": "Auto Parts E-Commerce Platform", "duration": 5, "bg": "solid"},
    {"name": "hero", "title": "Modern Auto Parts Store", "subtitle": "Premium components for Toyota, Honda, Suzuki", "duration": 6, "bg": "solid"},
    {"name": "products", "title": "22+ Genuine Parts", "subtitle": "Engine, Brakes, Suspension, Electrical", "duration": 6, "bg": "grid"},
    {"name": "cart", "title": "Seamless Checkout", "subtitle": "Secure cart with coupon support", "duration": 6, "bg": "solid"},
    {"name": "auth", "title": "MFA Authentication", "subtitle": "TOTP-based security with Google OAuth", "duration": 6, "bg": "solid"},
    {"name": "admin", "title": "Admin Dashboard", "subtitle": "Complete inventory & order management", "duration": 6, "bg": "dashboard"},
    {"name": "security", "title": "Enterprise Security", "subtitle": "Zod validation, Rate limiting, Audit logs", "duration": 6, "bg": "solid"},
    {"name": "outro", "title": "Thank You", "subtitle": "Built with Express + React + SQLite", "duration": 5, "bg": "solid"},
]

def run(cmd):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error: {cmd[:100]}")
        print(f"STDERR: {result.stderr[:200]}")
    return result

def create_scene_frame(scene, output_path):
    """Create a frame for a specific scene using FFmpeg drawtext"""
    if scene["bg"] == "solid":
        cmd = f'''"{FFMPEG}" -y -f lavfi -i color=c=#1c1917:s={WIDTH}x{HEIGHT}:d=1 \
            -vf "drawtext=text='{scene['title']}':fontsize=100:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-60,drawtext=text='{scene['subtitle']}':fontsize=50:fontcolor=#aaaaaa:x=(w-text_w)/2:y=(h-text_h)/2+50" \
            -frames:v 1 "{output_path}"'''
        run(cmd)
    elif scene["bg"] == "grid":
        cmd = f'''"{FFMPEG}" -y -f lavfi -i color=c=#1c1917:s={WIDTH}x{HEIGHT}:d=1 \
            -vf "drawbox=x=200:y=200:w=800:h=500:color=#2a2a2a:t=fill,drawbox=x=1100:y=200:w=800:h=500:color=#2a2a2a:t=fill,drawbox=x=2000:y=200:w=800:h=500:color=#2a2a2a:t=fill,drawbox=x=200:y=750:w=800:h=500:color=#2a2a2a:t=fill,drawbox=x=1100:y=750:w=800:h=500:color=#2a2a2a:t=fill,drawbox=x=2000:y=750:w=800:h=500:color=#2a2a2a:t=fill,drawtext=text='{scene['title']}':fontsize=100:fontcolor=white:x=(w-text_w)/2:y=1600,drawtext=text='{scene['subtitle']}':fontsize=50:fontcolor=#aaaaaa:x=(w-text_w)/2:y=1750" \
            -frames:v 1 "{output_path}"'''
        run(cmd)
    elif scene["bg"] == "dashboard":
        cmd = f'''"{FFMPEG}" -y -f lavfi -i color=c=#1c1917:s={WIDTH}x{HEIGHT}:d=1 \
            -vf "drawbox=x=100:y=100:w=700:h={HEIGHT-200}:color=#c5303040:t=fill,drawbox=x=900:y=100:w={WIDTH-1000}:h=300:color=#2a2a2a:t=fill,drawbox=x=900:y=500:w={WIDTH-1000}:h=300:color=#2a2a2a:t=fill,drawtext=text='{scene['title']}':fontsize=100:fontcolor=white:x=(w-text_w)/2:y=1700,drawtext=text='{scene['subtitle']}':fontsize=50:fontcolor=#aaaaaa:x=(w-text_w)/2:y=1850" \
            -frames:v 1 "{output_path}"'''
        run(cmd)

def create_scene_clip(scene, output_path):
    """Create a video clip for a scene with zoom effect"""
    frame_path = ASSETS_DIR / f"frame_{scene['name']}.png"
    create_scene_frame(scene, str(frame_path))

    duration = scene["duration"]
    fps = FPS
    total_frames = int(duration * fps)

    # Create clip with Ken Burns zoom effect
    cmd = f'''"{FFMPEG}" -y -loop 1 -i "{str(frame_path)}" -t {duration} \
        -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium \
        -vf "zoompan=z='min(1.1,1+0.001*t)':x={WIDTH//2}:y={HEIGHT//2}:d={total_frames}:s={WIDTH}x{HEIGHT}:fps={fps}" \
        -r {fps} "{output_path}"'''
    run(cmd)

def build_final_video():
    """Build the final video by concatenating all clips"""
    clips = []
    for i, scene in enumerate(SCENES):
        clip_path = ASSETS_DIR / f"clip_{i:02d}_{scene['name']}.mp4"
        create_scene_clip(scene, str(clip_path))
        clips.append(str(clip_path))

    # Create concat file
    concat_file = ASSETS_DIR / "concat.txt"
    with open(concat_file, "w") as f:
        for clip in clips:
            f.write(f"file '{clip}'\n")

    # Concatenate
    intermediate = ASSETS_DIR / "intermediate.mp4"
    cmd = f'''"{FFMPEG}" -y -f concat -safe 0 -i "{str(concat_file)}" -c copy "{str(intermediate)}"'''
    run(cmd)

    # Final encode
    output = VIDEO_DIR / "AutoMarts_Project_Showcase_4K.mp4"
    cmd = f'''"{FFMPEG}" -y -i "{str(intermediate)}" -c:v libx264 -crf 18 -preset medium -profile:v high -level 5.1 -pix_fmt yuv420p -movflags +faststart "{str(output)}"'''
    run(cmd)

    return output

def main():
    print("=" * 60)
    print("AutoMarts 4K Video Frame Generator")
    print("=" * 60)

    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    FRAMES_DIR.mkdir(exist_ok=True)

    print("\nGenerating frames...")
    output = build_final_video()

    if output.exists():
        size_mb = output.stat().st_size / (1024 * 1024)
        print(f"\n[OK] Video created: {output}")
        print(f"  Size: {size_mb:.2f} MB")

        # Get duration
        cmd = f'"{FFPROBE}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "{str(output)}"'
        result = run(cmd)
        if result.stdout.strip():
            duration = float(result.stdout.strip())
            print(f"  Duration: {duration:.1f} seconds")

        # Get streams
        cmd = f'"{FFPROBE}" -v error -show_entries stream=codec_name,width,height,r_frame_rate -of default "{str(output)}"'
        result = run(cmd)
        if result.stdout:
            print(f"\nStream info:\n{result.stdout}")
    else:
        print("\n[X] Failed to create video")

if __name__ == "__main__":
    main()
