# ReMarkable → 4DNote 批量改名脚本
# 使用方法: .\scripts\rename-to-4dnote.ps1
# 执行前请确保已阅读 REBRANDING_PLAN.md

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   ReMarkable → 4DNote 改名工具" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 获取当前路径
$projectRoot = Split-Path -Parent $PSScriptRoot

# 确认执行
Write-Host "⚠️  警告: 此操作将修改项目中的所有相关文件！" -ForegroundColor Yellow
Write-Host "   项目路径: $projectRoot`n" -ForegroundColor Gray
$confirm = Read-Host "确认执行？(输入 yes 继续)"

if ($confirm -ne "yes") {
  Write-Host "`n❌ 操作已取消" -ForegroundColor Red
  exit 0
}

# 1. 创建备份
Write-Host "`n1️⃣  创建备份..." -ForegroundColor Yellow
$backupDir = "$projectRoot`_Backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Copy-Item -Path $projectRoot -Destination $backupDir -Recurse -Exclude node_modules,dist,build,.git
Write-Host "   ✅ 备份完成: $backupDir`n" -ForegroundColor Green

# 2. 更新 package.json
Write-Host "2️⃣  更新 package.json..." -ForegroundColor Yellow
$packageFiles = @(
  "$projectRoot\package.json",
  "$projectRoot\electron\package.json"
)

