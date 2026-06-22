@echo off
REM AUC Cup 2 - Step 12: include EVERY game in the MVP score
REM
REM Removed the "drop worst 25%%" trim. Every map a player played now
REM counts toward their raw average. Two mechanisms still keep one bad
REM game from sinking a tournament-long body of work:
REM
REM   1. Bayesian shrinkage toward the global mean, prior bumped to k=4
REM      (was k=3). A single off-day gets diluted by the prior; a multi-
REM      game average barely budges.
REM   2. Involvement multiplier sqrt(games/3), capped at 1.4. More games
REM      stacks on top of the shrunk average so volume always helps.
REM
REM Pinned by tests:
REM   - More games same quality -> strictly higher score.
REM   - 1-game stellar cannot beat 4-game body of work.
REM   - 5-game run with one off-day still beats a 4-game perfect run.
REM
REM Code-only deploy. The formula recomputes live on every API call -
REM no DB migration needed; existing stat lines feed straight in.

cd /d "%~dp0"

echo === Committing no-trim MVP formula...
git add server/src/analytics/analytics.js server/src/analytics/analytics.test.js deploy-step12-mvp-no-trim.bat
git commit -m "fix(mvp): include every game (no trim); bump shrinkage prior k=4" || echo (nothing new to commit)

echo === Pushing to GitHub (Render auto-deploys)...
git push origin main || (echo Push failed && pause && exit /b 1)

echo.
echo ============================================================
echo  No-trim MVP formula deployed.
echo.
echo  In ~2 min, hard-refresh the spectator hub (Ctrl+Shift+R):
echo    https://auction.ntgesports.com/hub/6a1eab9cce448a670322ffdb
echo.
echo  Expect: every game a player has played now counts toward their
echo  MVP score. Finalists with 4+ games dominate; 1-game players sink.
echo ============================================================
pause
