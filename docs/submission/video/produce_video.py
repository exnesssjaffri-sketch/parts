#!/usr/bin/env python3
"""AutoMarts 4K Showcase Video Producer - PIL + FFmpeg pipeline"""

import subprocess
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# FFmpeg path
FFMPEG = r"C:\Users\ALI HAIDER\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe"
FFPROBE = r"C:\Users\ALI HAIDER\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffprobe.exe"

VIDEO_DIR = Path("C:/Users/ALI HAIDER/OneDrive/Desktop/parts/.claude/worktrees/elated-mestorf-77dc0f/docs/submission/video")
ASSETS = VIDEO_DIR / "assets"
FRAMES = ASSETS / "frames"
OUTPUT = VIDEO_DIR / "AutoMarts_Project_Showcase_4K.mp4"

WIDTH, HEIGHT, FPS = 3840, 2160, 30

SCENES = [
    {"name": "intro", "title": "AutoMarts", "subtitle": "Auto Parts E-Commerce Platform", "duration": 5},
    {"name": "hero", "title": "Modern Auto Parts Store", "subtitle": "Premium components for Toyota, Honda, Suzuki", "duration": 6},
    {"name": "products", "title": "22+ Genuine Parts", "subtitle": "Engine, Brakes, Suspension, Electrical", "duration": 6},
    {"name": "cart", "title": "Seamless Checkout", "subtitle": "Secure cart with coupon support", "duration": 6},
    {"name": "auth", "title": "MFA Authentication", "subtitle": "TOTP-based security with Google OAuth", "duration": 6},
    {"name": "admin", "title": "Admin Dashboard", "subtitle": "Complete inventory & order management", "duration": 6},
    {"name": "security", "title": "Enterprise Security", "subtitle": "Zod validation, Rate limiting, Audit logs", "duration": 6},
    {"name": "outro", "title": "Thank You", "subtitle": "Built with Express + React + SQLite", "duration": 5},
]

def get_font(size):
    """Try to get a TrueType font, fallback to default"""
    for f in ["arial.ttf", "calibri.ttf", "segoeui.ttf", "times.ttf"]:
        try:
            return ImageFont.truetype(f, size)
        except:
            continue
    return ImageFont.load_default()

