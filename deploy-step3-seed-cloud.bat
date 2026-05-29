@echo off
REM NTG Auction Cup — Step 3: seed the cloud (Atlas) database
REM
REM Reaches the cloud DB directly from your laptop using the same connection
REM string Render uses. Safe to re-run — the seed wipes the tournament with
REM the same name and rebuilds it cleanly.

cd /d "%~dp0server"

set MONGO_URI=mongodb+srv://management_db_user:XSmPMUBNGwwnEaEA6fb3DRwk@cluster0.yxxm6lz.mongodb.net/ntg-platform?retryWrites=true^&w=majority^&appName=Cluster0

echo === Seeding tournament against cloud Atlas...
echo (Using the real 50-player roster from src/seed/players.csv)

node src/seed/seed.js src/seed/players.csv || (
  echo.
  echo Seed failed. If you saw "MongooseServerSelectionError", the connection
  echo string is wrong or Atlas IP allowlist isn't 0.0.0.0/0 yet.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  Cloud DB seeded. Open the public hub:
echo    https://ntg-auc-cup.onrender.com/
echo  (First hit takes ~50s to wake the server from idle.)
echo ============================================================
pause
