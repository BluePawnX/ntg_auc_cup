@echo off
REM NTG Auction Cup — Step 2 of 3: push to GitHub
REM Run this from inside the ntg-platform folder, just double-click it.

cd /d "%~dp0"

set REMOTE_URL=https://github.com/NTG-Esports/ntg_auc_cup.git

echo === Removing any old "origin" remote (safe if it doesn't exist)...
git remote remove origin 2>nul

echo === Adding origin: %REMOTE_URL%
git remote add origin %REMOTE_URL%

echo === Pushing to GitHub...
echo (If prompted, sign in with your GitHub account in the browser window that pops up.)
git push -u origin main || (
  echo.
  echo Push failed. Common fixes:
  echo   1. Make sure you created the repo at %REMOTE_URL%
  echo   2. Make sure you are signed in to GitHub
  echo   3. If you've been using a different GitHub account before, run:
  echo        git config --global --unset credential.helper
  echo      then try again so it re-prompts for sign-in.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  Push complete. Verify at:
echo    https://github.com/NTG-Esports/ntg_auc_cup
echo  Then move on to Render deploy.
echo ============================================================
pause
