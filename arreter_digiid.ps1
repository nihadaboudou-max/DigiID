# =============================================================================
# DigiID - Arret propre de tous les services
# =============================================================================
# Usage : .\arreter_digiid.ps1
# =============================================================================

Write-Host "Arret de DigiID..." -ForegroundColor Cyan

Push-Location infrastructure
docker compose stop
Pop-Location

Write-Host ""
Write-Host "[OK] Tous les services Docker sont arretes." -ForegroundColor Green
Write-Host "Les donnees sont preservees dans les volumes Docker." -ForegroundColor Yellow
Write-Host ""
Write-Host "Pour relancer : .\lancer_digiid.ps1" -ForegroundColor Cyan
Write-Host "Pour TOUT effacer (donnees comprises) :" -ForegroundColor Red
Write-Host "  cd infrastructure" -ForegroundColor White
Write-Host "  docker compose down -v" -ForegroundColor White
Write-Host ""
