@echo off
REM AUC Cup 2 - Step 10: improved MVP formula + 4 stat-leaderboard tables
REM   - New per-game formula 'valorant_mvp' = KDA + 0.5*FB + 0.3*plants
REM   - Trimmed-best aggregation (drops worst 25%% of games)
REM   - Volume boost (more games -> strictly higher score)
REM   - Adds topKills, topDeaths, topFirstBloods, topPlants to analytics
REM   - PublicHub renders the 4 new tables
REM
REM Pushes code to GitHub (Render auto-redeploys), then flips the cloud
REM GameTemplate to use the new formula.

cd /d "%~dp0"

echo === Committing MVP formula + stat-leaderboard changes...
git add server/src/analytics/analytics.js server/src/analytics/analytics.test.js server/src/seed/config.js server/src/admin/updateMvpFormula.js client/src/pages/PublicHub.jsx deploy-step10-mvp.bat
git commit -m "feat: composite MVP formula (KDA+FB+plants, trimmed+volume-boosted) + 4 stat leaderboards" || echo (nothing new to commit)

echo === Pushing to GitHub (Render auto-deploys)...
git push origin main || (echo Push failed && pause && exit /b 1)

echo === Flipping cloud GameTemplate to the new formula...
cd server
set MONGO_URI=mongodb+srv://management_db_user:XSmPMUBNGwwnEaEA6fb3DRwk@cluster0.yxxm6lz.mongodb.net/ntg-platform?retryWrites=true^&w=majority^&appName=Cluster0
call node src/admin/updateMvpFormula.js || (
  echo Formula update failed. See error above.
  cd ..
  pause
  exit /b 1
)
cd ..

echo.
echo ============================================================
echo  MVP race + stat leaderboards deployed.
echo.
echo  Verify in ~2 min (after Render finishes redeploying):
echo    https://auction.ntgesports.com/hub/6a1eab9cce448a670322ffdb
echo.
echo  You should see:
echo    MVP race           : composite score, rewards volume
echo    Most kills         : tournament-wide kill totals
echo    Most deaths        : tournament-wide death totals
echo    Most first bloods  : tournament-wide FB totals
echo    Most plants        : tournament-wide plant totals
echo.
echo  Hard refresh (Ctrl+Shift+R) once to bust the cached bundle.
echo ============================================================
pause
