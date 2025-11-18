@echo off
echo 🛡️ 启动循环更新防护测试工具
echo.
echo 请按以下步骤操作：
echo 1. 启动ReMarkable应用
echo 2. 打开Plan页面
echo 3. 按F12打开开发者工具
echo 4. 打开测试页面进行验证
echo.

REM 启动测试页面
start "" "http://localhost:3000/test-circular-updates.html"

echo ✅ 测试页面已启动
echo 📝 测试页面地址: http://localhost:3000/test-circular-updates.html
echo.
echo 💡 测试建议：
echo - 先运行"基础功能测试"验证防护机制
echo - 使用"实时监控"观察更新模式
echo - 执行"循环攻击测试"确认防护效果
echo.
pause