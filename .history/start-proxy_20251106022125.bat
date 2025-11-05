@echo off
echo.
echo 🚀 启动腾讯混元 API 代理服务器
echo.

cd ai-proxy

if not exist .env (
    echo ⚠️  未找到 .env 文件
    echo.
    echo 请先配置：
    echo 1. 复制 .env.example 为 .env
    echo 2. 填入你的腾讯云密钥
    echo.
    pause
    exit /b 1
)

if not exist node_modules (
    echo 📦 正在安装依赖...
    call npm install
    echo.
)

echo 📡 启动代理服务器...
echo.
call npm start
