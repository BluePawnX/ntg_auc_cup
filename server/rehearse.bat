@echo off
REM ===========================================================================
REM  Full 10-captain auction rehearsal. Self-contained: boots its own in-memory
REM  database and server (port 4100), runs the simulation, prints PASS/FAIL, and
REM  shuts everything down. Safe to run while the dev app is running on 4000.
REM ===========================================================================
cd /d "%~dp0"
echo Installing dependencies (first run only)...
call npm install --no-audit --no-fund || goto :err
echo.
echo Running the 10-captain rehearsal...
echo.
call npm run rehearse
echo.
pause
goto :eof

:err
echo.
echo *** Setup failed - is Node.js installed? ***
pause
