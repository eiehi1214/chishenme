@echo off
title Pull and Push to GitHub
cd /d "%~dp0"

set "GIT=C:\Program Files\Git\cmd\git.exe"
if not exist "%GIT%" set "GIT=git"

echo ================================================
echo   Step 1/2: pull remote changes (rebase)
echo ================================================
"%GIT%" pull --rebase origin main

echo.
echo ================================================
echo   Step 2/2: push to GitHub
echo ================================================
"%GIT%" push -u origin main

echo.
echo ================================================
if %ERRORLEVEL% EQU 0 (
    echo   DONE. Open: https://github.com/eiehi1214/chishenme
) else (
    echo   FAILED. Read the message above.
    echo   If it says "nothing to commit" or asks for an editor,
    echo   just close this window and send a screenshot to your assistant.
)
echo ================================================
pause