foreach ($file in $packageFiles) {
  if (Test-Path $file) {
    $content = Get-Content $file -Raw -Encoding UTF8
    $content = $content `
      -replace '"name":\s*"remarkable(-desktop)?"', '"name": "4dnote$1"' `
      -replace 'ReMarkable v', '4DNote v' `
      -replace 'ReMarkable Desktop', '4DNote Desktop' `
      -replace 'com\.remarkable\.', 'com.4dnote.' `
      -replace 'ReMarkable Team', '4DNote Team' `
      -replace '"shortcutName":\s*"ReMarkable"', '"shortcutName": "4DNote"' `
      -replace '"productName":\s*"ReMarkable"', '"productName": "4DNote"'
    
    Set-Content $file $content -NoNewline -Encoding UTF8
    Write-Host "   ✅ 已更新: $(Split-Path $file -Leaf)" -ForegroundColor Green
  }
}

# 3. 更新代码文件
Write-Host "`n3️⃣  更新代码文件..." -ForegroundColor Yellow
$codeFiles = Get-ChildItem -Path "$projectRoot\src" -Recurse -Include *.ts,*.tsx | Where-Object { $_.FullName -notlike "*node_modules*" }

$replacements = @{
  'remarkableSource' = 'fourDNoteSource'
  'remarkableUserId' = 'fourDnoteUserId'
  'remarkable-events' = '4dnote-events'
  'remarkable-settings' = '4dnote-settings'
  'remarkable-global-timer' = '4dnote-global-timer'
  'remarkable-outlook-authenticated' = '4dnote-outlook-authenticated'
  'remarkable-storage-version' = '4dnote-storage-version'
  'remarkable-sync-action-queue' = '4dnote-sync-action-queue'
  'remarkable_event_history' = '4dnote_event_history'
  'remarkable_migration_completed' = '4dnote_migration_completed'
  'remarkable-sync-queue' = '4dnote-sync-queue'
  'ReMarkableDB' = '4DNoteDB'
  'remarkable-db' = '4dnote-db'
  'remarkable-desktop' = '4dnote-desktop'
  'ReMarkable计时' = '4DNote计时'
  'ReMarkable计划' = '4DNote计划'
  'ReMarkable联系人' = '4DNote联系人'
  'ReMarkable 联系人' = '4DNote 联系人'
  "name: 'ReMarkable'" = "name: '4DNote'"
  'name: `ReMarkable`' = 'name: `4DNote`'
  "remarkableLogo" = "fourDNoteLogo"
}

$updatedCount = 0
foreach ($file in $codeFiles) {
  $content = Get-Content $file.FullName -Raw -Encoding UTF8
  $modified = $false
  
  foreach ($old in $replacements.Keys) {
    $new = $replacements[$old]
    if ($content -match [regex]::Escape($old)) {
      $content = $content -replace [regex]::Escape($old), $new
      $modified = $true
    }
  }
  
  if ($modified) {
    Set-Content $file.FullName $content -NoNewline -Encoding UTF8
    $updatedCount++
    Write-Host "   ✅ 已更新: $($file.Name)" -ForegroundColor Green
  }
}
Write-Host "   📊 共更新 $updatedCount 个代码文件`n" -ForegroundColor Cyan

# 4. 更新 HTML 文件
Write-Host "4️⃣  更新 HTML 文件..." -ForegroundColor Yellow
$htmlFiles = @(
  "$projectRoot\public\index.html",
  "$projectRoot\index.html"
)

foreach ($file in $htmlFiles) {
  if (Test-Path $file) {
    $content = Get-Content $file -Raw -Encoding UTF8
    $content = $content -replace '<title>ReMarkable</title>', '<title>4DNote</title>'
    Set-Content $file $content -NoNewline -Encoding UTF8
    Write-Host "   ✅ 已更新: $(Split-Path $file -Leaf)" -ForegroundColor Green
  }
}

# 5. 更新文档 (可选)
Write-Host "`n5️⃣  更新文档文件 (可选)..." -ForegroundColor Yellow
$updateDocs = Read-Host "是否更新所有文档文件？这会修改约 150 个 .md 文件 (y/N)"

if ($updateDocs -eq 'y') {
  $docFiles = Get-ChildItem -Path $projectRoot -Recurse -Include *.md | Where-Object { 
    $_.FullName -notlike "*node_modules*" -and 
    $_.FullName -notlike "*_archive*" -and 
    $_.FullName -notlike "*.git*" -and
    $_.Name -ne "REBRANDING_PLAN.md"
  }
  
  $docUpdatedCount = 0
  foreach ($file in $docFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $content = $content `
      -replace 'ReMarkable', '4DNote' `
      -replace 'remarkable-desktop', '4dnote-desktop'
    
    Set-Content $file.FullName $content -NoNewline -Encoding UTF8
    $docUpdatedCount++
  }
  
  Write-Host "   ✅ 已更新 $docUpdatedCount 个文档文件" -ForegroundColor Green
} else {
  Write-Host "   ⏭️  跳过文档更新" -ForegroundColor Gray
}

# 6. 更新 Electron 修复脚本
Write-Host "`n6️⃣  更新 Electron 修复脚本..." -ForegroundColor Yellow
$psFiles = @(
  "$projectRoot\fix-corrupted-database.ps1",
  "$projectRoot\setup-aliases.ps1"
)

foreach ($file in $psFiles) {
  if (Test-Path $file) {
    $content = Get-Content $file -Raw -Encoding UTF8
    $content = $content `
      -replace 'remarkable-desktop', '4dnote-desktop' `
      -replace 'remarkable\.db', '4dnote.db' `
      -replace 'ReMarkable', '4DNote'
    
    Set-Content $file $content -NoNewline -Encoding UTF8
    Write-Host "   ✅ 已更新: $(Split-Path $file -Leaf)" -ForegroundColor Green
  }
}

# 7. 更新 README
Write-Host "`n7️⃣  更新 README.md..." -ForegroundColor Yellow
$readmeFile = "$projectRoot\README.md"
if (Test-Path $readmeFile) {
  $content = Get-Content $readmeFile -Raw -Encoding UTF8
  $content = $content `
    -replace 'ReMarkable v\d+\.\d+', '4DNote v1.3' `
    -replace 'ReMarkable 是一个', '4DNote 是一个' `
    -replace 'remarkable', '4dnote' `
    -replace 'zoeysnowy/ReMarkable', 'zoeysnowy/4DNote'
  
  Set-Content $readmeFile $content -NoNewline -Encoding UTF8
  Write-Host "   ✅ 已更新: README.md" -ForegroundColor Green
}

# 8. 重命名 LOGO 文件变量名
Write-Host "`n8️⃣  更新 LOGO 导入..." -ForegroundColor Yellow
$logoFiles = Get-ChildItem -Path "$projectRoot\src" -Recurse -Include *.tsx,*.ts | Where-Object { 
  $_.FullName -notlike "*node_modules*" 
}

foreach ($file in $logoFiles) {
  $content = Get-Content $file.FullName -Raw -Encoding UTF8
  if ($content -match "import remarkableLogo from") {
    $content = $content -replace "import remarkableLogo from", "import fourDNoteLogo from"
    $content = $content -replace "remarkableLogo", "fourDNoteLogo"
    Set-Content $file.FullName $content -NoNewline -Encoding UTF8
    Write-Host "   ✅ 已更新 LOGO 导入: $($file.Name)" -ForegroundColor Green
  }
}

# 完成
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   改名完成！🎉" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "📊 统计:" -ForegroundColor Cyan
Write-Host "   代码文件: $updatedCount 个" -ForegroundColor Gray
if ($updateDocs -eq 'y') {
  Write-Host "   文档文件: $docUpdatedCount 个" -ForegroundColor Gray
}
Write-Host "   配置文件: 4 个" -ForegroundColor Gray

Write-Host "`n⚠️  下一步操作:" -ForegroundColor Yellow
Write-Host "   1. 检查是否有遗漏: Select-String -Path .\src\* -Pattern 'ReMarkable|remarkable' -Exclude node_modules" -ForegroundColor Gray
Write-Host "   2. 运行应用测试: npm run e" -ForegroundColor Gray
Write-Host "   3. 浏览器控制台运行数据迁移: .\scripts\migrate-storage-keys.js" -ForegroundColor Gray
Write-Host "   4. 验证所有功能正常" -ForegroundColor Gray
Write-Host "   5. 提交 Git: git add . && git commit -m 'chore: rebrand to 4DNote'" -ForegroundColor Gray

Write-Host "`n✅ 备份位置: $backupDir" -ForegroundColor Green
Write-Host "ℹ️  如需回滚，请删除当前项目并恢复备份`n" -ForegroundColor Gray
