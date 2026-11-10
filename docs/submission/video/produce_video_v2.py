#!/usr/bin/env python3
"""AutoMarts 4K Showcase Video Producer - Extended Version (75-100s)"""

import subprocess
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FFMPEG = r"C:\Users\ALI HAIDER\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe"
FFPROBE = r"C:\Users\ALI HAIDER\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffprobe.exe"

VIDEO_DIR = Path("C:/Users/ALI HAIDER/OneDrive/Desktop/parts/.claude/worktrees/elated-mestorf-77dc0f/docs/submission/video")
ASSETS = VIDEO_DIR / "assets"
FRAMES = ASSETS / "frames"
OUTPUT = VIDEO_DIR / "AutoMarts_Project_Showcase_4K.mp4"

WIDTH, HEIGHT, FPS = 3840, 2160, 30

SCENES = [
    {"name": "intro", "title": "AutoMarts", "subtitle": "Auto Parts E-Commerce Platform", "duration": 6},
    {"name": "hero", "title": "Modern Auto Parts Store", "subtitle": "Premium components for Toyota, Honda, Suzuki", "duration": 8},
    {"name": "products", "title": "22+ Genuine Parts", "subtitle": "Engine, Brakes, Suspension, Electrical & More", "duration": 8},
    {"name": "categories", "title": "Complete Categories", "subtitle": "Filters, Oils, Batteries, Body Parts", "duration": 8},
    {"name": "cart", "title": "Seamless Checkout", "subtitle": "Secure cart with coupon & discount support", "duration": 8},
    {"name": "auth", "title": "MFA Authentication", "subtitle": "TOTP-based security with Google OAuth", "duration": 8},
    {"name": "admin", "title": "Admin Dashboard", "subtitle": "Complete inventory & order management", "duration": 8},
    {"name": "security", "title": "Enterprise Security", "subtitle": "Zod validation, Rate limiting, Audit logs", "duration": 8},
    {"name": "stack", "title": "Tech Stack", "subtitle": "Express + React + sql.js + Supabase", "duration": 8},
    {"name": "outro", "title": "Thank You", "subtitle": "Built with ❤️ using modern web technologies", "duration": 6},
]

def get_font(size):
    for f in ["arial.ttf", "calibri.ttf", "segoeui.ttf", "times.ttf"]:
        try:
            return ImageFont.truetype(f, size)
        except:
            continue
    return ImageFont.load_default()

