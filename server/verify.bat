@echo off
REM ===========================================================================
REM  NTG backend verification — one double-click.
REM  Prereqs: Node.js installed, and MongoDB (mongod) RUNNING on localhost:27017.
REM  This installs deps, runs unit tests, seeds the Cup, starts the server in a
REM  separate window, then runs the headless auction smoke test.
REM ===========================================================================
cd /d "%~dp0"
echo ============================================
echo  NTG Tournament Platform - backend check
echo ============================================
echo.
echo [1/5] Installing dependencies...
call npm install || goto :err
echo.
echo [2/5] Running unit tests (expect 24 passing)...
call npm test || goto :err
echo.
echo [3/5] Seeding the tournament (needs MongoDB running)...
call npm run seed || goto :err
echo.
echo [4/5] Starting the server in a new window...
start "NTG Server" cmd /k "npm start"
echo      Waiting a few seconds for it to boot...
timeout /t 6 /nobreak >nul
echo.
echo [5/5] Running the headless auction smoke test...
call npm run smoke
echo.
echo ============================================
echo  Done. The server is still running in the
echo  "NTG Server" window - close it when finished.
echo ============================================
pause
goto :eof

:err
echo.
echo *** A step failed - read the message above. ***
echo If step 3 failed, make sure MongoDB (mongod) is running.
pause
