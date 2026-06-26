# FlowDesk Obsidian 插件设计文档

## 概述

FlowDesk 是一个 Obsidian 原生任务流程管理插件，提供看板视图和命令接口。AI 智能操作由 Claudian（Obsidian 内的 AI 对话助手）驱动，插件本身不包含 AI 能力。

## 核心定位

- **插件负责**：看板 UI 渲染、任务文件 CRUD、命令注册、设置管理
- **Claudian 负责**：任务识别与创建（主动提议）、状态推进、关联笔记、信息摘要
- **连接方式**：Claudian 直接读写 vault 文件，插件监听文件变更自动刷新

## 约束条件

- 插件不内置 AI 调用，不管理 API Key
- 插件不做定时抓取
- 插件不做事件系统（MVP）
- 插件不做移动端适配
- 独立 git 仓库开发，构建输出到 vault 的 `.obsidian/plugins/flowdesk/`

## 架构

```
┌─────────────────────────────────────┐
│  Claudian（AI 对话层）               │
│  - 识别任务意图 → 写任务文件         │
│  - 读取任务文件 → 理解上下文         │
│  - 摘要链接内容 → 生成笔记           │
└──────────────┬──────────────────────┘
               │ 直接读写 vault 文件
┌──────────────▼──────────────────────┐
│  FlowDesk 插件                       │
│  ┌─────────────┐  ┌───────────────┐ │
│  │ 看板 View   │  │ 命令注册      │ │
│  │ (UI 渲染)   │  │ (CRUD 接口)   │ │
│  └──────┬──────┘  └───────┬───────┘ │
│         │                  │         │
│  ┌──────▼──────────────────▼───────┐ │
│  │    TaskService（数据层）         │ │
│  │    读写 vault markdown 文件      │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Obsidian Vault 文件系统             │
│  <任务目录>/*.md                     │
│  <剪藏目录>/*.md                     │
└─────────────────────────────────────┘
```

### 技术栈

- 语言：TypeScript
- 构建：esbuild
- UI：原生 DOM 操作（不引入 React）
- 样式：CSS，使用 Obsidian 主题变量确保深色/浅色兼容
- 拖拽：HTML5 Drag & Drop API

## 功能模块

### 1. 看板视图

**实现方式**：Obsidian 自定义 `ItemView`，注册为 `flowdesk-kanban` 视图类型。

**布局**：
- 水平排列状态列（默认 5 列：收集箱 / 进行中 / 等待中 / 已完成 / 归档）
- 每列内垂直排列任务卡片
- 卡片显示：标题、优先级标记、标签、更新时间

**交互**：
- 拖拽卡片跨列 → 更新文件 `status` 字段
- 点击卡片 → 打开对应的任务 markdown 文件
- 顶部工具栏：筛选（按标签/优先级）、手动新建任务按钮

**数据刷新**：
- 启动时扫描任务目录加载全部任务
- 监听 vault 文件变更事件（`vault.on('modify')`），自动刷新
- 纯事件驱动，不做轮询

### 2. 任务文件管理

**存储路径**：可配置，默认 `FlowDesk/tasks/`

**文件命名**：`<timestamp>-<slug>.md`

**任务文件格式**：

```markdown
---
title: 任务标题
status: 收集箱
priority: normal
tags: [标签1, 标签2]
related:
  - "路径/关联笔记1.md"
  - "路径/关联笔记2.md"
created: 2026-06-25
updated: 2026-06-25
---

## 描述
任务的详细描述

## 备注
额外的备注信息
```

**状态枚举**：`收集箱 | 进行中 | 等待中 | 已完成 | 归档`

**frontmatter 字段**：

| 字段 | 必填 | 类型 | 说明 |
|------|------|------|------|
| title | 是 | string | 任务标题 |
| status | 是 | string | 当前状态（枚举值） |
| priority | 否 | string | `low / normal / high / urgent` |
| tags | 否 | string[] | 标签数组 |
| related | 否 | string[] | 关联笔记路径数组 |
| created | 是 | string | 创建日期 YYYY-MM-DD |
| updated | 是 | string | 最后更新日期 YYYY-MM-DD |

### 3. 命令注册

供用户通过命令面板（Ctrl+P）手动操作：

| 命令 ID | 功能 | 说明 |
|---------|------|------|
| `flowdesk:create-task` | 创建任务 | 弹出模态框输入标题和描述 |
| `flowdesk:update-task` | 更新任务 | 更新当前打开的任务文件 |
| `flowdesk:delete-task` | 删除任务 | 删除当前打开的任务文件 |
| `flowdesk:list-tasks` | 列出任务 | 打开看板视图 |
| `flowdesk:move-task` | 移动状态 | 弹出选择器切换当前任务状态 |

Claudian 不依赖这些命令——直接读写文件即可。命令是给用户的手动操作入口。

### 4. 信息收集（简化版）

**不需要插件 UI**，完全由 Claudian 在对话中完成：

1. 用户粘贴链接给 Claudian
2. Claudian 获取内容并生成摘要
3. Claudian 写入剪藏目录

**摘要笔记格式**：

```markdown
---
title: 文章标题
source: https://原文链接
date: 2026-06-25
tags: [摘要]
---

## 摘要
AI 生成的 2-3 句话总结

## 要点
- 要点 1
- 要点 2
- 要点 3
```

**存储路径**：可配置，默认 `FlowDesk/clippings/YYYY-MM-DD-<slug>.md`

### 5. 设置面板

Obsidian Settings Tab，配置存储在 `.obsidian/plugins/flowdesk/data.json`：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 任务目录 | `FlowDesk/tasks` | 任务文件存储路径 |
| 剪藏目录 | `FlowDesk/clippings` | 摘要笔记存储路径 |
| 看板列配置 | `收集箱, 进行中, 等待中, 已完成, 归档` | 状态列名及顺序 |
| 归档自动隐藏 | `true` | 看板中是否默认折叠归档列 |

## Claudian 工作流程

### 任务创建流程

1. 用户对话中提到可能的任务（如"下周要写一篇关于 RAG 的文章"）
2. Claudian 识别意图，主动提议："要不要创建一个任务？"
3. 用户确认后，Claudian 创建文件到任务目录
4. 插件检测到新文件，看板自动刷新显示新卡片

### 信息收集流程

1. 用户粘贴链接给 Claudian
2. Claudian 获取网页内容，生成摘要
3. Claudian 写入剪藏目录
4. 可选：Claudian 将该笔记路径添加到某任务的 `related` 字段

### 上下文理解流程

1. 用户讨论某个任务时，Claudian 读取任务文件
2. Claudian 同时读取 `related` 中关联的笔记
3. 基于完整上下文进行分析和建议

## 项目结构（独立仓库）

```
flowdesk-obsidian/
├── src/
│   ├── main.ts              # 插件入口
│   ├── views/
│   │   └── kanban-view.ts   # 看板视图
│   ├── services/
│   │   └── task-service.ts  # 任务文件读写
│   ├── commands/
│   │   └── index.ts         # 命令注册
│   ├── settings/
│   │   └── settings-tab.ts  # 设置面板
│   └── types.ts             # 类型定义
├── styles.css               # 插件样式
├── manifest.json            # Obsidian 插件清单
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
└── README.md
```

## 不做的事情

- 不内置 AI 调用，不管理 API Key
- 不做定时抓取或自动化调度
- 不做事件系统（MVP 阶段）
- 不做移动端适配
- 不做 Obsidian 社区插件发布（MVP 仅本地使用）
