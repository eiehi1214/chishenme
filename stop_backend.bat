@echo off
rem Stop the ChiShenMe backend by its window title.
taskkill /F /FI "WINDOWTITLE eq ChiShenMe-Backend*"
echo Backend stopped.
pause
