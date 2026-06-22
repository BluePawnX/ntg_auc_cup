@echo off
REM AUC Cup 2 - Step 11: MVP formula fix for 1-game outliers
REM
REM Adds Bayesian shrinkage toward the tournament mean (k=3) and an
REM involvement multiplier (sqrt(games/3), capped at 1.4). A player with
REM one stellar game can no longer leapfrog a finalist's body of work.
REM
REM Code-only deploy. No DB script needed - the formula is computed live
REM from existing stat lines, no stored values to migrate.

cd /d "%~dp0"

echo === Committing MVP shrinkage + involvement fix...
git add server/src/analytics/analytics.js server/src/analytics/analytics.test.js deploy-step11-mvp-fix.bat
git commit -m "fix(mvp): Bayesian shrinkage + sqrt-involvement so 1-game outliers cant beat finalists" || echo (nothing new to commit)

echo === Pushing to GitHub (Render auto-deploys)...
git push origin main || (echo Push failed && pause && exit /b 1)

echo.
echo ============================================================
echo  MVP formula fix deployed.
echo.
echo  In ~2 min, hard-refresh the spectator hub (Ctrl+Shift+R):
echo    https://auction.ntgesports.com/hub/6a1eab9cce448a670322ffdb
echo.
echo  Expect: 1-game players drop down the MVP race; finalists
echo  (3-4 games) move up. Rajiv Bangera should no longer be #2.
echo ============================================================
pause
