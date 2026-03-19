# --- SocialBeats COMPLETE INFRASTRUCTURE DEPLOYMENT (Frankfurt) ---
# Sirali, Mirroring destekli ve kota dostu kurulum

$REGION = "europe-west3"
$PROJECT_ID = "socialbeats-487416"
$REPO_NAME = "socialbeats-repo"
$REPO_PATH = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME"

# Python & GCloud Yollari
$PYTHON_BIN = "C:\Users\user\AppData\Local\Python\bin\python.exe"
$GCLOUD_PY = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\lib\gcloud.py"

function Invoke-GCloud {
    param([string[]]$CommandArgs)
    $env:CLOUDSDK_PYTHON = $PYTHON_BIN
    # Argument passing fix: use & with array and ensure everything is string
    & $PYTHON_BIN $GCLOUD_PY @CommandArgs
}

Write-Host ">>> TUMLU KURULUM BASLIYOR (Frankfurt) <<<" -ForegroundColor Yellow

# 1. Proje Ayari ve Artifact Registry Olusturma
Invoke-GCloud -CommandArgs @("config", "set", "project", $PROJECT_ID)
Write-Host "Artifact Registry kontrol ediliyor..." -ForegroundColor Cyan
Invoke-GCloud -CommandArgs @("artifacts", "repositories", "create", $REPO_NAME, "--repository-format=docker", "--location=$REGION", "--quiet")

# 2. Servisleri Mirror Etme ve Deploy
$Services = @(
    @{
        Name = "evolution-api"
        Source = "evolutionapi/evolution-api:latest"
        Target = "$REPO_PATH/evolution-api:latest"
        Port = 8080
        CPU = 1
        Mem = "1Gi"
        Env = "AUTHENTICATION_API_KEY=sb-evolution-api-key-2024,AUTHENTICATION_TYPE=apikey"
    },
    @{
        Name = "livekit-server"
        Source = "livekit/livekit-server:latest"
        Target = "$REPO_PATH/livekit-server:latest"
        Port = 8080
        CPU = 1
        Mem = "1Gi"
        Args = "--dev --port 8080"
    },
    @{
        Name = "umami"
        Source = "ghcr.io/umami-software/umami:postgresql-latest"
        Target = "$REPO_PATH/umami:latest"
        Port = 3000
        CPU = 1
        Mem = "2Gi"
        Env = "DATABASE_URL=postgresql://postgres:Fsmadalet1453@34.141.25.67:5432/postgres,APP_SECRET=sb-umami-secret-2024"
    }
)

# Temp dizin olustur
$TempDir = "$env:TEMP\sb_mirror_$(Get-Random)"
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

foreach ($Svc in $Services) {
    Write-Host "`n--- Operasyon: $($Svc.Name) ---" -ForegroundColor Cyan
    
    # 2.1. Image Mirror (Cloud Build ile)
    $DockerContent = "FROM $($Svc.Source)"
    Set-Content -Path "$TempDir\Dockerfile" -Value $DockerContent -Encoding Ascii
    
    Write-Host "Mirroring image to registry..." -ForegroundColor Gray
    Invoke-GCloud -CommandArgs @("builds", "submit", $TempDir, "--tag", $Svc.Target, "--region", $REGION, "--quiet")
    
    # 2.2. Deploy
    Write-Host "Deploying service..." -ForegroundColor Cyan
    $DeployArgs = @("run", "deploy", $Svc.Name, "--image", $Svc.Target, "--region", $REGION, "--allow-unauthenticated", "--max-instances", "2", "--cpu", "$($Svc.CPU)", "--memory", $Svc.Mem, "--timeout", "600s")
    
    if ($Svc.Port) { $DeployArgs += "--port", "$($Svc.Port)" }
    if ($Svc.Env) { $DeployArgs += "--set-env-vars", $Svc.Env }
    if ($Svc.Args) { $DeployArgs += "--args", "$($Svc.Args)" }

    Invoke-GCloud -CommandArgs $DeployArgs
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[-] $($Svc.Name) FAILED." -ForegroundColor Red
    } else {
        Write-Host "[+] $($Svc.Name) SUCCESSFUL." -ForegroundColor Green
    }
}

Remove-Item -Path $TempDir -Recurse -Force

# 3. Ana Backend
Write-Host "`n--- Ana Backend (SocialBeats Core) Kuruluyor... ---" -ForegroundColor Cyan
$UPSTASH_URL = "https://dynamic-glider-60323.upstash.io"
$UPSTASH_TOKEN = "AeujAAIncDJmZGYwOTY5MmYxYWU0ZTdmYmQ0YjY1OWQ0MGZjNWNlZHAyNjAzMjM"
$MONGO_URL = "mongodb+srv://testuser:Testuser1234@cluster0.wered92.mongodb.net/?authSource=admin&appName=Cluster0"
$POSTGRES_URL = "postgresql://postgres:Fsmadalet1453@db.nhosyslathewgwnfmmyi.supabase.co:5432/postgres"

Push-Location "c:\Users\user\Desktop\PROJE\backend"
$BackendArgs = @("run", "deploy", "socialbeats-core", "--source", ".", "--region", $REGION, "--platform", "managed", "--allow-unauthenticated", "--min-instances", "1", "--max-instances", "5", "--cpu", "1", "--memory", "2Gi", "--timeout", "900s", "--set-env-vars", "UPSTASH_REDIS_REST_URL=$UPSTASH_URL,UPSTASH_REDIS_REST_TOKEN=$UPSTASH_TOKEN,MONGO_URL=$MONGO_URL,POSTGRES_URL=$POSTGRES_URL")
Invoke-GCloud -CommandArgs $BackendArgs
Pop-Location

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nCRITICAL ERROR: Main backend deployment failed." -ForegroundColor Red
} else {
    Write-Host "`n>>> ALL SYSTEMS OPERATIONAL! <<<" -ForegroundColor Green
}

Invoke-GCloud -CommandArgs @("run", "services", "list", "--region", $REGION)
