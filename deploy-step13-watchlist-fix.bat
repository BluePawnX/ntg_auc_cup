@echo off
REM AUC Cup 2 - Step 13: revert MVP formula + fix watchlist
REM
REM 1) MVP formula reverted to the step-11 version that fixed Rajiv:
REM      - drop worst 25%% of games (trim)
REM      - Bayesian shrinkage k=3 toward global mean
REM      - involvement multiplier sqrt(games/3), capped at 1.4
REM
REM 2) Watchlist + Washed list now EXCLUDE cores (captains + co-captains).
REM    Their price is the rank-based coreCost, not set by the auction, so
REM    judging them as bargains/overpays is meaningless. They still show
REM    up in the MVP race, the per-stat boards, and price-vs-performance.
REM
REM Code-only deploy. Formula + filter recompute live on every API call -
REM no DB migration needed.

cd /d "%~dp0"

echo === Committing reverted MVP + watchlist core-exclusion...
git add server/src/analytics/analytics.js server/src/analytics/analytics.test.js deploy-step13-watchlist-fix.bat
git commit -m "fix: revert MVP formula to trim+shrinkage+involvement; exclude cores from watchlist/washed" || echo (nothing new to commit)

echo === Pushing to GitHub (Render auto-deploys)...
git push origin main || (echo Push failed && pause && exit /b 1)

echo.
echo ============================================================
echo  Watchlist fix deployed.
echo.
echo  In ~2 min, hard-refresh the spectator hub (Ctrl+Shift+R):
echo    https://auction.ntgesports.com/hub/6a1eab9cce448a670322ffdb
echo.
echo  Expect: Watchlist + Washed list now only show auction-sold
echo  pool players. Captains and co-captains are gone from both.
echo ============================================================
pause
