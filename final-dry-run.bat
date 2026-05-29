@echo off
REM NTG Auction Cup - Final dry-run.
REM Runs the 10-captain rehearsal harness end-to-end against an in-memory
REM MongoDB so the cloud Atlas seed is untouched. Asserts on every invariant:
REM   - server-owned timer expiry
REM   - dynamic reserve (no captain over-spending)
REM   - atomic bid winner selection under concurrent bids
REM   - roster size, budget exhaustion, snapshot consistency

cd /d "%~dp0server"

echo === Running 10-captain auction rehearsal (in-memory Mongo, no cloud impact)...
echo.

call npm run rehearse || (
  echo.
  echo Rehearsal FAILED. See errors above.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  Rehearsal complete. All invariants held across the run.
echo  Cloud Atlas data is untouched.
echo ============================================================
pause
