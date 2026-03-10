@echo off
echo === SocialBeats Setup ===
echo.
echo Working directory: %CD%
echo.

cd /d "C:\Users\user\Desktop\PROJE\backend"

echo Step 1: Testing Python...
"C:\Users\user\AppData\Local\Python\pythoncore-3.14-64\python.exe" --version
echo Result: %ERRORLEVEL%
echo.

echo Step 2: Testing gcloud...
"C:\Users\user\Desktop\google-cloud-sdk\bin\gcloud.cmd" --version
echo Result: %ERRORLEVEL%
echo.

echo Step 3: PostgreSQL test...
"C:\Users\user\AppData\Local\Python\pythoncore-3.14-64\python.exe" scripts\test_postgres.py
echo Result: %ERRORLEVEL%
echo.

echo === Done. Press any key to close ===
pause
