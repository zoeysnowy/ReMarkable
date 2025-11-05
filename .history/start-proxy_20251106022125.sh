#!/bin/bash

echo ""
echo "🚀 启动腾讯混元 API 代理服务器"
echo ""

cd ai-proxy

if [ ! -f .env ]; then
    echo "⚠️  未找到 .env 文件"
    echo ""
    echo "请先配置："
    echo "1. 复制 .env.example 为 .env"
    echo "2. 填入你的腾讯云密钥"
    echo ""
    exit 1
fi

if [ ! -d node_modules ]; then
    echo "📦 正在安装依赖..."
    npm install
    echo ""
fi

echo "📡 启动代理服务器..."
echo ""
npm start
