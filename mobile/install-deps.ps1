# Paket kurulum scripti
# Cursor'dan veya PowerShell'den çalıştırın
Set-Location $PSScriptRoot
Write-Host "Installing @tanstack/react-query zustand expo-av..."
npm install @tanstack/react-query zustand expo-av
if ($LASTEXITCODE -eq 0) {
    Write-Host "Packages installed. Running expo prebuild..."
    npx expo prebuild --clean
} else {
    Write-Host "npm install failed. Try running manually: npm install @tanstack/react-query zustand expo-av"
}
