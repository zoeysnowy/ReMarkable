#!/usr/bin/env python3
# -*- coding: utf-8 -*-

with open('src/components/PlanManager.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 删除 2247-2411 行（Python 索引从 0 开始，所以是 2246:2411）
new_lines = lines[:2246] + lines[2411:]

with open('src/components/PlanManager.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"删除完成！原文件 {len(lines)} 行，现在 {len(new_lines)} 行")
