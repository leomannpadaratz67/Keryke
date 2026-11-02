@echo off
rem Collects the latest headlines. Double-click, then reload Keryke in your browser.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\update-news.ps1"
pause
