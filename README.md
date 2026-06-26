# FlowDesk

Obsidian 原生任务流程管理插件，提供看板视图和网址导航页。

## 功能

- **看板视图** — 按状态列展示任务（收集箱 / 进行中 / 等待中 / 已完成 / 归档），支持拖拽切换状态
- **导航页** — 可编辑的网址导航，分类管理常用链接
- **右键菜单** — 快速设置任务优先级
- **快捷键** — `Ctrl+Shift+K` 打开看板，侧边栏 Ribbon 图标一键访问
- **命令面板** — 创建任务、移动状态、删除任务等命令

## 安装

1. 克隆仓库到本地
2. `npm install`
3. `npm run build`
4. 将 `main.js`、`manifest.json`、`styles.css` 复制到 vault 的 `.obsidian/plugins/flowdesk/` 目录
5. 在 Obsidian 设置中启用插件
6. **配置 vault 的 CLAUDE.md**（供 AI 协作）：在 vault 根目录的 `CLAUDE.md` 中添加：
   ```markdown
   ## FlowDesk 任务管理
   
   创建/修改/查询 FlowDesk 任务前，先读取 `<你的任务目录路径>/README.md` 获取完整规范（文件格式、字段定义、命名规则）。
   
   任务目录：`<你的任务目录路径>/tasks/`（如 `10-项目/FlowDesk/tasks/`）
   导航数据：`<你的任务目录路径>/nav.json`
   ```
   完整规范参考 `CLAUDE-VAULT-TEMPLATE.md`

## 开发

```bash
npm run dev    # 开发构建（含 sourcemap）
npm run build  # 生产构建
```

## 任务文件格式

任务以 markdown 文件存储，默认目录 `FlowDesk/tasks/`：

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
---
```

## 与 AI 协作

FlowDesk 本身不包含 AI 能力。Claudian（或其他 AI 助手）可直接读写 vault 文件来创建/管理任务，插件通过文件变更事件自动刷新看板。

## 配置项

| 配置 | 默认值 | 说明 |
|------|--------|------|
| 任务目录 | `FlowDesk/tasks` | 任务文件存储路径 |
| 剪藏目录 | `FlowDesk/clippings` | 摘要笔记路径 |
| 看板列 | `收集箱, 进行中, 等待中, 已完成, 归档` | 状态列配置 |
| 归档隐藏 | `true` | 看板中折叠归档列 |

## 技术栈

TypeScript · esbuild · Obsidian API · 原生 DOM · HTML5 Drag & Drop
