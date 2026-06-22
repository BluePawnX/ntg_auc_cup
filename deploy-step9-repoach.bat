@echo off
REM AUC Cup 2 - Step 9: enable repeat poaches across the tournament
REM   - PoachEvent.match made optional (finals-level poaches don't need a match link)
REM   - Poach route hardened: pulls the player off every stale roster so a
REM     repeat poach (A->B then later A->C) works cleanly
REM   - MatchdayTerminal auto-prefills "From" with the player's current team
REM     and shows their current team in the dropdown
REM
REM This is a code-only deploy. No DB script needed - the change is in how
REM new poach calls are processed, existing data is untouched.

cd /d "%~dp0"

echo === Committing repeat-poach changes...
git add server/src/models/matchModels.js server/src/routes/matchday.js client/src/terminals/MatchdayTerminal.jsx deploy-step9-repoach.bat
git commit -m "feat: allow same player to be poached multiple times across tournament" || echo (nothing new to commit)

echo === Pushing to GitHub (Render auto-deploys)...
git push origin main || (echo Push failed && pause && exit /b 1)

echo.
echo ============================================================
echo  Repeat-poach support deployed.
echo.
echo  In ~2 min, refresh the Match Day terminal:
echo    https://auction.ntgesports.com/matchday/6a1eab9cce448a670322ffdb
echo.
echo  Workflow for the finals:
echo    1. Open "Record a poach"
echo    2. Pick the player - "From" now auto-fills with their current team
echo    3. Pick the destination team in "To"
echo    4. Hit Poach
echo  You can repeat this for the same player as many times as needed.
echo ============================================================
pause
