# ReMarkable Database Repair Script
# Fix corrupted Electron userData

Write-Host "`n" -ForegroundColor Cyan
Write-Host "Database Repair Tool" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

$userDataPath = "$env:APPDATA\remarkable-desktop"
Write-Host "UserData Path: $userDataPath`n" -ForegroundColor Yellow

Write-Host "Warning: This will delete:" -ForegroundColor Yellow
Write-Host "  - IndexedDB" -ForegroundColor Gray
Write-Host "  - Session Storage" -ForegroundColor Gray
Write-Host "  - Local Storage" -ForegroundColor Gray
Write-Host "  - Quota Database (corrupted)`n" -ForegroundColor Gray

Write-Host "Will preserve:" -ForegroundColor Green
Write-Host "  - SQLite Database (remarkable.db)" -ForegroundColor Gray
Write-Host "  - Attachments`n" -ForegroundColor Gray

$confirm = Read-Host "Continue? (Type yes to confirm)"
if ($confirm -ne "yes") {
    Write-Host "`nCancelled" -ForegroundColor Red
    exit 0
}

Write-Host "`nStarting cleanup...`n" -ForegroundColor Green

if (!(Test-Path $userDataPath)) {
    Write-Host "UserData directory not found: $userDataPath" -ForegroundColor Yellow
    exit 0
}

# 1. Delete IndexedDB
$indexedDBPath = Join-Path $userDataPath "IndexedDB"
if (Test-Path $indexedDBPath) {
    Write-Host "1. Deleting IndexedDB..." -ForegroundColor Cyan
    Remove-Item -Path $indexedDBPath -Recurse -Force -ErrorAction SilentlyContinue
    if ($?) {
        Write-Host "   OK - IndexedDB deleted" -ForegroundColor Green
    } else {
        Write-Host "   WARNING - Failed to delete (may be in use)" -ForegroundColor Yellow
    }
} else {
    Write-Host "1. IndexedDB not found, skipping" -ForegroundColor Gray
}

# 2. Delete Session Storage
$sessionStoragePath = Join-Path $userDataPath "Session Storage"
if (Test-Path $sessionStoragePath) {
    Write-Host "2. Deleting Session Storage..." -ForegroundColor Cyan
    Remove-Item -Path $sessionStoragePath -Recurse -Force -ErrorAction SilentlyContinue
    if ($?) {
        Write-Host "   OK - Session Storage deleted" -ForegroundColor Green
    } else {
        Write-Host "   WARNING - Failed to delete" -ForegroundColor Yellow
    }
} else {
    Write-Host "2. Session Storage not found, skipping" -ForegroundColor Gray
}

# 3. Delete Local Storage
$localStoragePath = Join-Path $userDataPath "Local Storage"
if (Test-Path $localStoragePath) {
    Write-Host "3. Deleting Local Storage..." -ForegroundColor Cyan
    Remove-Item -Path $localStoragePath -Recurse -Force -ErrorAction SilentlyContinue
    if ($?) {
        Write-Host "   OK - Local Storage deleted" -ForegroundColor Green
    } else {
        Write-Host "   WARNING - Failed to delete" -ForegroundColor Yellow
    }
} else {
    Write-Host "3. Local Storage not found, skipping" -ForegroundColor Gray
}

# 4. Delete QuotaManager
$quotaManagerPath = Join-Path $userDataPath "QuotaManager"
if (Test-Path $quotaManagerPath) {
    Write-Host "4. Deleting QuotaManager (corrupted quota database)..." -ForegroundColor Cyan
    Remove-Item -Path $quotaManagerPath -Recurse -Force -ErrorAction SilentlyContinue
    if ($?) {
        Write-Host "   OK - QuotaManager deleted" -ForegroundColor Green
    } else {
        Write-Host "   WARNING - Failed to delete" -ForegroundColor Yellow
    }
} else {
    Write-Host "4. QuotaManager not found, skipping" -ForegroundColor Gray
}

# 5. Delete blob_storage
$blobStoragePath = Join-Path $userDataPath "blob_storage"
if (Test-Path $blobStoragePath) {
    Write-Host "5. Deleting blob_storage..." -ForegroundColor Cyan
    Remove-Item -Path $blobStoragePath -Recurse -Force -ErrorAction SilentlyContinue
    if ($?) {
        Write-Host "   OK - blob_storage deleted" -ForegroundColor Green
    } else {
        Write-Host "   WARNING - Failed to delete" -ForegroundColor Yellow
    }
} else {
    Write-Host "5. blob_storage not found, skipping" -ForegroundColor Gray
}

# 6. Preserve SQLite
$sqlitePath = Join-Path $userDataPath "remarkable.db"
if (Test-Path $sqlitePath) {
    $sqliteSize = (Get-Item $sqlitePath).Length / 1KB
    Write-Host "6. Preserving SQLite database" -ForegroundColor Green
    Write-Host "   Database size: $([math]::Round($sqliteSize, 2)) KB" -ForegroundColor Gray
} else {
    Write-Host "6. SQLite database not found (will be created on next startup)" -ForegroundColor Yellow
}

# 7. Preserve Attachments
$attachmentsPath = Join-Path $userDataPath "attachments"
if (Test-Path $attachmentsPath) {
    $attachmentCount = (Get-ChildItem -Path $attachmentsPath -File -Recurse | Measure-Object).Count
    Write-Host "7. Preserving Attachments" -ForegroundColor Green
    Write-Host "   Attachment count: $attachmentCount" -ForegroundColor Gray
} else {
    Write-Host "7. Attachments not found, skipping" -ForegroundColor Gray
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "Database cleanup complete!`n" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Restart app: npm run e" -ForegroundColor Gray
Write-Host "  2. App will auto-rebuild IndexedDB" -ForegroundColor Gray
Write-Host "  3. SQLite data will sync to IndexedDB`n" -ForegroundColor Gray
