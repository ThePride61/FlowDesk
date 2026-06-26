# FlowDesk 任务管理规范（供 Claudian 使用）

创建/修改/查询 FlowDesk 任务前，先读取本节规范。

## 任务文件位置

- **任务目录**：`<你的路径>/FlowDesk/tasks/`（根据插件设置中的"任务目录"配置决定）
- **导航数据**：`<你的路径>/FlowDesk/nav.json`（任务目录的父目录）

## 任务文件格式

文件名：`<timestamp>-<slug>.md`（如 `1719316800000-优化看板.md`）

```yaml
---
title: 任务标题
status: 收集箱
priority: normal
tags: [标签1, 标签2]
related:
  - "关联笔记路径.md"
created: 2026-06-25
updated: 2026-06-25
order: 0
---

## 描述
任务详细描述

## 备注
额外备注
```

## 字段说明

| 字段 | 必填 | 类型 | 枚举值/说明 |
|------|------|------|------------|
| title | 是 | string | 任务标题 |
| status | 是 | string | `收集箱` / `进行中` / `等待中` / `已完成` / `归档` |
| priority | 否 | string | `low` / `normal` / `high` / `urgent`（默认 normal） |
| tags | 否 | string[] | 标签数组 |
| related | 否 | string[] | 关联笔记路径数组 |
| created | 是 | string | 创建日期 YYYY-MM-DD |
| updated | 是 | string | 最后更新 YYYY-MM-DD |
| order | 否 | number | 看板内排序（默认 0） |

## 创建任务示例

用户说"帮我创建一个任务：下周整理文档"时：

```markdown
---
title: 下周整理文档
status: 收集箱
priority: normal
tags: []
related: []
created: 2026-06-26
updated: 2026-06-26
order: 0
---

## 描述
下周整理文档

## 备注

```

文件保存为 `<任务目录>/<timestamp>-下周整理文档.md`。

## 更新任务

修改现有任务时：
1. 读取原文件，解析 frontmatter
2. 更新对应字段（如 status、priority）
3. 更新 `updated` 字段为今日日期
4. 写回文件

## 导航页管理

`nav.json` 格式：

```json
[
  {
    "name": "常用",
    "links": [
      { "title": "Google", "url": "https://www.google.com", "icon": "🔍" },
      { "title": "GitHub", "url": "https://github.com" }
    ]
  }
]
```

添加/删除链接时直接读写这个 JSON 文件。
