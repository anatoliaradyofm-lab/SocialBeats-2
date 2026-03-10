@echo off
title SocialBeats Backend
cd /d "%~dp0backend"

REM py.exe tam yol - PATH'e bagli degil
if exist "C:\Windows\py.exe" (
  C:\Windows\py.exe server.py
) else if exist "C:\Windows\System32\py.exe" (
  C:\Windows\System32\py.exe server.py
) else (
  echo py.exe bulunamadi. BACKEND_BASLAT.bat deneyin.
  pause
)
