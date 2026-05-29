@echo off
REM NTG Auction Cup — Step 2b: clear cached GitHub credentials, then push.
REM Use this when git push fails because it's using the wrong GitHub account.

cd /d "%~dp0"

echo === Clearing any cached GitHub credentials in Windows Credential Manager...
cmdkey /delete:git:https://github.com 2>nul
cmdkey /delete:LegacyGeneric:target=git:https://github.com 2>nul
cmdkey /delete:git:https://NTG-Esports@github.com 2>nul
cmdkey /delete:git:https://BluePawnX@github.com 2>nul

echo === Listing remaining github cred entries (should be empty)...
cmdkey /list | findstr github.com

echo.
echo === Now trying the push again. When the GitHub sign-in window opens,
echo === sign in as the account that owns NTG-Esports (or has push access).
echo.

git push -u origin main || (
  echo.
  echo Still failing. Two options:
  echo.
  echo   Option A ^(easiest^): use a Personal Access Token.
  echo     1. Go to https://github.com/settings/tokens/new
  echo     2. Sign in as the NTG-Esports owner.
  echo     3. Create a "classic" token with the "repo" scope, copy it.
  echo     4. Run: git push -u origin main
  echo        and paste the token as the password when prompted.
  echo.
  echo   Option B: add BluePawnX as a collaborator on the repo
  echo     ^(NTG-Esports settings -^> Collaborators -^> Add BluePawnX^)
  echo     then re-run this script.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  Push complete. Verify at:
echo    https://github.com/NTG-Esports/ntg_auc_cup
echo ============================================================
pause
