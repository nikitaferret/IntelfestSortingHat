@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "PY=%~dp0runtime\python\python.exe"
set "SCRIPT=%~dp0serve.py"

if not exist "%PY%" (
  echo ERROR: Portable Python not found:
  echo   %PY%
  echo Copy the whole IntelfestSortingHat folder including runtime\python
  echo.
  pause
  exit /b 1
)

if not exist "%SCRIPT%" (
  echo ERROR: serve.py not found.
  pause
  exit /b 1
)

echo Starting IntelfestSortingHat...
echo Operator: http://127.0.0.1:3885/
echo Hall: one button, other monitor, Esc closes
echo.
"%PY%" "%SCRIPT%"
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" (
  echo.
  echo Exit code: %ERR%
  pause
)
endlocal & exit /b %ERR%
