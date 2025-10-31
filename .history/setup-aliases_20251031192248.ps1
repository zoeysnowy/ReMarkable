# ReMarkable 快捷命令别名设置
# 使用方法：在 PowerShell 中运行此脚本，或将内容添加到 PowerShell 配置文件

# 定义别名
function Start-ReMarkableElectron {
    npm run electron-dev
}

function Start-ReMarkableWeb {
    npm start
}

function Start-ReMarkableBoth {
    npm run electron-dev
}

# 设置短别名
Set-Alias -Name ed -Value Start-ReMarkableElectron
Set-Alias -Name rme -Value Start-ReMarkableElectron
Set-Alias -Name rmw -Value Start-ReMarkableWeb

Write-Host "✓ ReMarkable 别名已设置！" -ForegroundColor Green
Write-Host ""
Write-Host "可用命令：" -ForegroundColor Cyan
Write-Host "  ed          - 启动 Electron (最短)" -ForegroundColor Yellow
Write-Host "  rme         - 启动 Electron" -ForegroundColor Yellow
Write-Host "  rmw         - 仅启动 Web 服务" -ForegroundColor Yellow
Write-Host ""
Write-Host "当前会话已生效。若要永久生效，请运行：" -ForegroundColor Gray
Write-Host "  notepad `$PROFILE" -ForegroundColor White
Write-Host "然后将此脚本内容复制到配置文件中" -ForegroundColor Gray
