@echo off
REM NTG Auction Cup — Step 2c: push existing commits to BluePawnX mirror
REM (kept separate so the original NTG-Esports remote is untouched)

cd /d "%~dp0"

set NEW_REMOTE=https://github.com/BluePawnX/ntg_auc_cup.git

echo === Removing existing "origin" (was pointing to NTG-Esports)...
git remote remove origin 2>nul

echo === Adding new origin: %NEW_REMOTE%
git remote add origin %NEW_REMOTE%

echo === Adding NTG-Esports as a secondary remote (keeps that copy reachable)...
git remote remove ntg 2>nul
git remote add ntg https://github.com/NTG-Esports/ntg_auc_cup.git

echo === Pushing to BluePawnX...
git push -u origin main || (
  echo Push failed. Make sure your Git credential is still BluePawnX.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  Mirror push complete. Repo:
echo    https://github.com/BluePawnX/ntg_auc_cup
echo  Render will see this automatically.
echo  ^(Tip: to keep NTG-Esports in sync later: ^"git push ntg main^"^)
echo ============================================================
pause
