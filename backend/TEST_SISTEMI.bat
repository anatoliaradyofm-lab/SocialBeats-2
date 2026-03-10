@echo off
color 0b
echo ===========================================
echo 🚀 SOCIALBEATS SISTEM TESTI BASLIYOR...
echo ===========================================
echo Bilesenler kontrol ediliyor, lutfen bekleyin...
echo.

WHERE python >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo Python Ortam Degiskenlerinde bulundu!
    python verify_system.py
    pause
    exit /b
)

echo Python standart yollarda bulunamadi, yaygin kurulum klasorleri taranıyor...

IF EXIST "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    echo Python 3.11 AppData klasorunde bulundu!
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" verify_system.py
    pause
    exit /b
)

IF EXIST "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    echo Python 3.12 AppData klasorunde bulundu!
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" verify_system.py
    pause
    exit /b
)

IF EXIST "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" (
    echo Python 3.10 AppData klasorunde bulundu!
    "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" verify_system.py
    pause
    exit /b
)

IF EXIST "C:\Python311\python.exe" (
    echo C: dizininde Python 3.11 bulundu!
    "C:\Python311\python.exe" verify_system.py
    pause
    exit /b
)

IF EXIST "C:\Python312\python.exe" (
    echo C: dizininde Python 3.12 bulundu!
    "C:\Python312\python.exe" verify_system.py
    pause
    exit /b
)

color 0c
echo.
echo [HATA] Python kurulumu otomatik bulunamadi!
echo Lutfen baslat menusune "cmd" yazip acilan pencereye "python --version" yazarak kontrol edin.
echo.
pause
