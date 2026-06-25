# FlowDesk Obsidian 插件设计文档

## 概述

FlowDesk 是一个 Obsidian 原生任务流程管理插件，提供看板视图和命令接口。AI 智能操作由 Claudian 驱动，插件本身不包含 AI 能力。

## 架构方案

方案 A：经典 Obsidian 插件架构（单文件打包，原生 DOM，无框架依赖）。

## 项目结构

```
d:\project\FlowDesk\
├── src/
│   ├── main.ts              # Plugin 入口，注册视图/命令/设置
│   ├── types.ts             # Task、Settings 类型定义
│   ├── views/
│   │   └── kanban-view.ts   # ItemView，看板 DOM 渲染 + Drag&Drop
│   ├── services/
│   │   └── task-service.ts  # vault 文件读写、frontmatter 解析
│   ├── commands/
│   │   └── index.ts         # 5 条命令注册
│   └── settings/
│       └── settings-tab.ts  # PluginSettingTab
├── styles.css
├── manifest.json
├── package.json
├── tsconfig.json
└── esbuild.config.mjs
```

## 数据模型

```typescript
type TaskStatus = '收集箱' | '进行中' | '等待中' | '已完成' | '归档'
type Priority = 'low' | 'normal' | 'high' | 'urgent'

interface Task {
  filePath: string      // vault 内路径，作为唯一 ID
  title: string
  status: TaskStatus
  priority: Priority
  tags: string[]
  related: string[]
  created: string       // YYYY-MM-DD
  updated: string
}

interface FlowDeskSettings {
  tasksDir: string      // 默认 'FlowDesk/tasks'
  clippingsDir: string  // 默认 'FlowDesk/clippings'
  columns: string[]     // 状态列顺序
  hideArchive: boolean  // 默认 true
}
```

### 任务文件格式

文件名：`<timestamp>-<slug>.md`

```markdown
---
title: 任务标题
status: 收集箱
priority: normal
tags: [标签1, 标签2]
related:
  - "路径/关联笔记1.md"
created: 2026-06-25
updated: 2026-06-25
---

## 描述
任务的详细描述

## 备注
额外的备注信息
```

### frontmatter 字段

| 字段 | 必填 | 类型 | 说明 |
|------|------|------|------|
| title | 是 | string | 任务标题 |
| status | 是 | string | 枚举：收集箱/进行中/等待中/已完成/归档 |
| priority | 否 | string | low/normal/high/urgent |
| tags | 否 | string[] | 标签数组 |
| related | 否 | string[] | 关联笔记路径数组 |
| created | 是 | string | YYYY-MM-DD |
| updated | 是 | string | YYYY-MM-DD |

## 看板视图

**注册类型：** `flowdesk-kanban`（`ItemView` 子类）

**布局：** 水平滚动容器，每列 280px，列内卡片垂直排列。

**卡片显示：**
- 标题（粗体）
- 优先级左边框色：urgent=红, high=橙, normal=无, low=灰
- 标签 chip
- 更新时间

**拖拽流程：**
```
dragstart → 记录 task.filePath
dragover  → 列高亮（preventDefault 允许 drop）
drop      → TaskService.updateStatus(filePath, newStatus)
          → 文件写入触发 vault.modify → 自动刷新
```

**工具栏：** 标签筛选、优先级筛选、新建任务按钮（Obsidian Modal）

**刷新策略：** 仅监听 `tasksDir` 路径下文件变更，避免全局重渲染。

## 命令注册

| 命令 ID | 功能 |
|---------|------|
| `flowdesk:create-task` | 弹出 Modal 输入标题描述，创建任务文件 |
| `flowdesk:update-task` | 更新当前打开的任务文件 |
| `flowdesk:delete-task` | 删除当前打开的任务文件 |
| `flowdesk:list-tasks` | 打开看板视图 |
| `flowdesk:move-task` | 弹出选择器切换当前任务状态 |

Modal 使用 Obsidian 内置 `Modal` 类，不自制弹窗。

## 服务层

`TaskService` 职责：
- `loadTasks()` — 扫描 tasksDir，解析所有 .md 文件 frontmatter
- `createTask(title, description)` — 生成文件名，写入文件
- `updateStatus(filePath, status)` — 更新 frontmatter 中 status 和 updated
- `deleteTask(filePath)` — 删除文件
- `updateTask(filePath, partial)` — 更新任意 frontmatter 字段

frontmatter 解析使用 Obsidian 内置 `parseYaml` / `stringifyYaml`，不引入第三方库。

## 设置面板

`PluginSettingTab` 配置项：

| 配置项 | 默认值 |
|--------|--------|
| 任务目录 | `FlowDesk/tasks` |
| 剪藏目录 | `FlowDesk/clippings` |
| 看板列配置 | `收集箱, 进行中, 等待中, 已完成, 归档` |
| 归档自动隐藏 | `true` |

配置存储在 `.obsidian/plugins/flowdesk/data.json`（Obsidian 标准）。

## 技术栈

- 语言：TypeScript
- 构建：esbuild（单文件输出 `main.js`）
- UI：原生 DOM 操作
- 样式：CSS，使用 Obsidian CSS 变量（`--color-base-*`, `--interactive-*`）
- 拖拽：HTML5 Drag & Drop API

## 数据流

```
vault.on('modify', tasksDir) → TaskService.loadTasks() → KanbanView.render()
用户拖拽 → TaskService.updateStatus() → 写文件 → vault.modify 事件 → 重渲染
```

单向数据流，无额外状态管理层。

## 约束

- 不内置 AI 调用，不管理 API Key
- 不做定时抓取或轮询
- 不做移动端适配
- MVP 不做社区插件发布
- Claudian 直接读写 vault 文件，插件通过文件变更事件感知
