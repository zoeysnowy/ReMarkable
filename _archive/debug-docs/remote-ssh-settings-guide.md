# SSH远程VS Code高级模型配置指南

## 问题
通过SSH连接到远程机器后，无法看到Claude等高级模型，即使登录正确且网络良好。

## 原因
SSH远程连接时，VS Code使用远程机器的设置文件，而不是本地的settings.json。

## 解决步骤

### 方法1：在远程VS Code中直接配置（推荐）

1. 在SSH远程窗口中，按 `Ctrl+Shift+P`
2. 输入 `Preferences: Open Remote Settings (JSON)`
3. 添加以下配置：

```json
{
    "chat.mcp.serverSampling": {
        "Global in Code: Figma": {
            "allowedModels": [
                "copilot/gpt-4.1",
                "copilot/claude-opus-4"
            ]
        }
    },
    "github.copilot.advanced": {},
    "chat.agent.maxRequests": 50
}
```

### 方法2：通过命令行配置远程设置

在远程机器（小白机）上，找到并编辑：
- Windows: `C:\Users\[用户名]\AppData\Roaming\Code\User\settings.json`
- Linux: `~/.config/Code/User/settings.json`

### 方法3：检查扩展安装位置

1. 确保GitHub Copilot扩展安装在**远程SSH**上
2. 在扩展面板中，查看扩展是否显示"SSH: xiaobaiji"
3. 如果没有，点击扩展的"在SSH中安装"按钮

### 方法4：重新认证

在SSH远程窗口中：
1. `Ctrl+Shift+P` → `GitHub Copilot: Sign Out`
2. 重新登录
3. 检查账户权限是否包含高级模型访问

## 验证步骤

1. 打开聊天面板 (`Ctrl+Alt+I`)
2. 点击模型选择器（右上角）
3. 应该能看到：
   - GPT-4o
   - Claude 3.5 Sonnet
   - Claude Opus 4 (如果有权限)
   - o1-preview (如果有权限)

## 常见问题

### Q: 复制settings.json没用？
A: 本地settings.json不会自动同步到远程。需要在远程单独配置。

### Q: 网络没问题但还是不行？
A: 检查远程机器的代理设置和GitHub认证状态。

### Q: 某些设置想在所有地方生效？
A: 使用设置同步功能或Profile功能，但某些设置仍需在远程单独配置。

## 快速诊断命令

在远程VS Code终端中运行：
```powershell
# 检查GitHub Copilot状态
code --list-extensions --show-versions | Select-String "copilot"

# 查看远程设置文件位置
echo $env:APPDATA\Code\User\settings.json
```

## 注意事项

- 每个SSH远程连接都有独立的设置空间
- 扩展需要在远程安装才能工作
- 某些扩展功能可能受远程平台限制
