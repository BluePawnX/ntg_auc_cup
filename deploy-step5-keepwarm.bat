@echo off
REM NTG Auction Cup - Step 5: enable GitHub Actions keep-warm cron.
REM Commits .github/workflows/keep-warm.yml and pushes to BluePawnX/ntg_auc_cup.
REM GitHub Actions will then ping the Render URL every 14 minutes for free,
REM forever. Render's free instance will never spin down.

cd /d "%~dp0"

echo === Staging keep-warm workflow file...
git add .github/workflows/keep-warm.yml deploy-step5-keepwarm.bat

echo === Committing...
git commit -m "ci: add GitHub Actions keep-warm cron (every 14 min)" || echo (nothing new to commit)

echo === Pushing to GitHub...
git push origin main || (
  echo Push failed - check error above.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  Keep-warm workflow pushed. GitHub Actions starts running
echo  within ~5 minutes (cron schedules can take a few min to
echo  activate on a brand-new workflow).
echo.
echo  See it running here:
echo    https://github.com/BluePawnX/ntg_auc_cup/actions
echo.
echo  Manual trigger: open the "Keep Render warm" workflow on
echo  that page and click "Run workflow" to fire it immediately.
echo ============================================================
pause