def create_scene_frame(scene_data):
    """Create a high-quality frame using PIL"""
    name = scene_data["name"]
    title = scene_data["title"]
    subtitle = scene_data["subtitle"]

    img = Image.new("RGB", (WIDTH, HEIGHT), (28, 25, 23))
    draw = ImageDraw.Draw(img)

    # Red accent bar at top
    red_color = (197, 48, 48)
    draw.rectangle([(0, 0), (WIDTH, 10)], fill=red_color)

    # Draw a subtle UI mockup area
    if name == "products":
        # Product grid simulation
        for row in range(3):
            for col in range(4):
                x = 200 + col * 900
                y = 300 + row * 500
                draw.rectangle([(x, y), (x + 850, y + 450)],
                              fill=(40, 36, 34), outline=(60, 60, 60, 100), width=3)
    elif name == "admin":
        # Dashboard sidebar
        draw.rectangle([(0, 10), (500, HEIGHT)], fill=(35, 32, 30))
        draw.rectangle([(0, 10), (500, 100)], fill=red_color)
        # Content cards
        for i in range(4):
            x = 600 + (i % 2) * 1500
            y = 200 + (i // 2) * 500
            draw.rectangle([(x, y), (x + 1400, y + 400)],
                          fill=(35, 32, 30), outline=(50, 50, 50), width=2)

    # Title
    title_font = get_font(120)
    bbox = draw.textbbox((0, 0), title, font=title_font)
    text_w = bbox[2] - bbox[0]
    x = (WIDTH - text_w) // 2
    y = (HEIGHT - 200) // 2 - 60
    draw.text((x, y), title, fill=(255, 255, 255), font=title_font)

    # Subtitle
    sub_font = get_font(55)
    bbox2 = draw.textbbox((0, 0), subtitle, font=sub_font)
    text_w2 = bbox2[2] - bbox2[0]
    x2 = (WIDTH - text_w2) // 2
    y2 = y + 160
    draw.text((x2, y2), subtitle, fill=(180, 180, 180), font=sub_font)

    # Scene number
    num_font = get_font(40)
    draw.text((WIDTH - 150, 50), f"{SCENES.index(scene_data) + 1}/{len(SCENES)}",
              fill=(100, 100, 100), font=num_font)

    # Bottom brand bar
    draw.rectangle([(0, HEIGHT - 80), (WIDTH, HEIGHT)], fill=red_color)

    frame_path = FRAMES / f"{name}.png"
    img.save(str(frame_path), "PNG")
    return frame_path

def create_clip_from_frame(frame_path, output_path, duration):
    """Create a video clip from a still frame with zoom animation"""
    total_frames = int(duration * FPS)

    cmd = [
        FFMPEG, "-y",
        "-loop", "1", "-i", str(frame_path),
        "-t", str(duration),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-crf", "18",
        "-preset", "medium",
        "-vf", f"zoompan=z='min(1.1,1+0.001*t)':x={WIDTH//2}:y={HEIGHT//2}:d={total_frames}:s={WIDTH}x{HEIGHT}:fps={FPS}",
        "-r", str(FPS),
        str(output_path)
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        return True
    print(f"  FFmpeg error for {output_path.name}: {result.stderr[:200]}")
    return False

def build_video():
    """Main video production pipeline"""
    print("=" * 60)
    print("AutoMarts 4K Showcase Video Producer")
    print("=" * 60)

    ASSETS.mkdir(parents=True, exist_ok=True)
    FRAMES.mkdir(exist_ok=True)

    print("\n1. Creating scene frames with PIL...")
    clip_paths = []

    for i, scene in enumerate(SCENES):
        print(f"   Scene {i+1}: {scene['name']}")
        frame_path = create_scene_frame(scene)
        clip_path = ASSETS / f"clip_{i:02d}_{scene['name']}.mp4"
        clip_paths.append(str(clip_path))

        if create_clip_from_frame(frame_path, clip_path, scene["duration"]):
            print(f"      -> Created clip ({scene['duration']}s)")
        else:
            print(f"      -> FAILED")

    print("\n2. Concatenating clips...")
    concat_file = ASSETS / "concat.txt"
    with open(concat_file, "w") as f:
        for clip in clip_paths:
            f.write(f"file '{clip}'\n")

    intermediate = ASSETS / "intermediate.mp4"
    cmd = [FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file), "-c", "copy", str(intermediate)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  Concat failed: {result.stderr[:200]}")
        return False

    print("\n3. Final encoding...")
    cmd = [
        FFMPEG, "-y", "-i", str(intermediate),
        "-c:v", "libx264", "-crf", "18", "-preset", "medium",
        "-profile:v", "high", "-level", "5.1",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(OUTPUT)
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  Final encode failed: {result.stderr[:300]}")
        return False

    print("\n4. Verifying output...")
    if not OUTPUT.exists():
        print("  ERROR: Output file not created")
        return False

    size_mb = OUTPUT.stat().st_size / (1024 * 1024)
    print(f"  Output: {OUTPUT}")
    print(f"  Size: {size_mb:.2f} MB")

    # Get video info
    cmd = [FFPROBE, "-v", "error", "-show_entries", "format=duration,size,bit_rate",
           "-show_entries", "stream=codec_name,width,height,r_frame_rate",
           "-of", "default", str(OUTPUT)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    print(f"\n  Stream info:\n{result.stdout}")

    return True

if __name__ == "__main__":
    success = build_video()
    if success:
        print("\n" + "=" * 60)
        print("SUCCESS: Video production complete!")
        print(f"File: {OUTPUT}")
        print("=" * 60)
    else:
        print("\nFAILED: Video production failed")
