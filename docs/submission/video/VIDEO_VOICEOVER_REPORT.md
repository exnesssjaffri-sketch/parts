# AutoMarts 4K Voiceover Showcase - Production Report

**Generated**: 2026-11-09  
**Project**: AutoMarts Auto Parts E-Commerce Platform  
**Output**: `AutoMarts_OpenMontage_Showcase_4K_30fps_Voiceover.mp4`

---

## Output Video Specs

| Property | Value |
|---|---|
| Resolution | 3840 × 2160 (4K UHD) |
| Frame Rate | 30 fps (constant) |
| Video Codec | H.264 / AVC |
| Profile | High |
| Level | 5.1 |
| Pixel Format | yuv420p |
| Audio Codec | AAC LC |
| Audio Sample Rate | 48 kHz |
| Audio Bitrate | 128 kbps |
| Duration | 75.76 s |
| Total Frames | 2271 |
| File Size | 3.0 MB |
| Bitrate | ~323 kbps |

---

## Production Pipeline

### Step 1: Source Clips
Ten existing 3840×2160@30fps clips from OpenMontage production:

| Scene | Clip | Duration (target) |
|-------|------|-------------------|
| 1 | intro | 6 s |
| 2 | hero | 8 s |
| 3 | products | 8 s |
| 4 | categories | 8 s |
| 5 | cart | 8 s |
| 6 | auth | 8 s |
| 7 | admin | 8 s |
| 8 | security | 8 s |
| 9 | stack | 8 s |
| 10 | outro | 6 s |

### Step 2: Voiceover Generation
- **TTS Engine**: LLMAPI gateway (`http://127.0.0.1:31415/v1/audio/speech`)
- **Model**: `auto` (LLMAPI router selects optimal provider)
- **Voice**: `onyx` (professional male, authoritative tone)
- **Format**: WAV (native 44.1 kHz → resampled to 48 kHz in mix step)
- **Speed**: 1.0× source; adjusted per-clip via `atempo` filter

Generated durations vs targets:

| Scene | Audio (s) | Target (s) | Speed Adjust |
|-------|-----------|------------|--------------|
| intro | 4.14 | 6.0 | 0.69× (slow down) |
| hero | 8.84 | 8.0 | 1.10× (slight speed up) |
| products | 8.20 | 8.0 | 1.03× |
| categories | 8.80 | 8.0 | 1.10× |
| cart | 9.74 | 8.0 | 1.22× |
| auth | 9.48 | 8.0 | 1.18× |
| admin | 9.91 | 8.0 | 1.24× |
| security | 10.87 | 8.0 | 1.36× |
| stack | 9.80 | 8.0 | 1.23× |
| outro | 5.43 | 6.0 | 0.90× |

All speed adjustments within valid `atempo` range (0.5×–2.0×).

### Step 3: Per-Scene Audio-Video Mix
Each clip+audio pair merged with:
- `-filter_complex "[1:a]atempo=X[aout]"` — time-stretch audio to match video length
- `-c:v copy` — no re-encode of video (preserves original quality)
- `-c:a aac -b:a 128k -ar 48000` — encode to AAC, resample to 48 kHz
- `-shortest` — output ends when shortest stream (video) ends

### Step 4: Concatenation & Final Encode
- Concatenated 10 mixed clips using FFmpeg concat demuxer (lossless copy)
- Final encode: H.264 CRF 18, preset slow, +faststart for streaming
- Result: 2271 frames over 75.76 seconds

### Step 5: Verification
- **ffprobe**: Confirmed 3840×2160, 30fps, H.264 High/Level 5.1, AAC audio
- **Full decode test**: All 2271 frames decoded without errors, no dropped frames, no corrupt packets
- **File size**: 3.0 MB (~40 KB/s average bitrate including audio)

---

## Scripts Produced

| Script | Purpose |
|--------|---------|
| `generate_voiceover.py` | Calls LLMAPI TTS endpoint for all 10 scenes |
| `mix_audio_video.py` | Combines each voiceover with its video clip, applying tempo adjustment |
| `final_render.py` | Concatenates all mixed clips and produces final 4K MP4 |
| `VOICEOVER_SCRIPT.md` | Complete narration text for all 10 scenes |

---

## GitHub Publication

- **Branch**: `openmontage-voiceover-showcase`
- **Commit**: `e1d6aed`
- **PR**: https://github.com/exnesssjaffri-sketch/parts/pull/new/openmontage-voiceover-showcase
- **Deliverables committed**:
  - `docs/submission/video/AutoMarts_OpenMontage_Showcase_4K_30fps_Voiceover.mp4`
  - `docs/submission/video/VOICEOVER_SCRIPT.md`

---

## Technical Notes

1. **No background music** was added — the prompt specified narrator-only unless requested
2. **Audio speed adjustments** use FFmpeg's `atempo` filter which preserves pitch while changing tempo
3. **Security clip** required the largest speed-up (1.36×) due to longer narration than clip duration
4. **Intro/outro** clips are shorter (6s), so their narration is slowed down rather than sped up
5. All intermediate files remain in `assets/` for reproducibility

---

**Report complete**: 2026-11-09