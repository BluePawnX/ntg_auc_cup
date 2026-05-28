@echo off
REM NTG Auction Cup — Step 1 of 3: initialize git + first commit
REM Run this from inside the ntg-platform folder, just double-click it.

cd /d "%~dp0"

echo === Cleaning any partial git folder...
if exist .git rmdir /s /q .git

echo === Initializing fresh git repo...
git init -b main || (echo FAILED: is git installed? && pause && exit /b 1)

git config user.email "management@ntgesports.com"
git config user.name "NTG"

echo === Staging files...
git add .

echo === Verifying no .env files are staged...
git ls-files --cached | findstr /R "\.env$" >nul && (
  echo ERROR: A .env file got staged. Check .gitignore. Aborting.
  pause
  exit /b 1
)

echo === Verifying DEPLOY_CREDS.md is NOT staged...
git ls-files --cached | findstr "DEPLOY_CREDS" >nul && (
  echo ERROR: DEPLOY_CREDS.md got staged. Check .gitignore. Aborting.
  pause
  exit /b 1
)

echo === Committing...
git commit -m "Initial commit: NTG Auction Cup platform"

echo.
echo ============================================================
echo  Done. Local git repo is ready.
echo  Now create an EMPTY repo at https://github.com/new
echo  (any name, e.g. ntg-auction-cup, do NOT add README/license)
echo  Then run deploy-step2-push.bat
echo ============================================================
pause
