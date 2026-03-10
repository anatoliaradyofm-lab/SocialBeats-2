@echo off
setlocal enabledelayedexpansion
title SocialBeats Backend

REM PATH'e yaygin Python yerleri ekle
set "PATH=%PATH%;%LOCALAPPDATA%\Python\bin;%LOCALAPPDATA%\Programs\Python\Python314;%LOCALAPPDATA%\Programs\Python\Python312;%ProgramFiles%\Python314;%ProgramFiles%\Python312"

cd /d "%~dp0backend"

REM 1) C:\Windows\py.exe (en yaygin)
if exist "C:\Windows\py.exe" (
  echo Backend: C:\Windows\py.exe
  C:\Windows\py.exe server.py
  goto :end
)

REM 2) System32
if exist "C:\Windows\System32\py.exe" (
  echo Backend: System32\py.exe
  C:\Windows\System32\py.exe server.py
  goto :end
)

REM 3) where py ile bul
for /f "delims=" %%i in ('where py 2^>nul') do (
  echo Backend: %%i
  "%%i" server.py
  goto :end
)

REM 4) where python ile bul
for /f "delims=" %%i in ('where python 2^>nul') do (
  echo Backend: %%i
  "%%i" server.py
  goto :end
)

echo HATA: Python bulunamadi.
echo CMD acip "where py" yazin - cikti bos mu?
:end
echo.
pause
