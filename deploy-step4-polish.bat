@echo off
REM NTG Auction Cup — Step 4: install new deps, build polished client, push to GitHub.
REM Render auto-deploys whenever main is updated.

cd /d "%~dp0"

echo === Installing client dependencies (framer-motion + existing)...
cd client
call npm install || (echo npm install failed && cd .. && pause && exit /b 1)

echo === Building polished client (Vite)...
call npm run build || (echo Vite build failed - see error above && cd .. && pause && exit /b 1)
cd ..

echo === Committing + pushing to GitHub mirror (BluePawnX/ntg_auc_cup)...
git add .
git commit -m "UI polish: interactive grid backdrop, spotlight tables, animated auth pages" || echo (nothing to commit, that's OK)
git push origin main || (
  echo Push failed. Check the error above.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  Push complete. Render will detect the push and start a new
echo  build automatically (3-8 minutes).
echo  Watch progress at:
echo    https://dashboard.render.com/web/srv-d8cbvn4ua31s73at67k0/events
echo.
echo  Once it shows "live", visit:
echo    https://ntg-auc-cup.onrender.com/
echo ============================================================
pause
