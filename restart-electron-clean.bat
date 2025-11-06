@echo off
echo ============================================
echo 🔄 强制清除 Electron 缓存并重启
echo ============================================
echo.

echo 1️⃣ 关闭所有 Electron 进程...
taskkill /F /IM electron.exe 2>nul
timeout /t 1 >nul

echo.
echo 2️⃣ 清除 Electron 缓存...
if exist "%APPDATA%\ReMarkable" (
    echo 删除 %APPDATA%\ReMarkable
    rmdir /S /Q "%APPDATA%\ReMarkable"
)

if exist "%USERPROFILE%\AppData\Local\ReMarkable" (
    echo 删除 %USERPROFILE%\AppData\Local\ReMarkable
    rmdir /S /Q "%USERPROFILE%\AppData\Local\ReMarkable"
)

echo.
echo 3️⃣ 清除 node_modules\.cache...
if exist "node_modules\.cache" (
    rmdir /S /Q "node_modules\.cache"
)

echo.
echo 4️⃣ 重新启动 Electron...
echo.
npm run e

pause
