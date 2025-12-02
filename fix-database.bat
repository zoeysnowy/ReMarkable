@echo off
chcp 65001 >nul
echo.
echo 🔧 快速修复损坏的数据库
echo ======================================
echo.
echo ⚠️  即将清理 Electron userData 目录
echo    保留 SQLite 和 Attachments
echo.
pause
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0fix-corrupted-database.ps1"
echo.
pause
