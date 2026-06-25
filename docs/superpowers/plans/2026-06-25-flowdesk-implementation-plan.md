# FlowDesk 实现计划

Spec: [docs/superpowers/specs/2026-06-25-flowdesk-obsidian-plugin-design.md](../specs/2026-06-25-flowdesk-obsidian-plugin-design.md)

## 并行策略

Phase 1 顺序执行（基础依赖）→ Phase 2 三个 worktree 并行 → Phase 3 合并收尾。

```
Phase 1 (顺序)
  └── git init + 项目脚手架 + types.ts

Phase 2 (并行，3 个 worktree)
  ├── worktree/service   → task-service.ts
  ├── worktree/ui        → kanban-view.ts + styles.css
  └── worktree/plugin    → settings-tab.ts + commands/index.ts

Phase 3 (顺序，合并后)
  └── main.ts 汇总注册 → 验证构建
```

---

## Phase 1 — 基础脚手架

### Step 1.1 — git init

```bash
cd d:\project\FlowDesk
git init
```

### Step 1.2 — package.json

```json
{
  "name": "flowdesk",
  "version": "1.0.0",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "node esbuild.config.mjs production"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "builtin-modules": "^4.0.0",
    "esbuild": "^0.24.0",
    "obsidian": "latest",
    "tslib": "^2.8.0",
    "typescript": "^5.7.0"
  }
}
```

### Step 1.3 — tsconfig.json

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "inlineSourceMap": true,
    "inlineSources": true,
    "module": "ESNext",
    "target": "ES2018",
    "allowImportingTsExtensions": true,
    "moduleResolution": "bundler",
    "importHelpers": true,
    "isolatedModules": true,
    "strictNullChecks": true,
    "lib": ["ES2018", "DOM"]
  },
  "include": ["src/**/*.ts"]
}
```

### Step 1.4 — esbuild.config.mjs

```js
import esbuild from 'esbuild'
import builtins from 'builtin-modules'

const prod = process.argv[2] === 'production'

await esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', ...builtins],
  format: 'cjs',
  target: 'es2018',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
  minify: prod,
})
```

### Step 1.5 — manifest.json

```json
{
  "id": "flowdesk",
  "name": "FlowDesk",
  "version": "1.0.0",
  "minAppVersion": "1.4.0",
  "description": "Kanban task flow manager for Obsidian",
  "author": "FlowDesk",
  "isDesktopOnly": true
}
```

### Step 1.6 — src/types.ts

```typescript
export type TaskStatus = '收集箱' | '进行中' | '等待中' | '已完成' | '归档'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'

export interface Task {
  filePath: string
  title: string
  status: TaskStatus
  priority: Priority
  tags: string[]
  related: string[]
  created: string
  updated: string
}

export interface FlowDeskSettings {
  tasksDir: string
  clippingsDir: string
  columns: string[]
  hideArchive: boolean
}

export const DEFAULT_SETTINGS: FlowDeskSettings = {
  tasksDir: 'FlowDesk/tasks',
  clippingsDir: 'FlowDesk/clippings',
  columns: ['收集箱', '进行中', '等待中', '已完成', '归档'],
  hideArchive: true,
}
```

完成后提交：`git add -A && git commit -m "chore: project scaffold"`

---

## Phase 2 — 并行实现（3 个 worktree）

```bash
git worktree add worktrees/service -b feat/service
git worktree add worktrees/ui -b feat/ui
git worktree add worktrees/plugin -b feat/plugin
```

### Worktree A: `worktrees/service` → feat/service

**文件：** `src/services/task-service.ts`

接口：
```typescript
class TaskService {
  constructor(private app: App, private settings: FlowDeskSettings) {}
  async loadTasks(): Promise<Task[]>
  async createTask(title: string, description: string, priority?: Priority): Promise<Task>
  async updateStatus(filePath: string, status: TaskStatus): Promise<void>
  async updateTask(filePath: string, partial: Partial<Task>): Promise<void>
  async deleteTask(filePath: string): Promise<void>
}
```

实现要点：
- `loadTasks`: `app.vault.getFiles()` 过滤 tasksDir，`app.vault.read()` 读取，`parseYaml` 解析 frontmatter
- frontmatter 分割：按 `---` 边界分割，只替换 frontmatter 块，保留正文
- `createTask`: 文件名 `${Date.now()}-${slugify(title)}.md`，`app.vault.create()`
- `updateStatus`/`updateTask`: 读文件 → 替换 frontmatter → `app.vault.modify()`，更新 `updated` 字段为今日

提交：`git commit -m "feat: task service"`

---

### Worktree B: `worktrees/ui` → feat/ui

**文件：** `src/views/kanban-view.ts` + `styles.css`

`KanbanView extends ItemView`：
```typescript
class KanbanView extends ItemView {
  static VIEW_TYPE = 'flowdesk-kanban'
  private tasks: Task[] = []
  private filterTag = ''
  private filterPriority = ''

