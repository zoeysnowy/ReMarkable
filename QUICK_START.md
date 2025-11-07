# 🚀 快速开始 - 另一台电脑

## 一条命令搞定！

```powershell
git clone https://github.com/zoeysnowy/ReMarkable.git
cd ReMarkable
```

**就这么简单！** 🎉

## ✅ 已经包含的内容

克隆后你将立即拥有：

1. **完整的源代码** - 所有项目文件
2. **TUI Calendar 源码** - `src/lib/tui.calendar/`（包含所有修改）
3. **预构建的 dist 文件** - `src/lib/tui.calendar/apps/calendar/dist/`
   - `toastui-calendar.js` 
   - `toastui-calendar.mjs`
   - `toastui-calendar.css`
   - 以及压缩版本

## ❌ 不需要做的事情

- ❌ 不需要 `git submodule init`
- ❌ 不需要 `git submodule update`
- ❌ 不需要 `cd src/lib/tui.calendar && npm install`
- ❌ 不需要 `npm run build`

## 📋 验证安装

```powershell
# 检查最新提交
git log -1 --oneline
# 应该显示: 1e07f54 feat: include TUI Calendar dist files in repository

# 检查 dist 文件存在
Test-Path src/lib/tui.calendar/apps/calendar/dist/toastui-calendar.js
# 应该返回: True

# 查看 dist 文件
Get-ChildItem src/lib/tui.calendar/apps/calendar/dist
```

## 🔧 如果需要开发

只有在你需要修改主项目代码时：

```powershell
npm install
npm start
```

## 📞 遇到问题？

1. 确保 git 是最新版本：`git --version`
2. 如果克隆失败，尝试：
   ```powershell
   git clone --depth 1 https://github.com/zoeysnowy/ReMarkable.git
   ```
3. 如果提示缺少文件，执行：
   ```powershell
   git pull origin master
   ```

---

**总结：** 现在另一台电脑只需要 `git clone`，然后就可以直接开始工作了！ 🎊
