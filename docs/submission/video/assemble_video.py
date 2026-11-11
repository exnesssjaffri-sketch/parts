#!/usr/bin/env python3
"""Assemble final 4K promotional video using FFmpeg.
Called by: Manual execution after audio files are generated.
No existing file serves this purpose.
Reads: voiceover_scripts.json (scene timing), assets/source_clips/*.webm, assets/audio/*_voiceover.mp3
Writes: assets/automarts_promo_4k.mp4 (final output)
User instruction: Continue the conversation from where it left off without asking the user any further questions.
"""
import json
import subprocess
import os

SCRIPTS_FILE = "voiceover_scripts.json"
SOURCE_DIR = "assets/source_clips"
AUDIO_DIR = "assets/audio"
TEMP_DIR = "assets/temp"
OUTPUT_FILE = "assets/automarts_promo_4k.mp4"

def get_media_duration(filepath):
    """Get duration of media file using ffprobe."""
    cmd = [
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1', filepath
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return float(result.stdout.strip())

def has_audio_stream(filepath):
    """Check if file has an audio stream."""
    cmd = [
        'ffprobe', '-v', 'error', '-select_streams', 'a',
        '-show_entries', 'stream=codec_type',
        '-of', 'default=noprint_wrappers=1:nokey=1', filepath
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout.strip() != ""

def process_scene(scene, index):
    """Process a single scene: scale video, mix audio, trim to target duration."""
    scene_id = scene["id"]
    clip = os.path.join(SOURCE_DIR, scene["clip"])
    audio = os.path.join(AUDIO_DIR, f"{scene_id}_voiceover.mp3")
    target_dur = scene["duration"]
    output = os.path.join(TEMP_DIR, f"{scene_id}_processed.mp4")

    # Video filter: scale to 4K, pad, set fps, trim
    vf = (
        f"scale=3840:2160:force_original_aspect_ratio=decrease,"
        f"pad=3840:2160:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,"
        f"trim=duration={target_dur}"
    )

    # Check if video has audio
    clip_has_audio = has_audio_stream(clip)

    if clip_has_audio:
        # Video has audio - mix with voiceover
        af = (
            f"[0:a]volume=0.1[a_orig];"
            f"[1:a]volume=1.0,atrim=duration={target_dur},apad=whole_dur={target_dur}[a_vo];"
            f"[a_orig][a_vo]amix=inputs=2:duration=first[aout]"
        )
        map_audio = '[aout]'
    else:
        # Video has no audio - use voiceover with silent base
        af = (
            f"anullsrc=r=44100:cl=stereo:d={target_dur}[silent];"
            f"[1:a]volume=1.0,atrim=duration={target_dur},apad=whole_dur={target_dur}[a_vo];"
            f"[silent][a_vo]amix=inputs=2:duration=first[aout]"
        )
        map_audio = '[aout]'

    cmd = [
        'ffmpeg', '-y',
        '-i', clip, '-i', audio,
        '-filter_complex', af,
        '-vf', vf,
        '-map', '0:v', '-map', map_audio,
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k',
        output
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[FAILED] Scene {scene_id}: {result.stderr[-1500:]}")
        return None

    print(f"[OK] Processed {scene_id} -> {output}")
    return output

def concatenate_videos(video_files):
    """Concatenate processed videos using concat demuxer."""
    # Create concat list file
    list_file = os.path.join(TEMP_DIR, "concat_list.txt")
    with open(list_file, 'w') as f:
        for vf in video_files:
            f.write(f"file '{os.path.abspath(vf)}'\n")

    cmd = [
        'ffmpeg', '-y',
        '-f', 'concat', '-safe', '0',
        '-i', list_file,
        '-c', 'copy',
        '-movflags', '+faststart',
        OUTPUT_FILE
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[FAILED] Concatenation: {result.stderr[-1000:]}")
        return False

    print(f"\n[OK] Final video created: {OUTPUT_FILE}")
    return True

def main():
    # Read scripts for timing
    with open(SCRIPTS_FILE, 'r') as f:
        data = json.load(f)

    # Create temp directory
    os.makedirs(TEMP_DIR, exist_ok=True)

    # Verify all source clips and audio exist
    for scene in data["scenes"]:
        scene_id = scene["id"]
        clip = os.path.join(SOURCE_DIR, scene["clip"])
        audio = os.path.join(AUDIO_DIR, f"{scene_id}_voiceover.mp3")

        if not os.path.exists(clip):
            print(f"[FAILED] Missing clip: {clip}")
            return
        if not os.path.exists(audio):
            print(f"[FAILED] Missing audio: {audio}")
            return

        clip_dur = get_media_duration(clip)
        audio_dur = get_media_duration(audio)
        target_dur = scene["duration"]
        print(f"[{scene_id}] Clip: {clip_dur:.2f}s, Audio: {audio_dur:.2f}s, Target: {target_dur}s")

    print("\n[OK] All source files verified. Processing scenes...")

    # Process each scene
    processed_files = []
    for i, scene in enumerate(data["scenes"]):
        output = process_scene(scene, i)
        if output:
            processed_files.append(output)
        else:
            print(f"[FAILED] Stopping at scene {scene['id']}")
            return

    print(f"\n[OK] All {len(processed_files)} scenes processed. Concatenating...")

    # Concatenate
    if concatenate_videos(processed_files):
        # Verify output
        dur = get_media_duration(OUTPUT_FILE)
        size = os.path.getsize(OUTPUT_FILE)
        print(f"Duration: {dur:.2f}s, Size: {size/1024/1024:.2f} MB")
        print("\n[SUCCESS] AutoMarts 4K Promotional Video Complete!")
    else:
        print("[FAILED] Video assembly failed")

if __name__ == "__main__":
    main()