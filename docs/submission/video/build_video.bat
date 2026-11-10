@echo off
setlocal enabledelayedexpansion

rem AutoMarts 4K Video Builder
set FFMPEG=C:\Users\ALI HAIDER\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe
set FFPROBE=C:\Users\ALI HAIDER\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffprobe.exe
set OUTDIR=C:\Users\ALI HAIDER\OneDrive\Desktop\parts\.claude\worktrees\elated-mestorf-77dc0f\docs\submission\video
set ASSETS=%OUTDIR%\assets
set WIDTH=3840
set HEIGHT=2160
set FPS=30

echo ============================================================
echo AutoMarts 4K Video Builder
echo ============================================================

if not exist "%ASSETS%" mkdir "%ASSETS%"
if not exist "%ASSETS%\frames" mkdir "%ASSETS%\frames"

echo.
echo Step 1: Generating scene frames...

rem Create intro frame
"%FFMPEG%" -y -f lavfi -i color=c=#1c1917:s=%WIDTH%x%HEIGHT%d=1 -vf "drawtext=text='AutoMarts':fontsize=120:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-60,drawtext=text='Auto Parts E-Commerce Platform':fontsize=60:fontcolor=cccccc:x=(w-text_w)/2:y=(h-text_h)/2+60" -frames:v 1 "%ASSETS%\frames\intro.png"

rem Create hero frame
"%FFMPEG%" -y -f lavfi -i color=c=#1c1917:s=%WIDTH%x%HEIGHT%d=1 -vf "drawtext=text='Modern Auto Parts Store':fontsize=100:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-60,drawtext=text='Premium components for Toyota, Honda, Suzuki':fontsize=50:fontcolor=aaaaaa:x=(w-text_w)/2:y=(h-text_h)/2+50" -frames:v 1 "%ASSETS%\frames\hero.png"

rem Create products frame
"%FFMPEG%" -y -f lavfi -i color=c=#1c1917:s=%WIDTH%x%HEIGHT%d=1 -vf "drawbox=x=200:y=200:w=800:h=500:color=#2a2a2a:t=fill,drawbox=x=1100:y=200:w=800:h=500:color=#2a2a2a:t=fill,drawbox=x=2000:y=200:w=800:h=500:color=#2a2a2a:t=fill,drawbox=x=200:y=750:w=800:h=500:color=#2a2a2a:t=fill,drawbox=x=1100:y=750:w=800:h=500:color=#2a2a2a:t=fill,drawbox=x=2000:y=750:w=800:h=500:color=#2a2a2a:t=fill,drawtext=text='22+ Genuine Parts':fontsize=100:fontcolor=white:x=(w-text_w)/2:y=1600,drawtext=text='Engine, Brakes, Suspension, Electrical':fontsize=50:fontcolor=aaaaaa:x=(w-text_w)/2:y=1750" -frames:v 1 "%ASSETS%\frames\products.png"

rem Create cart frame
"%FFMPEG%" -y -f lavfi -i color=c=#1c1917:s=%WIDTH%x%HEIGHT%d=1 -vf "drawtext=text='Seamless Checkout':fontsize=100:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-60,drawtext=text='Secure cart with coupon support':fontsize=50:fontcolor=aaaaaa:x=(w-text_w)/2:y=(h-text_h)/2+50" -frames:v 1 "%ASSETS%\frames\cart.png"

rem Create auth frame
"%FFMPEG%" -y -f lavfi -i color=c=#1c1917:s=%WIDTH%x%HEIGHT%d=1 -vf "drawtext=text='MFA Authentication':fontsize=100:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-60,drawtext=text='TOTP-based security with Google OAuth':fontsize=50:fontcolor=aaaaaa:x=(w-text_w)/2:y=(h-text_h)/2+50" -frames:v 1 "%ASSETS%\frames\auth.png"

rem Create admin frame
"%FFMPEG%" -y -f lavfi -i color=c=#1c1917:s=%WIDTH%x%HEIGHT%d=1 -vf "drawbox=x=100:y=100:w=700:h=1960:color=#c5303040:t=fill,drawbox=x=900:y=100:w=2840:h=300:color=#2a2a2a:t=fill,drawbox=x=900:y=500:w=2840:h=300:color=#2a2a2a:t=fill,drawtext=text='Admin Dashboard':fontsize=100:fontcolor=white:x=(w-text_w)/2:y=1700,drawtext=text='Complete inventory & order management':fontsize=50:fontcolor=aaaaaa:x=(w-text_w)/2:y=1850" -frames:v 1 "%ASSETS%\frames\admin.png"

rem Create security frame
"%FFMPEG%" -y -f lavfi -i color=c=#1c1917:s=%WIDTH%x%HEIGHT%d=1 -vf "drawtext=text='Enterprise Security':fontsize=100:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-60,drawtext=text='Zod validation, Rate limiting, Audit logs':fontsize=50:fontcolor=aaaaaa:x=(w-text_w)/2:y=(h-text_h)/2+50" -frames:v 1 "%ASSETS%\frames\security.png"

rem Create outro frame
"%FFMPEG%" -y -f lavfi -i color=c=#1c1917:s=%WIDTH%x%HEIGHT%d=1 -vf "drawtext=text='Thank You':fontsize=140:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-60,drawtext=text='Built with Express + React + SQLite':fontsize=50:fontcolor=aaaaaa:x=(w-text_w)/2:y=(h-text_h)/2+60" -frames:v 1 "%ASSETS%\frames\outro.png"

