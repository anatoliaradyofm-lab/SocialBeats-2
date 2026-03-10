@echo off
chcp 65001 >nul
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

REM .env dosyasindan API_KEY oku (varsa)
if exist "%ROOT%\.env" (
  for /f "tokens=1,* delims==" %%a in ('findstr /b "API_KEY" "%ROOT%\.env" 2^>nul') do set "API_KEY=%%b"
  set "API_KEY=!API_KEY: =!"
)

REM Kullanici API_KEY girmemis
if "%API_KEY%"=="" (
  echo TestSprite API Key gerekli.
  echo .env dosyasina API_KEY=sk_test_xxx ekleyin
  echo veya asagiya API key girin:
  set /p API_KEY="API Key: "
)

if "%API_KEY%"=="" (
  echo API Key bos. Test iptal.
  pause
  exit /b 1
)

echo Backend ve Frontend calisiyor olmali!
echo Backend: localhost:8000  Frontend: localhost:8081
echo.
echo TestSprite baslatiliyor...
cd /d "%ROOT%"
set "API_KEY=%API_KEY%"
call npm run testsprite

echo.
echo Rapor: %ROOT%\testsprite_tests\testsprite-mcp-test-report.md
pause
