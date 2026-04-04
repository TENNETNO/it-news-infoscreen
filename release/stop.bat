@echo off
taskkill /f /im infoscreen.exe >nul 2>&1
taskkill /f /im chrome.exe     >nul 2>&1
echo Infoscreen stopped.
