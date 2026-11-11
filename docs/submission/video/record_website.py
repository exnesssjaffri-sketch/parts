#!/usr/bin/env python3
"""
Record actual AutoMarts website using Playwright for cinematic video production.
Captures real interactions: homepage, products, categories, cart, checkout, auth, admin.
Saves both video recordings (.webm) and PNG frames.
"""

import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path
from playwright.async_api import async_playwright

# Configuration
BASE_URL = "http://localhost:5181"
OUTPUT_DIR = Path("docs/submission/video/assets/source_clips")
FRAMES_DIR = Path("docs/submission/video/assets/frames")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
FRAMES_DIR.mkdir(parents=True, exist_ok=True)

# Screen resolution for 4K recording
VIEWPORT = {"width": 3840, "height": 2160}

# Test user credentials (demo users from seed data)
TEST_USER = {
    "email": "test@example.com",
    "password": "TestPassword123!",
    "mfa_secret": "JBSWY3DPEHPK3PXP"  # Base32 secret for TOTP
}

ADMIN_USER = {
    "email": "admin@automarts.pk",
    "password": "changeme123"
}

async def verify_recording(filepath: Path):
    """Verify recording exists, has non-zero size, and can be decoded by FFmpeg."""
    if not filepath.exists():
        print(f"  [MISSING] {filepath}")
        return False
    if filepath.stat().st_size == 0:
        print(f"  [EMPTY] {filepath}")
        return False
    # Try to decode with ffprobe
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(filepath)],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0 and result.stdout.strip():
            duration = float(result.stdout.strip())
            print(f"  [OK] {filepath.name} ({filepath.stat().st_size:,} bytes, {duration:.2f}s)")
            return True
        else:
            print(f"  [INVALID] {filepath.name} - {result.stderr}")
            return False
    except Exception as e:
        print(f"  [FFmpeg check failed] {e}")
        return False

async def record_homepage(page, context):
    """Record homepage loading and scrolling."""
    print("Recording homepage...")

    # Start recording
    await page.goto(BASE_URL)
    await page.wait_for_load_state("networkidle")
    await page.wait_for_load_state("domcontentloaded")

    # Wait for React app to hydrate and render - check for any rendered content
    try:
        await page.wait_for_function("""
            () => {
                // Check root element
                const root = document.getElementById('root');
                if (root && root.innerHTML && root.innerHTML.trim() !== '') return true;
                // Check body for any meaningful content
                if (document.body && document.body.textContent && document.body.textContent.trim().length > 50) return true;
                // Check for common React elements
                if (document.querySelector('main') || document.querySelector('header') || document.querySelector('h1')) return true;
                return false;
            }
        """, timeout=30000)
    except Exception as e:
        print(f"  [WARN] Wait for React content timed out, continuing anyway: {e}")

    # Wait additional time for all animations and content to settle
    await page.wait_for_timeout(3000)

    # Scroll down slowly to capture the full homepage
    await page.evaluate("window.scrollTo(0, 500)")
    await page.wait_for_timeout(2000)
    await page.evaluate("window.scrollTo(0, 1500)")
    await page.wait_for_timeout(2000)
    await page.evaluate("window.scrollTo(0, 0)")
    await page.wait_for_timeout(2000)

    # Save frame
    await page.screenshot(path=FRAMES_DIR / "homepage_final.png", full_page=True)
    print("Homepage recorded")
    return True

async def record_products(page, context):
    """Record product catalog browsing."""
    print("Recording products...")

    await page.goto(f"{BASE_URL}/products")
    await page.wait_for_load_state("networkidle")
    try:
        await page.wait_for_selector(".grid", timeout=30000)
    except:
        print("  [WARN] Grid selector not found, continuing anyway")
        pass
    await page.wait_for_timeout(2000)

    # Hover over product cards
    cards = await page.query_selector_all(".ProductCard")
    for i, card in enumerate(cards[:3]):
        await card.hover()
        await page.wait_for_timeout(500)

    # Click on a featured product
    if cards:
        await cards[0].click()
        await page.wait_for_load_state("networkidle")
        try:
            await page.wait_for_selector("h1", timeout=30000)
        except:
            print("  [WARN] h1 selector not found, continuing anyway")
            pass
        await page.wait_for_timeout(1500)

        # Scroll product details
        await page.evaluate("window.scrollTo(0, 800)")
        await page.wait_for_timeout(1000)
        await page.evaluate("window.scrollTo(0, 0)")
        await page.wait_for_timeout(1000)

        # Go back to products
        await page.go_back()
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(1000)

    # Save frame
    await page.screenshot(path=FRAMES_DIR / "products_final.png", full_page=True)
    print("Products recorded")
    return True