echo Created 8 scene frames

echo.
echo Step 2: Creating video clips...

rem Intro clip (5 seconds)
"%FFMPEG%" -y -loop 1 -i "%ASSETS%\frames\intro.png" -t 5 -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium -vf "zoompan=z='min(1.1,1+0.001*t)':x=%WIDTH%/2:y=%HEIGHT%/2:d=150:s=%WIDTH%x%HEIGHT%fps=30" -r 30 "%ASSETS%\clip_intro.mp4"

rem Hero clip (6 seconds)
"%FFMPEG%" -y -loop 1 -i "%ASSETS%\frames\hero.png" -t 6 -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium -vf "zoompan=z='min(1.1,1+0.001*t)':x=%WIDTH%/2:y=%HEIGHT%/2:d=180:s=%WIDTH%x%HEIGHT%fps=30" -r 30 "%ASSETS%\clip_hero.mp4"

rem Products clip (6 seconds)
"%FFMPEG%" -y -loop 1 -i "%ASSETS%\frames\products.png" -t 6 -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium -vf "zoompan=z='min(1.1,1+0.001*t)':x=%WIDTH%/2:y=%HEIGHT%/2:d=180:s=%WIDTH%x%HEIGHT%fps=30" -r 30 "%ASSETS%\clip_products.mp4"

rem Cart clip (6 seconds)
"%FFMPEG%" -y -loop 1 -i "%ASSETS%\frames\cart.png" -t 6 -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium -vf "zoompan=z='min(1.1,1+0.001*t)':x=%WIDTH%/2:y=%HEIGHT%/2:d=180:s=%WIDTH%x%HEIGHT%fps=30" -r 30 "%ASSETS%\clip_cart.mp4"

rem Auth clip (6 seconds)
"%FFMPEG%" -y -loop 1 -i "%ASSETS%\frames\auth.png" -t 6 -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium -vf "zoompan=z='min(1.1,1+0.001*t)':x=%WIDTH%/2:y=%HEIGHT%/2:d=180:s=%WIDTH%x%HEIGHT%fps=30" -r 30 "%ASSETS%\clip_auth.mp4"

rem Admin clip (6 seconds)
"%FFMPEG%" -y -loop 1 -i "%ASSETS%\frames\admin.png" -t 6 -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium -vf "zoompan=z='min(1.1,1+0.001*t)':x=%WIDTH%/2:y=%HEIGHT%/2:d=180:s=%WIDTH%x%HEIGHT%fps=30" -r 30 "%ASSETS%\clip_admin.mp4"

rem Security clip (6 seconds)
"%FFMPEG%" -y -loop 1 -i "%ASSETS%\frames\security.png" -t 6 -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium -vf "zoompan=z='min(1.1,1+0.001*t)':x=%WIDTH%/2:y=%HEIGHT%/2:d=180:s=%WIDTH%x%HEIGHT%fps=30" -r 30 "%ASSETS%\clip_security.mp4"

rem Outro clip (5 seconds)
"%FFMPEG%" -y -loop 1 -i "%ASSETS%\frames\outro.png" -t 5 -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium -vf "zoompan=z='min(1.1,1+0.001*t)':x=%WIDTH%/2:y=%HEIGHT%/2:d=150:s=%WIDTH%x%HEIGHT%fps=30" -r 30 "%ASSETS%\clip_outro.mp4"

echo Created 8 video clips

echo.
echo Step 3: Concatenating clips...

rem Create concat file
(
echo file '%ASSETS%\clip_intro.mp4'
echo file '%ASSETS%\clip_hero.mp4'
echo file '%ASSETS%\clip_products.mp4'
echo file '%ASSETS%\clip_cart.mp4'
echo file '%ASSETS%\clip_auth.mp4'
echo file '%ASSETS%\clip_admin.mp4'
echo file '%ASSETS%\clip_security.mp4'
echo file '%ASSETS%\clip_outro.mp4'
) > "%ASSETS%\concat.txt"

"%FFMPEG%" -y -f concat -safe 0 -i "%ASSETS%\concat.txt" -c copy "%ASSETS%\intermediate.mp4"

echo Concatenated clips

echo.
echo Step 4: Final encoding...

"%FFMPEG%" -y -i "%ASSETS%\intermediate.mp4" -c:v libx264 -crf 18 -preset medium -profile:v high -level 5.1 -pix_fmt yuv420p -movflags +faststart "%OUTDIR%\AutoMarts_Project_Showcase_4K.mp4"

echo.
echo ============================================================
echo Video generation complete!
echo ============================================================

rem Check output
if exist "%OUTDIR%\AutoMarts_Project_Showcase_4K.mp4" (
    for %%F in ("%OUTDIR%\AutoMarts_Project_Showcase_4K.mp4") do (
        set size=%%~zF
        echo Output: %OUTDIR%\AutoMarts_Project_Showcase_4K.mp4
        echo Size: !size! bytes
    )
    "%FFPROBE%" -v error -show_entries format=duration,size -of default "%OUTDIR%\AutoMarts_Project_Showcase_4K.mp4"
) else (
    echo Error: Video not created
    exit /b 1
)

endlocal
