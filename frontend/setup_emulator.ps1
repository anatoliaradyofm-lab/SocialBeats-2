$ErrorActionPreference = "Stop"

Write-Host "1. Java Ortam Degiskenleri (JAVA_HOME) Ayarlaniyor..."
$javaPaths = Get-ChildItem -Path "C:\Program Files\Microsoft" -Filter "jdk-21*" -Directory
if ($javaPaths) {
    $javaDir = $javaPaths[0].FullName
    [System.Environment]::SetEnvironmentVariable("JAVA_HOME", $javaDir, [System.EnvironmentVariableTarget]::User)
    $env:JAVA_HOME = $javaDir
    
    $path = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)
    $javaBin = "$javaDir\bin"
    if ($path -notmatch [regex]::Escape($javaBin)) {
        [System.Environment]::SetEnvironmentVariable("Path", "$path;$javaBin", [System.EnvironmentVariableTarget]::User)
        $env:Path = "$env:Path;$javaBin"
    }
}
else {
    Write-Host "Java 21 kurulumu bulunamadi, indiriyorum..."
    winget install --id Microsoft.OpenJDK.21 --source winget --accept-package-agreements --accept-source-agreements
    $javaPaths = Get-ChildItem -Path "C:\Program Files\Microsoft" -Filter "jdk-21*" -Directory
    $javaDir = $javaPaths[0].FullName
    [System.Environment]::SetEnvironmentVariable("JAVA_HOME", $javaDir, [System.EnvironmentVariableTarget]::User)
    $env:JAVA_HOME = $javaDir
    $env:Path = "$env:Path;$javaDir\bin"
}

Write-Host "2. Android SDK Command-Line Tools Kontrolü..."
$sdkDir = "C:\Android\sdk"
$cmdlineToolsDir = "$sdkDir\cmdline-tools\latest"
$baseCmdlineDir = "$sdkDir\cmdline-tools"

if (!(Test-Path $baseCmdlineDir)) {
    New-Item -ItemType Directory -Force -Path $baseCmdlineDir | Out-Null
}

$zipPath = "$env:TEMP\cmdline-tools.zip"
if (!(Test-Path "$cmdlineToolsDir\bin\sdkmanager.bat")) {
    $url = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
    if (!(Test-Path $zipPath)) {
        Write-Host "Cmdline Tools indiriliyor..."
        Invoke-WebRequest -Uri $url -OutFile $zipPath
    }
    
    Write-Host "Zip cikariliyor..."
    Expand-Archive -Path $zipPath -DestinationPath $baseCmdlineDir -Force
    
    if (Test-Path "$baseCmdlineDir\cmdline-tools") {
        Rename-Item -Path "$baseCmdlineDir\cmdline-tools" -NewName "latest"
    }
}

Write-Host "3. Ortam Degiskenleri (ANDROID_HOME vs) Ayarliyor..."
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", $sdkDir, [System.EnvironmentVariableTarget]::User)
[System.Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", $sdkDir, [System.EnvironmentVariableTarget]::User)
$env:ANDROID_HOME = $sdkDir
$env:ANDROID_SDK_ROOT = $sdkDir
$path = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)
$newPaths = "$sdkDir\cmdline-tools\latest\bin;$sdkDir\platform-tools;$sdkDir\emulator"
if ($path -notmatch [regex]::Escape($newPaths)) {
    [System.Environment]::SetEnvironmentVariable("Path", "$path;$newPaths", [System.EnvironmentVariableTarget]::User)
    $env:Path = "$env:Path;$newPaths"
}

Write-Host "4. SDK Lisanslari Kabul Ediliyor..."
$yesParams = "y`ny`ny`ny`ny`ny`ny`n"
$yesParams | & "$cmdlineToolsDir\bin\sdkmanager.bat" --licenses

Write-Host "5. Gerekli SDK Bilesenleri Yukleniyor..."
& "$cmdlineToolsDir\bin\sdkmanager.bat" "platform-tools" "build-tools;33.0.0" "platforms;android-33" "system-images;android-33;google_apis;x86_64" "emulator"

Write-Host "6. Pixel 6 API 33 sanal cihaz olusturuluyor..."
$avdName = "Pixel6_API33"
$avdList = & "$cmdlineToolsDir\bin\avdmanager.bat" list avd
if ($avdList -notmatch $avdName) {
    Write-Host "no" | & "$cmdlineToolsDir\bin\avdmanager.bat" create avd -n $avdName -k "system-images;android-33;google_apis;x86_64" --device "pixel_6" -f
}

Write-Host "7. Emulator Baslatiliyor..."
$emulatorArgs = "-avd $avdName -no-snapshot-load -no-snapshot-save"
Start-Process -FilePath "$sdkDir\emulator\emulator.exe" -ArgumentList $emulatorArgs -NoNewWindow

Write-Host "Emulatorun hazirlanmasi icin biraz bekleniyor (30 sn)..."
Start-Sleep -Seconds 30

Write-Host "8 & 9. Frontend klasorunde uygulama derleniyor..."
Set-Location "c:\Users\user\Desktop\PROJE\frontend"
try {
    # Emülatörün ADB tarafında görünmesini bekleyelim
    Start-Sleep -Seconds 10
    & npx react-native run-android
    Write-Host "=========================================="
    Write-Host "EMÜLATÖR HAZIR VE UYGULAMA ÇALIŞIYOR"
    Write-Host "=========================================="
}
catch {
    Write-Host "Hata olustu: $_"
    Write-Host "Onerilen cozumler: BIOS'ta sanallastirmayi acin, hw.gpu.mode=software deneyin..."
}