async def record_categories(page, context):
    """Record category navigation."""
    print("Recording categories...")

    await page.goto(f"{BASE_URL}/products")
    await page.wait_for_load_state("networkidle")

    # Click on first category
    category_links = await page.query_selector_all("a[href*='/products?category']")
    if category_links:
        await category_links[0].click()
        await page.wait_for_load_state("networkidle")
        try:
            await page.wait_for_selector(".grid", timeout=30000)
        except:
            print("  [WARN] Grid selector not found, continuing anyway")
            pass
        await page.wait_for_timeout(2000)

        # Scroll category products
        await page.evaluate("window.scrollTo(0, 1000)")
        await page.wait_for_timeout(1000)
        await page.evaluate("window.scrollTo(0, 0)")
        await page.wait_for_timeout(1000)

        # Go back
        await page.go_back()
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(1000)

    # Save frame
    await page.screenshot(path=FRAMES_DIR / "categories_final.png", full_page=True)
    print("Categories recorded")
    return True

async def record_cart_checkout(page, context):
    """Record cart and checkout flow."""
    print("Recording cart and checkout...")

    await page.goto(f"{BASE_URL}/products")
    await page.wait_for_load_state("networkidle")

    # Add first product to cart
    add_buttons = await page.query_selector_all("button:has-text('Add to Cart')")
    if add_buttons:
        await add_buttons[0].click()
        await page.wait_for_timeout(1000)

        # Check cart badge
        cart_badge = await page.query_selector(".CartBadge")
        if cart_badge:
            await cart_badge.hover()
            await page.wait_for_timeout(500)

        # Go to cart
        await page.goto(f"{BASE_URL}/cart")
        await page.wait_for_load_state("networkidle")
        try:
            await page.wait_for_selector(".cart-items", timeout=30000)
        except:
            print("  [WARN] .cart-items selector not found, continuing anyway")
            pass
        await page.wait_for_timeout(2000)

        # Update quantity
        qty_inputs = await page.query_selector_all("input[type='number']")
        if qty_inputs:
            await qty_inputs[0].fill("2")
            await page.wait_for_timeout(500)

        # Proceed to checkout
        checkout_btn = await page.query_selector("button:has-text('Proceed to Checkout')")
        if checkout_btn:
            await checkout_btn.click()
            await page.wait_for_load_state("networkidle")
            try:
                await page.wait_for_selector("h1", timeout=30000)
            except:
                print("  [WARN] h1 selector not found, continuing anyway")
                pass
            await page.wait_for_timeout(2000)

            # Scroll checkout form
            await page.evaluate("window.scrollTo(0, 800)")
            await page.wait_for_timeout(1000)
            await page.evaluate("window.scrollTo(0, 0)")
            await page.wait_for_timeout(1000)

    # Save frame
    await page.screenshot(path=FRAMES_DIR / "cart_checkout_final.png", full_page=True)
    print("Cart and checkout recorded")
    return True

async def record_auth_mfa(page, context):
    """Record authentication and MFA screens."""
    print("Recording auth and MFA...")

    # Login page
    await page.goto(f"{BASE_URL}/login")
    await page.wait_for_load_state("networkidle")
    try:
        await page.wait_for_selector("form", timeout=30000)
    except:
        print("  [WARN] form selector not found, continuing anyway")
        pass

    # Fill credentials
    await page.fill('input[type="email"]', TEST_USER["email"])
    await page.fill('input[type="password"]', TEST_USER["password"])
    await page.wait_for_timeout(1000)

    # Submit login
    submit_btn = await page.query_selector("button[type='submit']")
    if submit_btn:
        await submit_btn.click()
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(2000)

    # MFA setup (if redirected)
    if "mfa" in page.url:
        try:
            await page.wait_for_selector("input[placeholder*='code']", timeout=30000)
        except:
            print("  [WARN] MFA code input not found, continuing anyway")
            pass
        await page.fill('input[placeholder*="code"]', "123456")  # Fake code
        await page.wait_for_timeout(1000)

        # Verify
        verify_btn = await page.query_selector("button:has-text('Verify')")
        if verify_btn:
            await verify_btn.click()
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(2000)

    # Save frame
    await page.screenshot(path=FRAMES_DIR / "auth_mfa_final.png", full_page=True)
    print("Auth and MFA recorded")
    return True

