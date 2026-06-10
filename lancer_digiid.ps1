# =============================================================================
# DigiID - Script de lancement complet
# =============================================================================
# Lance tous les services dans l'ordre, applique les migrations,
# verifie que tout est OK, et affiche les URLs.
#
# Usage : ouvre PowerShell, va dans le dossier digiid/, et tape :
#   .\lancer_digiid.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

# Couleurs pour la lisibilite
function Ecrire-Etape($message) { Write-Host "`n>> $message" -ForegroundColor Cyan }
function Ecrire-OK($message)    { Write-Host "[OK]   $message" -ForegroundColor Green }
function Ecrire-Info($message)  { Write-Host "[INFO] $message" -ForegroundColor Yellow }
function Ecrire-Err($message)   { Write-Host "[ERR]  $message" -ForegroundColor Red }

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "   DigiID -- Lancement complet du projet" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# ----------------------------------------------------------------------------
# 1. Verifier les prerequis
# ----------------------------------------------------------------------------
Ecrire-Etape "Verification des prerequis"

# Verifier Docker
try {
    docker --version | Out-Null
    Ecrire-OK "Docker installe"
} catch {
    Ecrire-Err "Docker n'est pas installe ou ne tourne pas."
    Ecrire-Info "Installer Docker Desktop : https://www.docker.com/products/docker-desktop"
    exit 1
}

# Verifier docker compose
try {
    docker compose version | Out-Null
    Ecrire-OK "docker compose disponible"
} catch {
    Ecrire-Err "docker compose ne fonctionne pas."
    exit 1
}

# Verifier Node.js (pour le frontend)
try {
    $versionNode = node --version
    Ecrire-OK "Node.js $versionNode installe"
} catch {
    Ecrire-Err "Node.js n'est pas installe."
    Ecrire-Info "Installer Node.js 20+ : https://nodejs.org"
    exit 1
}

# ----------------------------------------------------------------------------
# 2. Verifier la configuration backend
# ----------------------------------------------------------------------------
Ecrire-Etape "Verification de la configuration backend"

$envBackend = "backend\.env"
if (-not (Test-Path $envBackend)) {
    Ecrire-Info "Creation du fichier backend\.env depuis l'exemple"
    Copy-Item "backend\.env.exemple" $envBackend

    Write-Host ""
    Ecrire-Err "ATTENTION : edite back  end\.env et change CLE_SECRETE_JWT et CLE_CHIFFREMENT_DONNEES"
    Write-Host "  Pour generer les cles, lance dans un terminal Python :"
    Write-Host '    python -c "import secrets; print(secrets.token_urlsafe(64))"' -ForegroundColor White
    Write-Host '    python -c "import os, base64; print(base64.b64encode(os.urandom(32)).decode())"' -ForegroundColor White
    Write-Host ""
    Read-Host "Appuie sur Entree quand c'est fait pour continuer"
} else {
    Ecrire-OK "backend\.env present"
}

# ----------------------------------------------------------------------------
# 3. Verifier la configuration frontend
# ----------------------------------------------------------------------------
Ecrire-Etape "Verification de la configuration frontend"

$envFrontend = "frontend\.env.local"
if (-not (Test-Path $envFrontend)) {
    Ecrire-Info "Creation du fichier frontend\.env.local"
    @"
NEXT_PUBLIC_URL_BACKEND=http://localhost:8000
URL_BACKEND=http://localhost:8000
NEXT_PUBLIC_NOM_APPLICATION=DigiID
"@ | Set-Content $envFrontend -Encoding UTF8
    Ecrire-OK "frontend\.env.local cree"
} else {
    Ecrire-OK "frontend\.env.local present"
}

# ----------------------------------------------------------------------------
# 4. Demarrer les services Docker
# ----------------------------------------------------------------------------
Ecrire-Etape "Demarrage des services Docker (PostgreSQL, Redis, Backend, Ollama, ChromaDB)"
Push-Location infrastructure
try {
    docker compose up -d
    Ecrire-OK "Services Docker demarres"
} catch {
    Ecrire-Err "Echec du demarrage Docker. Logs :"
    docker compose logs --tail=30
    Pop-Location
    exit 1
}

# ----------------------------------------------------------------------------
# 5. Attendre que le backend soit pret
# ----------------------------------------------------------------------------
Ecrire-Etape "Attente du backend (peut prendre 30s au premier demarrage)"
$maxTentatives = 30
$pret = $false
for ($i = 1; $i -le $maxTentatives; $i++) {
    Start-Sleep -Seconds 2
    try {
        $reponse = Invoke-WebRequest -Uri "http://localhost:8000/api/v1/sante" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($reponse.StatusCode -eq 200) {
            $pret = $true
            $secondes = $i * 2
            Ecrire-OK "Backend operationnel apres $secondes secondes"
            break
        }
    } catch {
        Write-Host "." -NoNewline
    }
}
Write-Host ""

