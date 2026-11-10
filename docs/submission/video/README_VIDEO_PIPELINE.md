# AutoMarts 4K Voiceover Showcase - Video Pipeline

This directory contains the complete pipeline for generating the AutoMarts 4K showcase video with voiceover narration.

## Prerequisites

- Python 3.10+
- FFmpeg 5.0+ (with ffprobe)
- LLMAPI Gateway running at `http://127.0.0.1:31415/v1` (or configure via environment)
- Source video clips in `assets/source_clips/`

## Quick Start

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Edit .env with your LLMAPI API key and paths

# 3. Run the full pipeline
python generate_voiceover.py
python mix_audio_video.py
python final_render.py
```

## Environment Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `LLMAPI_BASE_URL` | LLMAPI gateway base URL | `http://127.0.0.1:31415/v1` |
| `LLMAPI_API_KEY` | **Required** - Your LLMAPI key | - |
| `TTS_MODEL` | TTS model to use | `auto` |
| `TTS_VOICE` | TTS voice (onyx, alloy, etc.) | `onyx` |
| `TTS_FORMAT` | Output audio format | `wav` |
| `TTS_SPEED` | Speech speed multiplier | `1.0` |
| `FFMPEG_PATH` | Path to ffmpeg binary | `ffmpeg` (from PATH) |
| `FFPROBE_PATH` | Path to ffprobe binary | `ffprobe` (from PATH) |
| `PROJECT_ROOT` | Project root directory | `.` |
| `SOURCE_CLIPS_DIR` | Source video clips directory | `docs/submission/video/assets/source_clips` |
| `VOICEOVER_OUTPUT_DIR` | Generated voiceover output | `docs/submission/video/assets/voiceover` |
| `MIXED_OUTPUT_DIR` | Mixed audio+video output | `docs/submission/video/assets/mixed` |
| `FINAL_OUTPUT_DIR` | Final render output | `docs/submission/video/assets/final` |
| `FINAL_OUTPUT_FILENAME` | Final video filename | `AutoMarts_OpenMontage_Showcase_4K_30fps_Voiceover.mp4` |

## Pipeline Stages

### 1. Generate Voiceover (`generate_voiceover.py`)

Generates WAV audio files for each scene using LLMAPI TTS.

**Input:** Scene text from `VOICEOVER_SCRIPT.md`  
**Output:** `assets/voiceover/voiceover_XX_scene.wav` (10 files)

```bash
python generate_voiceover.py
```

Expected output:
```
============================================================
AutoMarts Voiceover Generation
============================================================
LLMAPI: http://127.0.0.1:31415/v1
Model: auto, Voice: onyx
Output: /path/to/docs/submission/video/assets/voiceover
============================================================
Generating voiceover_01_intro.wav...
  OK: voiceover_01_intro.wav (45231 bytes)
...
Generated: 10/10 voiceover files
============================================================
  voiceover_01_intro.wav: 44.2 KB
  voiceover_02_hero.wav: 67.8 KB
  ...
```

### 2. Mix Audio with Video (`mix_audio_video.py`)

Combines each voiceover with its corresponding video clip, adjusting audio speed via `atempo` filter to match target durations.

**Input:** Source clips + generated voiceovers  
**Output:** `assets/mixed/clip30_scene_vo.mp4` (10 files)

```bash
python mix_audio_video.py
```

### 3. Final Render (`final_render.py`)

Concatenates all mixed clips and re-encodes to final specifications:

- **Video:** H.264 High Profile, Level 5.1, CRF 18, 30 fps, yuv420p
- **Audio:** AAC 128k, 48kHz
- **Container:** MP4 with +faststart for web streaming

**Input:** Mixed clips from stage 2  
**Output:** `assets/final/AutoMarts_OpenMontage_Showcase_4K_30fps_Voiceover.mp4`

```bash
python final_render.py
```

Verification includes:
- ffprobe format/stream inspection
- Full decode test (no errors)

## Expected Final Video Specs

| Property | Value |
|----------|-------|
| Resolution | 3840×2160 (4K) |
| Frame Rate | 30 fps |
| Video Codec | H.264 (libx264), High Profile, Level 5.1 |
| Audio Codec | AAC-LC, 128 kbps, 48 kHz |
| Duration | ~76 seconds |
| Color Space | yuv420p |

## Troubleshooting

### LLMAPI Connection Failed
```
ERROR: Could not connect to LLMAPI at http://127.0.0.1:31415/v1
```
- Ensure LLMAPI gateway is running
- Check `LLMAPI_BASE_URL` in `.env`
- Verify API key is correct

### ffmpeg/ffprobe Not Found
```
WARNING: ffmpeg not found at 'ffmpeg' - ensure it's in PATH
```
- Install FFmpeg and add to PATH, or
- Set `FFMPEG_PATH` and `FFPROBE_PATH` in `.env` to full binary paths

### Missing Source Clips
```
MISSING video: /path/to/clip30_intro.mp4
```
- Ensure source clips are in `assets/source_clips/`
- Clips must be named: `clip30_intro.mp4`, `clip30_hero.mp4`, etc.

### Audio Duration Mismatch
The pipeline automatically adjusts audio speed using chained `atempo` filters (supports 0.5x-2.0x per filter, chains for wider range).

## Development

### Running Tests

```bash
# Syntax check
python -m py_compile generate_voiceover.py mix_audio_video.py final_render.py

# Type checking
mypy *.py

# Linting
ruff check *.py

# Format
black *.py
```

### Project Structure

```
docs/submission/video/
├── .env.example              # Environment template
├── requirements.txt          # Python dependencies
├── pyproject.toml           # Project config
├── VOICEOVER_SCRIPT.md      # Narration script (source of truth)
├── generate_voiceover.py    # Stage 1: TTS generation
├── mix_audio_video.py       # Stage 2: Audio-video mixing
├── final_render.py          # Stage 3: Final concatenation + encode
├── README_VIDEO_PIPELINE.md # This file
└── assets/
    ├── source_clips/        # Input: clip30_*.mp4 (10 clips)
    ├── voiceover/           # Stage 1 output: voiceover_*.wav
    ├── mixed/               # Stage 2 output: clip30_*_vo.mp4
    └── final/               # Stage 3 output: final showcase video
```

## Notes

- All paths are resolved relative to `PROJECT_ROOT`
- The pipeline is fully reproducible - running from clean state produces identical output
- No hardcoded credentials or absolute paths in scripts
- Scene text matches `VOICEOVER_SCRIPT.md` exactly
- Each stage can be run independently if inputs exist