def create_scene_frame(scene_data):
    name = scene_data["name"]
    title = scene_data["title"]
    subtitle = scene_data["subtitle"]
    idx = SCENES.index(scene_data) + 1

    img = Image.new("RGB", (WIDTH, HEIGHT), (28, 25, 23))
    draw = ImageDraw.Draw(img)

    red_color = (197, 48, 48)

    # Top accent bar
    draw.rectangle([(0, 0), (WIDTH, 12)], fill=red_color)

    # Decorative elements based on scene
    if name == "products":
        for row in range(3):
            for col in range(4):
                x = 250 + col * 900
                y = 350 + row * 500
                draw.rectangle([(x, y), (x + 850, y + 450)],
                              fill=(40, 36, 34), outline=(80, 80, 80), width=3)
    elif name == "categories":
        cats = ["Engine Parts", "Brake System", "Suspension", "Filters", "Electrical", "Oils & Fluids"]
        for i, cat in enumerate(cats):
            x = 200 + (i % 3) * 1200
            y = 300 + (i // 3) * 500
            draw.rectangle([(x, y), (x + 1100, y + 400)],
                          fill=(40, 36, 34), outline=red_color, width=4)
            draw.text((x + 50, y + 150), cat, fill=red_color, font=get_font(60))
    elif name == "admin":
        draw.rectangle([(0, 12), (600, HEIGHT)], fill=(35, 32, 30))
        draw.rectangle([(0, 12), (600, 120)], fill=red_color)
        for i in range(6):
            x = 750 + (i % 3) * 1100
            y = 250 + (i // 3) * 450
            draw.rectangle([(x, y), (x + 1000, y + 380)],
                          fill=(40, 36, 34), outline=(70, 70, 70), width=2)
    elif name == "stack":
        techs = ["Express.js", "React 18", "TypeScript", "sql.js", "Supabase", "Vitest"]
        for i, tech in enumerate(techs):
            x = 300 + (i % 3) * 1100
            y = 400 + (i // 3) * 500
            draw.rounded_rectangle([(x, y), (x + 1000, y + 400)], radius=20,
                                  fill=(40, 36, 34), outline=red_color, width=4)
            draw.text((x + 100, y + 130), tech, fill=red_color, font=get_font(70))

    # Title
    title_font = get_font(130)
    bbox = draw.textbbox((0, 0), title, font=title_font)
    text_w = bbox[2] - bbox[0]
    x = (WIDTH - text_w) // 2
    y = (HEIGHT - 250) // 2 - 50
    draw.text((x, y), title, fill=(255, 255, 255), font=title_font)

    # Subtitle
    sub_font = get_font(60)
    bbox2 = draw.textbbox((0, 0), subtitle, font=sub_font)
    text_w2 = bbox2[2] - bbox2[0]
    x2 = (WIDTH - text_w2) // 2
    draw.text((x2, y + 200), subtitle, fill=(180, 180, 180), font=sub_font)

    # Scene number
    num_font = get_font(45)
    draw.text((WIDTH - 180, 60), f"{idx}/{len(SCENES)}", fill=(80, 80, 80), font=num_font)

    # Bottom brand bar
    draw.rectangle([(0, HEIGHT - 90), (WIDTH, HEIGHT)], fill=red_color)

    frame_path = FRAMES / f"{name}.png"
    img.save(str(frame_path), "PNG")
    return frame_path

def encode_clip(clip_name, frame_name, duration):
    frame_path = FRAMES / frame_name
    clip_path = ASSETS / clip_name

    if not frame_path.exists():
        return False

    total_frames = int(duration * FPS)
    cmd = [
        FFMPEG, "-y",
        "-loop", "1",
        "-i", str(frame_path),
        "-t", str(duration),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-crf", "20",
        "-preset", "medium",
        "-frames:v", str(total_frames),
        str(clip_path)
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0 and clip_path.exists() and clip_path.stat().st_size > 2000:
        return True
    return False

def main():
    print("=" * 60)
    print("AutoMarts 4K Showcase Video Producer (v2)")
    print("=" * 60)

    ASSETS.mkdir(parents=True, exist_ok=True)
    FRAMES.mkdir(exist_ok=True)

    print("\n1. Creating scene frames...")
    clips = []

    for scene in SCENES:
        print(f"   {scene['name']} ({scene['duration']}s)")
        create_scene_frame(scene)
        clip_path = ASSETS / f"clip_{scene['name']}.mp4"
        if encode_clip(f"clip_{scene['name']}.mp4", f"{scene['name']}.png", scene["duration"]):
            clips.append(str(clip_path))
            size_kb = clip_path.stat().st_size / 1024
            print(f"      -> {size_kb:.0f} KB")
        else:
            print(f"      -> FAILED")

    print(f"\n2. Concatenating {len(clips)} clips...")
    concat_file = ASSETS / "concat.txt"
    with open(concat_file, "w") as f:
        for clip in clips:
            f.write(f"file '{clip}'\n")

    intermediate = ASSETS / "intermediate.mp4"
    cmd = [FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file), "-c", "copy", str(intermediate)]
    result = subprocess.run(cmd, capture_output=True, text=True)

    print("3. Final encoding...")
    cmd = [
        FFMPEG, "-y", "-i", str(intermediate),
        "-c:v", "libx264", "-crf", "20", "-preset", "medium",
        "-profile:v", "high", "-level", "5.1",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(OUTPUT)
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)

    if OUTPUT.exists() and OUTPUT.stat().st_size > 10000:
        size_mb = OUTPUT.stat().st_size / (1024 * 1024)
        cmd = [FFPROBE, "-v", "error", "-show_entries", "format=duration,size,bit_rate",
               "-show_entries", "stream=codec_name,width,height,r_frame_rate",
               "-of", "default", str(OUTPUT)]
        result = subprocess.run(cmd, capture_output=True, text=True)

        print(f"\n{'='*60}")
        print(f"SUCCESS: Video created!")
        print(f"Output: {OUTPUT}")
        print(f"Size: {size_mb:.2f} MB")
        print(f"\nVideo info:")
        print(result.stdout)
        print(f"{'='*60}")
        return True
    else:
        print("FAILED: Video not created properly")
        return False

if __name__ == "__main__":
    main()
