# CLAUDE.md

## 项目概述

FlowDesk 是 Obsidian 看板任务管理插件，TypeScript + esbuild 构建，无框架依赖。

## 构建

```bash
npm run dev    # 开发（含 sourcemap）
npm run build  # 生产
```

构建输出 `main.js` 到项目根目录。

## 项目结构

```
src/
├── main.ts              # 插件入口，注册视图/命令/设置/Ribbon
├── types.ts             # 类型定义 + 默认值
├── views/
│   └── kanban-view.ts   # 看板+导航 双标签视图
├── services/
│   └── task-service.ts  # 任务文件 CRUD（frontmatter 解析）
├── commands/
│   └── index.ts         # 5 条命令 + Modal
└── settings/
    └── settings-tab.ts  # 设置面板
styles.css               # 全部样式
```

## 关键设计决策

- UI 使用原生 DOM（不引入 React/Preact），通过 Obsidian 的 `createDiv`/`createEl` API
- 数据存储为 vault 内 markdown 文件，frontmatter 格式，用 `parseYaml`/`stringifyYaml` 解析
- 导航页数据存储在 `FlowDesk/nav.json`
- 单向数据流：vault 文件变更 → TaskService.loadTasks() → 视图重渲染
- 不包含 AI 能力，AI 操作通过直接读写 vault 文件完成

## 代码规范

- 不加注释，除非解释非显而易见的 why
- 使用 Obsidian CSS 变量（`--background-primary`、`--interactive-accent` 等）确保主题兼容
- Modal 使用 Obsidian 内置 `Modal` 类
- 命令用 `checkCallback` 模式（需要活跃文件时）

## 部署

将 `main.js`、`manifest.json`、`styles.css` 复制到 vault 的 `.obsidian/plugins/flowdesk/`。

## 测试

当前无自动化测试。验证方式：`npm run build` 无错误 + Obsidian 中手动验证功能。
