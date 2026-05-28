@echo off
REM ===========================================================================
REM  Runs the NTG backend with an in-memory database (no MongoDB install needed).
REM  First run downloads a small database engine - can take a few minutes.
REM  Leave this window OPEN while you use the app. Run start-client.bat next.
REM ===========================================================================
cd /d "%~dp0"
echo === NTG backend (in-memory database) ===
echo Installing dependencies...
call npm install --no-audit --no-fund || goto :err
echo.
echo Booting in-memory database, seeding, and starting the server...
echo (First run downloads the database engine - please be patient.)
echo.
node src\dev\start-dev.js
goto :eof

:err
echo.
echo *** Setup failed - is Node.js installed and on PATH? ***
pause
