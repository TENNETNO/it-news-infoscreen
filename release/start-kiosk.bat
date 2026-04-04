@echo off
:: Start the infoscreen server
start "" infoscreen.exe

:: Wait a moment for the server to start
timeout /t 3 /nobreak > nul

:: Open Chrome in kiosk mode (full-screen, no browser UI)
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --app=http://localhost:8080 --disable-pinch --overscroll-history-navigation=0
