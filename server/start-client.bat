@echo off
REM ===========================================================================
REM  Starts the NTG web app (the three terminals). Leave the window open.
REM  Run verify.bat first (it starts the backend); then run this.
REM ===========================================================================
cd /d "%~dp0..\client"
echo Installing client dependencies (first run only, ~30s)...
call npm install --no-audit --no-fund || goto :err
echo.
echo Starting the web app - LEAVE THIS WINDOW OPEN.
echo Open the "Network" address it prints below on any phone/laptop on the
echo same Wi-Fi (e.g. http://192.168.x.x:5173).
echo.
call npm run dev
goto :eof

:err
echo.
echo *** Client setup failed - is Node.js installed? ***
pause