  getViewType(): string
  getDisplayText(): string
  async onOpen(): Promise<void>       // 初始加载 + 注册 vault.on('modify')
  async onClose(): Promise<void>      // 取消监听
  private render(): void              // 完整重渲染
  private renderToolbar(container: HTMLElement): void
  private renderColumns(container: HTMLElement): void
  private renderCard(task: Task): HTMLElement
  private attachDragDrop(card: HTMLElement, colEl: HTMLElement, status: TaskStatus): void
}
```

DOM 结构：
```
.flowdesk-kanban
  .flowdesk-toolbar
    select.filter-tag
    select.filter-priority
    button.new-task
  .flowdesk-columns
    .flowdesk-column[data-status="收集箱"]
      .column-header
      .column-cards
        .flowdesk-card[data-filepath="..."]
          .card-priority-bar
          .card-title
          .card-tags
          .card-date
    ...
```

CSS 变量使用：`--background-primary`, `--background-secondary`, `--text-normal`, `--text-muted`, `--interactive-accent`

优先级色：
```css
.priority-urgent { border-left: 3px solid var(--color-red); }
.priority-high   { border-left: 3px solid var(--color-orange); }
.priority-low    { border-left: 3px solid var(--text-muted); }
```

提交：`git commit -m "feat: kanban view + styles"`

---

### Worktree C: `worktrees/plugin` → feat/plugin

**文件：** `src/settings/settings-tab.ts` + `src/commands/index.ts`

**settings-tab.ts** — `PluginSettingTab extends PluginSettingTab`：
- 4 个设置项（文本输入 + toggle）
- `display()` 方法用 `new Setting(containerEl).setName().addText/Toggle()`

**commands/index.ts** — 导出 `registerCommands(plugin, taskService)`：

| 命令 | 实现 |
|------|------|
| `create-task` | `new CreateTaskModal(app, taskService).open()` |
| `update-task` | 读当前活跃文件，`new UpdateTaskModal(app, taskService, filePath).open()` |
| `delete-task` | 确认后调 `taskService.deleteTask(activeFile.path)` |
| `list-tasks` | `workspace.getLeaf().setViewState({ type: VIEW_TYPE })` |
| `move-task` | `new MoveTaskModal(app, taskService, filePath).open()` |

Modal 实现要点（均在同文件）：
- `CreateTaskModal`: 标题输入 + 描述 textarea + 确认按钮
- `MoveTaskModal`: 状态选择 `<select>` + 确认按钮
- `UpdateTaskModal`: 预填当前 frontmatter 字段的表单

提交：`git commit -m "feat: settings tab + commands"`

---

## Phase 3 — 合并与收尾

### Step 3.1 — 合并三个 worktree 分支

```bash
git merge feat/service feat/ui feat/plugin
# 解决冲突（如有）
```

### Step 3.2 — src/main.ts

```typescript
export default class FlowDeskPlugin extends Plugin {
  settings: FlowDeskSettings
  taskService: TaskService

  async onload() {
    await this.loadSettings()
    this.taskService = new TaskService(this.app, this.settings)
    this.registerView(KanbanView.VIEW_TYPE, (leaf) => new KanbanView(leaf, this.taskService))
    this.addSettingTab(new FlowDeskSettingTab(this.app, this))
    registerCommands(this, this.taskService)
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }
}
```

### Step 3.3 — 验证构建

```bash
npm install
npm run build
# 确认 main.js 生成，无 TypeScript 错误
```

### Step 3.4 — .gitignore

```
node_modules/
main.js
*.js.map
worktrees/
```

提交：`git commit -m "feat: wire main entry, verify build"`

---

## 文件清单

| 文件 | Phase | Worktree |
|------|-------|----------|
| `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `manifest.json` | 1 | main |
| `src/types.ts` | 1 | main |
| `src/services/task-service.ts` | 2 | A (feat/service) |
| `src/views/kanban-view.ts` | 2 | B (feat/ui) |
| `styles.css` | 2 | B (feat/ui) |
| `src/settings/settings-tab.ts` | 2 | C (feat/plugin) |
| `src/commands/index.ts` | 2 | C (feat/plugin) |
| `src/main.ts` | 3 | main (after merge) |

## 验收标准

- `npm run build` 无错误，生成 `main.js`
- 所有 TypeScript 类型检查通过
- 看板视图可注册打开
- 5 条命令在命令面板可见
- 设置面板 4 项可配置
