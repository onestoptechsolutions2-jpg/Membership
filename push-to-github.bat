@echo off
echo === Membership — Push to GitHub ===
echo.

cd /d "%~dp0"

echo [1/4] Initialising git...
git init
git branch -M main

echo [2/4] Staging files...
git add .

echo [3/4] Creating initial commit...
git commit -m "Initial commit: membership management system"

echo [4/4] Creating GitHub repo and pushing...
gh repo create membership --public --source=. --remote=origin --push

if %errorlevel% neq 0 (
    echo.
    echo gh CLI not found or failed. Run these manually:
    echo   git remote add origin https://github.com/YOUR_USERNAME/membership.git
    echo   git push -u origin main
)

echo.
echo Done! Press any key to close.
pause
