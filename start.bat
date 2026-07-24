@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   ZORKA  -  lokalnyy zapusk
echo   Otkroy v brauzere:  http://localhost:8080
echo   (chtob ostanovit - zakroy eto okno)
echo.
start "" http://localhost:8080
node tools\serve.js
pause