if (-not $pret) {
    Ecrire-Err "Le backend ne repond pas apres 60s. Logs :"
    docker compose logs backend --tail=20
    Pop-Location
    exit 1
}

# ----------------------------------------------------------------------------
# 6. Appliquer les migrations si necessaire
# ----------------------------------------------------------------------------
Ecrire-Etape "Application des migrations de base de donnees"
try {
    docker compose exec -T backend alembic upgrade head 2>&1 | Out-Null
    Ecrire-OK "Migrations appliquees (ou deja a jour)"
} catch {
    Ecrire-Info "Pas de migration en attente, ou erreur -- verifier les logs"
}

Pop-Location

# ----------------------------------------------------------------------------
# 7. Verifier le modele ML
# ----------------------------------------------------------------------------
Ecrire-Etape "Verification du modele ML entraine"
$cheminModele = "backend\modeles_entraines\scoring_v1.joblib"
if (Test-Path $cheminModele) {
    $tailleKo = [math]::Round((Get-Item $cheminModele).Length / 1KB, 1)
    Ecrire-OK "Modele ML trouve ($tailleKo Ko)"
} else {
    Ecrire-Info "Modele ML non trouve. Le scoring utilisera le modele pondere."
    Ecrire-Info "Pour entrainer : lance le notebook backend\notebooks\01_entrainement_modele_scoring.ipynb"
}

# ----------------------------------------------------------------------------
# 8. Nettoyage des caches
# ----------------------------------------------------------------------------
Ecrire-Etape "Nettoyage des caches"

$cacheNext = "frontend\.next"
if (Test-Path $cacheNext) {
    Remove-Item -Recurse -Force $cacheNext -ErrorAction SilentlyContinue
    Ecrire-OK "Cache Next.js (.next) supprime"
} else {
    Ecrire-OK "Pas de cache Next.js a nettoyer"
}

$cacheTurbopack = "$env:TEMP\turbopack"
if (Test-Path $cacheTurbopack) {
    Remove-Item -Recurse -Force $cacheTurbopack -ErrorAction SilentlyContinue
    Ecrire-OK "Cache Turbopack supprime"
}

# Nettoyer le cache npm (evite les conflits de versions)
try {
    npm cache clean --force 2>&1 | Out-Null
    Ecrire-OK "Cache npm nettoye"
} catch {
    Ecrire-Info "Impossible de nettoyer le cache npm (pas grave)"
}

# Nettoyer les caches Python du backend
$cachesPython = @(
    "backend\__pycache__",
    "backend\src\__pycache__",
    "backend\src\api\__pycache__",
    "backend\src\api\v1\__pycache__",
    "backend\src\base_donnees\__pycache__",
    "backend\src\config\__pycache__",
    "backend\src\middleware\__pycache__",
    "backend\src\modeles\__pycache__",
    "backend\src\modules\__pycache__",
    "backend\src\noyau\__pycache__",
    "backend\src\schemas\__pycache__"
)
foreach ($cache in $cachesPython) {
    if (Test-Path $cache) {
        Remove-Item -Recurse -Force $cache -ErrorAction SilentlyContinue
    }
}
Ecrire-OK "Caches Python backend nettoyes"

# ----------------------------------------------------------------------------
# 9. Lancer le frontend (npm install si besoin)
# ----------------------------------------------------------------------------
Ecrire-Etape "Preparation du frontend"
Push-Location frontend

if (-not (Test-Path "node_modules")) {
    Ecrire-Info "Premier lancement : installation des dependances npm (peut prendre 2-3 min)"
    npm install 2>&1 | Out-Null
    Ecrire-OK "Dependances npm installees"
} else {
    Ecrire-OK "Dependances npm deja installees"
}

Pop-Location

# ----------------------------------------------------------------------------
# 10. Recapitulatif final
# ----------------------------------------------------------------------------
Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "   DigiID est PRET" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "URLs disponibles :" -ForegroundColor Cyan
Write-Host "  - API Backend  : http://localhost:8000" -ForegroundColor White
Write-Host "  - Swagger docs : http://localhost:8000/docs" -ForegroundColor White
Write-Host "  - Sante API    : http://localhost:8000/api/v1/sante" -ForegroundColor White
Write-Host ""
$cheminFrontend = Join-Path (Get-Location) "frontend"
Write-Host "Pour lancer le frontend, ouvre un NOUVEAU terminal et tape :" -ForegroundColor Cyan
Write-Host "  cd $cheminFrontend" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Puis ouvre : http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Pour creer ton super admin (premiere fois uniquement) :" -ForegroundColor Cyan
Write-Host "  cd infrastructure" -ForegroundColor White
Write-Host "  docker compose exec -it backend python -m src.base_donnees.seed" -ForegroundColor White
Write-Host ""
Write-Host "Pour arreter tout :" -ForegroundColor Cyan
Write-Host "  .\arreter_digiid.ps1" -ForegroundColor White
Write-Host ""
