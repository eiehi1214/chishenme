@echo off
title Push to GitHub
cd /d "%~dp0"

set "GIT=C:\Program Files\Git\cmd\git.exe"
if not exist "%GIT%" set "GIT=git"

echo ================================================
echo   Push "chishenme" project to GitHub
echo   Remote: https://github.com/eiehi1214/chishenme.git
echo ================================================
echo.
echo If a browser window opens, sign in to GitHub and authorize.
echo.

"%GIT%" push -u origin main

echo.
echo ================================================
if %ERRORLEVEL% EQU 0 (
    echo   SUCCESS! Open: https://github.com/eiehi1214/chishenme
) else (
    echo   FAILED. See the message above.
    echo   Tip: if the remote repo has a README, run:
    echo        git pull --rebase origin main
    echo   then run this script again.
)
echo ================================================
pause
