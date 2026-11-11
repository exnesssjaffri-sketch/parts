#!/usr/bin/env python3
"""Generate TTS audio files for each scene using edge-tts.
Called by: Manual execution after voiceover_scripts.json is created.
No existing file serves this purpose.
Reads: voiceover_scripts.json (scene scripts)
Writes: assets/audio/{scene_id}_voiceover.mp3 files
User instruction: Continue the conversation from where it left off without asking the user any further questions.
"""
import json
import asyncio
import edge_tts
import os

SCRIPTS_FILE = "voiceover_scripts.json"
OUTPUT_DIR = "assets/audio"
VOICE = "en-US-GuyNeural"  # Professional male voice

async def generate_audio(scene_id, text, output_path):
    """Generate TTS audio for a scene."""
    communicate = edge_tts.Communicate(text, VOICE)
    await communicate.save(output_path)
    print(f"[OK] Generated: {output_path}")

async def main():
    # Read scripts
    with open(SCRIPTS_FILE, 'r') as f:
        data = json.load(f)

    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Generate audio for each scene
    for scene in data["scenes"]:
        scene_id = scene["id"]
        script = scene["script"]
        output_file = os.path.join(OUTPUT_DIR, f"{scene_id}_voiceover.mp3")
        await generate_audio(scene_id, script, output_file)

    print("\n[OK] All voiceover audio files generated!")

if __name__ == "__main__":
    asyncio.run(main())