@echo off
REM AUC Cup 2 - Step 8: tournament rename + bracket schedule
REM   1. Commits the seed config + frontend change.
REM   2. Pushes to GitHub (triggers Render rebuild of the API + spectator UI).
REM   3. Runs the cloud-DB updater that renames the tournament and inserts
REM      the 9 bracket matches against Atlas.

cd /d "%~dp0"

echo === Committing tournament rename + bracket UI patch...
git add server/src/seed/config.js client/src/pages/PublicHub.jsx server/src/admin/updateBracket.js deploy-step8-bracket.bat
git commit -m "feat: rename to 'AUC Cup 2 (NTG x Aorus Cafe League)' + bracket schedule + TBD render" || echo (nothing new to commit)

echo === Pushing to GitHub (Render auto-deploys)...
git push origin main || (echo Push failed && pause && exit /b 1)

echo === Updating cloud Atlas - tournament name + 9 bracket matches...
cd server
set MONGO_URI=mongodb+srv://management_db_user:XSmPMUBNGwwnEaEA6fb3DRwk@cluster0.yxxm6lz.mongodb.net/ntg-platform?retryWrites=true^&w=majority^&appName=Cluster0
call node src/admin/updateBracket.js || (
  echo Bracket update failed. See error above.
  cd ..
  pause
  exit /b 1
)
cd ..

echo.
echo ============================================================
echo  Tournament renamed + bracket pushed.
echo.
echo  Verify in ~2 min once Render redeploys:
echo    https://auction.ntgesports.com/hub/6a1eab9cce448a670322ffdb
echo.
echo  You should see:
echo    Header  : "AUC Cup 2 (NTG x Aorus Cafe League)"
echo    Schedule: 9 matches across Round 1 / Round 2 / Semi-final / Final
echo ============================================================
pause
