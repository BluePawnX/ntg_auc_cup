@echo off
REM ===========================================================================
REM  Full end-to-end test. Self-contained: boots its own in-memory database and
REM  server (port 4200), runs every feature through pass/fail/validation cases,
REM  writes e2e-report.txt, then shuts down. Safe alongside the dev app on 4000.
REM ===========================================================================
cd /d "%~dp0"
echo Installing dependencies (first run only)...
call npm install --no-audit --no-fund || goto :err
echo.
echo Running the full end-to-end test suite...
echo.
call npm run e2e
echo.
pause
goto :eof

:err
echo.
echo *** Setup failed - is Node.js installed? ***
pause
