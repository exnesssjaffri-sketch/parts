#!/usr/bin/env python3
"""Generate voiceover audio for each scene using LLMAPI TTS."""

import os
import sys
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv


def load_config() -> dict:
    """Load configuration from environment variables."""
    load_dotenv()

    config = {
        "base_url": os.getenv("LLMAPI_BASE_URL", "http://127.0.0.1:31415/v1"),
        "api_key": os.getenv("LLMAPI_API_KEY"),
        "model": os.getenv("TTS_MODEL", "auto"),
        "voice": os.getenv("TTS_VOICE", "onyx"),
        "format": os.getenv("TTS_FORMAT", "wav"),
        "speed": float(os.getenv("TTS_SPEED", "1.0")),
        "project_root": Path(os.getenv("PROJECT_ROOT", ".")).resolve(),
        "voiceover_output_dir": Path(os.getenv("VOICEOVER_OUTPUT_DIR", "docs/submission/video/assets/voiceover")).resolve(),
    }

    # Validate required config
    if not config["api_key"]:
        print("ERROR: LLMAPI_API_KEY not set in environment")
        print("Copy .env.example to .env and fill in your API key")
        sys.exit(1)

    # Ensure output directory exists
    config["voiceover_output_dir"].mkdir(parents=True, exist_ok=True)

    return config


# Scene definitions matching VOICEOVER_SCRIPT.md (corrected claims)
SCENES = [
    ("01_intro", "Welcome to AutoMarts — your trusted destination for genuine auto parts."),
    ("02_hero", "AutoMarts delivers a modern auto parts shopping experience with genuine components, competitive pricing, and delivery across Pakistan."),
    ("03_products", "Browse our catalog of genuine parts — from filters and lubricants to batteries and brake components — all sourced from authorized distributors."),
    ("04_categories", "Find exactly what you need with our complete category overview: engine oil, air filters, spark plugs, brake pads, batteries, and every essential system for your vehicle."),
    ("05_cart", "Add parts to your cart and check out seamlessly — guest checkout, real-time inventory, and secure payments ensure a frictionless purchase every time."),
    ("06_auth", "Your account is protected by multi-factor authentication — TOTP authenticator apps, backup codes, and device trust — keeping your orders and payment details secure."),
    ("07_admin", "Administrators get a powerful dashboard: real-time sales analytics, inventory management, order fulfillment tracking, and role-based access control for team collaboration."),
    ("08_security", "Enterprise-grade security underpins everything: row-level policies, encrypted data at rest, audit logging, and rate limiting protect every transaction."),
    ("09_stack", "Built on a modern stack — Vite, React eighteen, Supabase Postgres, TypeScript, Tailwind CSS, and a comprehensive test suite — ready for production scale."),
    ("10_outro", "AutoMarts — genuine parts, real confidence. Start your order at AutoMarts today."),
]


async def generate_voiceover(
    client: httpx.AsyncClient,
    config: dict,
    scene_id: str,
    text: str,
) -> bool:
    """Generate TTS audio for a scene."""
    output_path = config["voiceover_output_dir"] / f"voiceover_{scene_id}.wav"

    payload = {
        "model": config["model"],
        "input": text,
        "voice": config["voice"],
        "response_format": config["format"],
    }

    headers = {
        "Authorization": f"Bearer {config['api_key']}",
        "Content-Type": "application/json",
    }

    url = f"{config['base_url']}/audio/speech"

    print(f"Generating voiceover_{scene_id}.wav...")
    try:
        response = await client.post(url, headers=headers, json=payload, timeout=60.0)

        if response.status_code == 200:
            content_type = response.headers.get("Content-Type", "")
            content = response.content

            if "audio" in content_type or len(content) > 1000:
                output_path.write_bytes(content)
                print(f"  OK: {output_path.name} ({len(content)} bytes)")
                return True
            else:
                print(f"  FAIL: Unexpected content type: {content_type}")
                print(f"  Response: {content[:200]}")
                return False
        else:
            print(f"  FAIL: HTTP {response.status_code}: {response.text[:200]}")
            return False

    except httpx.TimeoutException:
        print(f"  ERROR: Request timed out")
        return False
    except httpx.ConnectError:
        print(f"  ERROR: Could not connect to LLMAPI at {config['base_url']}")
        print(f"  Make sure the LLMAPI gateway is running")
        return False
    except Exception as e:
        print(f"  ERROR: {e}")
        return False


async def main() -> int:
    print("=" * 60)
    print("AutoMarts Voiceover Generation")
    print("=" * 60)

    config = load_config()
    print(f"LLMAPI: {config['base_url']}")
    print(f"Model: {config['model']}, Voice: {config['voice']}")
    print(f"Output: {config['voiceover_output_dir']}")
    print("=" * 60)

    success_count = 0
    async with httpx.AsyncClient() as client:
        for scene_id, text in SCENES:
            if await generate_voiceover(client, config, scene_id, text):
                success_count += 1

    print("=" * 60)
    print(f"Generated: {success_count}/{len(SCENES)} voiceover files")
    print("=" * 60)

    # Verify all files exist
    for scene_id, _ in SCENES:
        path = config["voiceover_output_dir"] / f"voiceover_{scene_id}.wav"
        if path.exists():
            size_kb = path.stat().st_size / 1024
            print(f"  voiceover_{scene_id}.wav: {size_kb:.1f} KB")
        else:
            print(f"  voiceover_{scene_id}.wav: MISSING")

    return 0 if success_count == len(SCENES) else 1


if __name__ == "__main__":
    import asyncio
    sys.exit(asyncio.run(main()))