@echo off
title ChiShenMe-Backend
rem Auto-locate the project folder containing server.js

set "APPDIR=%~dp0"
if exist "%APPDIR%server.js" goto run
if exist "%APPDIR%吃什么全栈\server.js" (
    set "APPDIR=%~dp0吃什么全栈\"
    goto run
)
set "APPDIR=C:/Users/26764/WorkBuddy/软件课设实习/吃什么全栈/"
if exist "%APPDIR%server.js" goto run

echo [ERROR] server.js not found. Please put this .bat in the project folder.
pause
exit /b

:run
cd /d "%APPDIR%"
echo ================================================
echo   ChiShenMe Backend starting...
echo   Dir: %APPDIR%
echo   URL: http://localhost:3000
echo   Close this window to stop the server.
echo ================================================
start "" http://localhost:3000
"C:/Users/26764/.workbuddy/binaries/node/versions/22.22.2-2/node.exe" --no-warnings server.js
pause