async def record_admin_dashboard(page, context):
    """Record admin dashboard (using demo admin)."""
    print("Recording admin dashboard...")

    # Login as admin first (admin user from seed)
    await page.goto(f"{BASE_URL}/login")
    await page.wait_for_load_state("networkidle")

    # Admin credentials from seed
    await page.fill('input[type="email"]', ADMIN_USER["email"])
    await page.fill('input[type="password"]', ADMIN_USER["password"])

    submit_btn = await page.query_selector("button[type='submit']")
    if submit_btn:
        await submit_btn.click()
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(2000)

    # Go to admin dashboard
    await page.goto(f"{BASE_URL}/admin")
    await page.wait_for_load_state("networkidle")
    try:
        await page.wait_for_selector("h1", timeout=30000)
    except:
        print("  [WARN] h1 selector not found, continuing anyway")
        pass

    # Scroll dashboard
    await page.evaluate("window.scrollTo(0, 1000)")
    await page.wait_for_timeout(1000)
    await page.evaluate("window.scrollTo(0, 0)")
    await page.wait_for_timeout(1000)

    # Navigate to products
    admin_products = await page.query_selector("a[href='/admin/products']")
    if admin_products:
        await admin_products.click()
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(2000)

        await page.evaluate("window.scrollTo(0, 800)")
        await page.wait_for_timeout(1000)

    # Save frame
    await page.screenshot(path=FRAMES_DIR / "admin_final.png", full_page=True)
    print("Admin dashboard recorded")
    return True

async def record_brand_outro(page, context):
    """Record brand outro screen."""
    print("Recording brand outro...")

    await page.goto(BASE_URL)
    await page.wait_for_load_state("networkidle")

    # Fade out effect
    await page.evaluate("""
        document.body.style.transition = 'opacity 2s';
        document.body.style.opacity = '0';
    """)
    await page.wait_for_timeout(2000)

    # Save frame
    await page.screenshot(path=FRAMES_DIR / "outro_final.png", full_page=True)
    print("Outro recorded")
    return True

async def main():
    """Main recording function."""
    print("Starting AutoMarts website recording...")
    print(f"Using BASE_URL: {BASE_URL}")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Frames directory: {FRAMES_DIR}")
    print(f"Viewport: {VIEWPORT['width']}x{VIEWPORT['height']}")

    async with async_playwright() as p:
        # Launch browser with 4K viewport and video recording
        browser = await p.chromium.launch(
            headless=True,
            args=[
                f"--window-size={VIEWPORT['width']},{VIEWPORT['height']}",
                "--disable-gpu",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--force-device-scale-factor=1"
            ]
        )

        # Create context with video recording enabled
        context = await browser.new_context(
            viewport=VIEWPORT,
            device_scale_factor=1,
            record_video_dir=str(OUTPUT_DIR),
            record_video_size=VIEWPORT
        )

        page = await context.new_page()

        try:
            # Record all scenes
            await record_homepage(page, context)
            await record_products(page, context)
            await record_categories(page, context)
            await record_cart_checkout(page, context)
            await record_auth_mfa(page, context)
            await record_admin_dashboard(page, context)
            await record_brand_outro(page, context)

            print("\nAll recordings completed!")
            print(f"Screenshots saved to: {FRAMES_DIR}")

        except Exception as e:
            print(f"Error during recording: {e}")
            import traceback
            traceback.print_exc()
        finally:
            # Close context to finalize video files
            await context.close()
            await browser.close()

        # Wait a moment for files to be written
        await asyncio.sleep(2)

        # Find and rename video files
        print("\n--- Verifying video recordings ---")
        video_files = list(OUTPUT_DIR.glob("*.webm"))
        print(f"Found {len(video_files)} video files")

        scene_names = [
            "homepage_raw.webm",
            "products_raw.webm",
            "categories_raw.webm",
            "cart_checkout_raw.webm",
            "auth_mfa_raw.webm",
            "admin_raw.webm",
            "outro_raw.webm"
        ]

        # Sort by creation time to match scene order
        video_files.sort(key=lambda f: f.stat().st_ctime)

        all_ok = True
        for i, (video_file, target_name) in enumerate(zip(video_files, scene_names)):
            target_path = OUTPUT_DIR / target_name
            if video_file != target_path:
                video_file.rename(target_path)
                print(f"Renamed: {video_file.name} -> {target_name}")
            else:
                print(f"Already named: {target_name}")
            # Verify
            ok = await verify_recording(target_path)
            if not ok:
                all_ok = False

        # Also verify frames
        print("\n--- Verifying frame screenshots ---")
        frame_files = list(FRAMES_DIR.glob("*.png"))
        for frame in frame_files:
            size = frame.stat().st_size
            print(f"  [OK] {frame.name} ({size:,} bytes)")

        if all_ok:
            print("\n[SUCCESS] All recordings verified successfully!")
            return 0
        else:
            print("\n[FAILED] Some recordings failed verification!")
            return 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))