@echo off
REM NTG Auction Cup - Step 6: push the final roster + re-seed the cloud DB.
REM
REM Wipes the existing tournament data in Atlas and rebuilds it with the new
REM 10 captains / 10 Core 2s / 32-player pool from server/src/seed/players.csv.
REM
REM New wallet math (target = 60% floor coverage):
REM   D+D teams (0 ping, INDIAN OIL):                wallet 118
REM   D+A teams (BOMMBACLAT, kulshekar Kings):       wallet 107
REM   A+A team  (Chutki):                            wallet 96
REM   D+I teams (Sher-E-Urdu, Zenith, Bajil Squad):  wallet 92
REM   A+I teams (KADRI KNIGHTS, Team Lodus):         wallet 81
REM   Sum: 984 spendable credits. Floor pool: 591 (= 60.1%%).

cd /d "%~dp0"

echo === Committing CSV + config changes...
git add server/src/seed/players.csv server/src/seed/config.js deploy-step6-reseed.bat
git commit -m "seed: final roster + balanced economy (60%% floor target)" || echo (nothing new to commit)

echo === Pushing to GitHub (triggers Render auto-deploy)...
git push origin main || (echo Push failed && pause && exit /b 1)

echo === Re-seeding cloud Atlas (wipes + rebuilds the tournament)...
cd server
set MONGO_URI=mongodb+srv://management_db_user:XSmPMUBNGwwnEaEA6fb3DRwk@cluster0.yxxm6lz.mongodb.net/ntg-platform?retryWrites=true^&w=majority^&appName=Cluster0

call node src/seed/seed.js src/seed/players.csv || (
  echo Seed failed.  See error above.
  cd ..
  pause
  exit /b 1
)
cd ..

echo.
echo ============================================================
echo  Cloud DB re-seeded with the final roster.
echo  Spectator hub will reflect the new teams + pool in ~30 sec.
echo  Render is also redeploying the server (no code change so
echo  this is a no-op, but you'll see a green build appear).
echo.
echo  Public hub:
echo    https://ntg-auc-cup-sg.onrender.com/
echo ============================================================
pause
