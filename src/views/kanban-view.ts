import { App, ItemView, Menu, Modal, Notice, WorkspaceLeaf } from 'obsidian'
import { Task, TaskStatus, Priority, FlowDeskSettings, NavCategory, NavLink, DEFAULT_NAV } from '../types'
import { TaskService } from '../services/task-service'

type TabId = 'kanban' | 'nav'

export class KanbanView extends ItemView {
  static VIEW_TYPE = 'flowdesk-kanban'

  private tasks: Task[] = []
  private filterTag = ''
  private filterPriority = ''
  private dragFilePath = ''
  private dragSourceStatus = ''
  private activeTab: TabId = 'kanban'
  private navData: NavCategory[] = []
  private editMode = false

  private static PRIORITY_WEIGHT: Record<Priority, number> = {
    urgent: 0, high: 1, normal: 2, low: 3,
  }

  constructor(leaf: WorkspaceLeaf, private taskService: TaskService, private settings: FlowDeskSettings) {
    super(leaf)
  }

  getViewType() { return KanbanView.VIEW_TYPE }
  getDisplayText() { return 'FlowDesk' }

  async onOpen() {
    await this.loadNavData()
    await this.refresh()
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file.path.startsWith(this.settings.tasksDir + '/')) this.refresh()
      })
    )
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file.path.startsWith(this.settings.tasksDir + '/')) this.refresh()
      })
    )
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file.path.startsWith(this.settings.tasksDir + '/')) this.refresh()
      })
    )
  }

  async refresh() {
    this.tasks = await this.taskService.loadTasks()
    this.render()
  }

  private render() {
    const root = this.containerEl.children[1] as HTMLElement
    root.empty()
    root.addClass('flowdesk-root')

    this.renderTabBar(root)

    if (this.activeTab === 'kanban') {
      const kanban = root.createDiv('flowdesk-kanban')
      this.renderToolbar(kanban)
      this.renderColumns(kanban)
    } else {
      this.renderNav(root)
    }
  }

  private renderTabBar(root: HTMLElement) {
    const bar = root.createDiv('flowdesk-tab-bar')
    const tabs: { id: TabId; label: string }[] = [
      { id: 'kanban', label: '看板' },
      { id: 'nav', label: '导航' },
    ]
    tabs.forEach(({ id, label }) => {
      const tab = bar.createEl('button', {
        cls: `flowdesk-tab ${this.activeTab === id ? 'active' : ''}`,
        text: label,
      })
      tab.onclick = () => { this.activeTab = id; this.render() }
    })
  }

  // ==================== 看板 ====================

  private renderToolbar(kanban: HTMLElement) {
    const toolbar = kanban.createDiv('flowdesk-toolbar')

    const allTags = [...new Set(this.tasks.flatMap((t) => t.tags))]
    const tagSelect = toolbar.createEl('select', { cls: 'flowdesk-filter' })
    tagSelect.createEl('option', { value: '', text: '全部标签' })
    allTags.forEach((tag) => tagSelect.createEl('option', { value: tag, text: tag }))
    tagSelect.value = this.filterTag
    tagSelect.onchange = () => { this.filterTag = tagSelect.value; this.render() }

    const priSelect = toolbar.createEl('select', { cls: 'flowdesk-filter' })
    priSelect.createEl('option', { value: '', text: '全部优先级' })
    ;(['urgent', 'high', 'normal', 'low'] as const).forEach((p) =>
      priSelect.createEl('option', { value: p, text: p })
    )
    priSelect.value = this.filterPriority
    priSelect.onchange = () => { this.filterPriority = priSelect.value; this.render() }

    const btn = toolbar.createEl('button', { cls: 'flowdesk-new-btn', text: '+ 新建任务' })
    btn.onclick = () => new CreateTaskModal(this.app, this.taskService).open()
  }

  private renderColumns(kanban: HTMLElement) {
    const cols = kanban.createDiv('flowdesk-columns')
    const columns = this.settings.hideArchive
      ? this.settings.columns.filter((c) => c !== '归档')
      : this.settings.columns

    for (const col of columns) {
      const colEl = cols.createDiv('flowdesk-column')
      colEl.createDiv({ cls: 'column-header', text: col })
      const cards = colEl.createDiv('column-cards')

      const filtered = this.tasks.filter(
        (t) =>
          t.status === (col as TaskStatus) &&
          (!this.filterTag || t.tags.includes(this.filterTag)) &&
          (!this.filterPriority || t.priority === this.filterPriority)
      )

      filtered.sort((a, b) => {
        const pw = KanbanView.PRIORITY_WEIGHT[a.priority] - KanbanView.PRIORITY_WEIGHT[b.priority]
        if (pw !== 0) return pw
        return a.order - b.order
      })

      filtered.forEach((task) => {
        const card = this.renderCard(task)
        card.dataset.filepath = task.filePath
        cards.appendChild(card)
      })

      cards.ondragover = (e) => {
        e.preventDefault()
        this.clearDropIndicators(cards)
        const target = this.getCardAtPoint(cards, e.clientY)
        if (target) {
          const rect = target.getBoundingClientRect()
          const isAbove = e.clientY < rect.top + rect.height / 2
          target.addClass(isAbove ? 'card-drop-before' : 'card-drop-after')
        }
        colEl.addClass('drag-over')
      }

      cards.ondragleave = (e) => {
        if (!cards.contains(e.relatedTarget as Node)) {
          this.clearDropIndicators(cards)
          colEl.removeClass('drag-over')
        }
      }

      colEl.ondragover = (e) => { e.preventDefault() }
      colEl.ondragleave = () => colEl.removeClass('drag-over')

      colEl.ondrop = async (e) => {
        e.preventDefault()
        colEl.removeClass('drag-over')
        this.clearDropIndicators(cards)
        if (!this.dragFilePath) return

        const targetStatus = col as TaskStatus
        const isSameColumn = this.dragSourceStatus === targetStatus

        const target = this.getCardAtPoint(cards, e.clientY)
        const insertIdx = this.getInsertIndex(cards, target, e.clientY)

        if (!isSameColumn) {
          await this.taskService.updateStatus(this.dragFilePath, targetStatus)
        }

        const ordered = this.tasks
          .filter((t) => t.status === targetStatus && t.filePath !== this.dragFilePath)
          .sort((a, b) => {
            const pw = KanbanView.PRIORITY_WEIGHT[a.priority] - KanbanView.PRIORITY_WEIGHT[b.priority]
            if (pw !== 0) return pw
            return a.order - b.order
          })

        const paths = ordered.map((t) => t.filePath)
        paths.splice(insertIdx, 0, this.dragFilePath)
        await this.taskService.reorderTasks(paths)

        this.dragFilePath = ''
        this.dragSourceStatus = ''
      }
    }
  }

  private getCardAtPoint(container: HTMLElement, y: number): HTMLElement | null {
    const cards = Array.from(container.querySelectorAll('.flowdesk-card')) as HTMLElement[]
    for (const card of cards) {
      const rect = card.getBoundingClientRect()
      if (y >= rect.top && y <= rect.bottom) return card
    }
    return null
  }

  private getInsertIndex(container: HTMLElement, target: HTMLElement | null, y: number): number {
    const cards = Array.from(container.querySelectorAll('.flowdesk-card')) as HTMLElement[]
    if (!target) return cards.length
    const idx = cards.indexOf(target)
    const rect = target.getBoundingClientRect()
    return y < rect.top + rect.height / 2 ? idx : idx + 1
  }

  private clearDropIndicators(container: HTMLElement) {
    container.querySelectorAll('.card-drop-before, .card-drop-after').forEach((el) => {
      el.removeClass('card-drop-before')
      el.removeClass('card-drop-after')
    })
  }

  private renderCard(task: Task): HTMLElement {
    const card = createDiv({ cls: `flowdesk-card priority-${task.priority}` })
    card.draggable = true
    card.ondragstart = () => { this.dragFilePath = task.filePath; this.dragSourceStatus = task.status }

    card.createDiv({ cls: 'card-title', text: task.title })

    if (task.tags.length) {
      const tagsEl = card.createDiv('card-tags')
      task.tags.forEach((tag) => tagsEl.createSpan({ cls: 'card-tag', text: tag }))
    }

    card.createDiv({ cls: 'card-date', text: task.updated })

    card.oncontextmenu = (e) => {
      e.preventDefault()
      const menu = new Menu()
      const priorities: { value: Priority; label: string }[] = [
        { value: 'urgent', label: '紧急' },
        { value: 'high', label: '高' },
        { value: 'normal', label: '普通' },
        { value: 'low', label: '低' },
      ]
      priorities.forEach(({ value, label }) => {
        menu.addItem((item) =>
          item
            .setTitle(`${task.priority === value ? '✓ ' : ''}${label}`)
            .onClick(async () => {
              await this.taskService.updateTask(task.filePath, { priority: value })
            })
        )
      })
      menu.showAtMouseEvent(e)
    }

    card.onclick = () => {
      const file = this.app.vault.getAbstractFileByPath(task.filePath)
      if (file) this.app.workspace.getLeaf().openFile(file as any)
    }

    return card
  }

  // ==================== 导航 ====================

  private renderNav(root: HTMLElement) {
    const nav = root.createDiv('flowdesk-nav')

    const toolbar = nav.createDiv('flowdesk-nav-toolbar')
    const editBtn = toolbar.createEl('button', {
      cls: `flowdesk-nav-edit-btn ${this.editMode ? 'active' : ''}`,
      text: this.editMode ? '完成' : '编辑',
    })
    editBtn.onclick = () => { this.editMode = !this.editMode; this.render() }

    if (this.editMode) {
      const addCatBtn = toolbar.createEl('button', { cls: 'flowdesk-new-btn', text: '+ 新分类' })
      addCatBtn.onclick = () => {
        new AddCategoryModal(this.app, (name) => {
          this.navData.push({ name, links: [] })
          this.saveNavData()
          this.render()
        }).open()
      }
    }

    const grid = nav.createDiv('flowdesk-nav-grid')
    this.navData.forEach((cat, catIdx) => {
      const section = grid.createDiv('flowdesk-nav-section')

      const header = section.createDiv('flowdesk-nav-section-header')
      header.createSpan({ text: cat.name, cls: 'section-title' })

      if (this.editMode) {
        const addBtn = header.createEl('button', { cls: 'flowdesk-nav-add-link', text: '+' })
        addBtn.onclick = () => {
          new AddLinkModal(this.app, (link) => {
            cat.links.push(link)
            this.saveNavData()
            this.render()
          }).open()
        }
        const delBtn = header.createEl('button', { cls: 'flowdesk-nav-del-cat', text: '×' })
        delBtn.onclick = () => {
          this.navData.splice(catIdx, 1)
          this.saveNavData()
          this.render()
        }
      }

      const linksGrid = section.createDiv('flowdesk-nav-links')
      cat.links.forEach((link, linkIdx) => {
        const el = linksGrid.createDiv('flowdesk-nav-link')
        const icon = el.createSpan({ cls: 'nav-link-icon', text: link.icon || '🔗' })
        el.createSpan({ cls: 'nav-link-title', text: link.title })

        if (this.editMode) {
          const delLink = el.createEl('button', { cls: 'nav-link-del', text: '×' })
          delLink.onclick = (e) => {
            e.stopPropagation()
            cat.links.splice(linkIdx, 1)
            this.saveNavData()
            this.render()
          }
        } else {
          el.onclick = () => window.open(link.url, '_blank')
        }
      })
    })
  }

  private get navPath(): string {
    const parts = this.settings.tasksDir.split('/')
    parts.pop()
    return parts.concat('nav.json').join('/')
  }

  private async loadNavData() {
    const file = this.app.vault.getAbstractFileByPath(this.navPath)
    if (file) {
      try {
        const raw = await this.app.vault.read(file as any)
        this.navData = JSON.parse(raw)
      } catch {
        this.navData = [...DEFAULT_NAV]
      }
    } else {
      this.navData = [...DEFAULT_NAV]
    }
  }

  private async saveNavData() {
    const content = JSON.stringify(this.navData, null, 2)
    const file = this.app.vault.getAbstractFileByPath(this.navPath)
    if (file) {
      await this.app.vault.modify(file as any, content)
    } else {
      await this.app.vault.create(this.navPath, content)
    }
  }
}

// ==================== Modals ====================

class CreateTaskModal extends Modal {
  constructor(app: App, private taskService: TaskService) {
    super(app)
  }

  onOpen() {
    const { contentEl } = this
    contentEl.createEl('h3', { text: '新建任务' })
    const titleInput = contentEl.createEl('input', { type: 'text', placeholder: '任务标题', cls: 'flowdesk-input' })
    const descInput = contentEl.createEl('textarea', { placeholder: '描述（可选）', cls: 'flowdesk-textarea' })
    const btn = contentEl.createEl('button', { text: '创建', cls: 'mod-cta' })
    btn.onclick = async () => {
      const title = titleInput.value.trim()
      if (!title) return
      await this.taskService.createTask(title, descInput.value.trim())
      this.close()
    }
  }

  onClose() { this.contentEl.empty() }
}

class AddCategoryModal extends Modal {
  constructor(app: App, private onSubmit: (name: string) => void) {
    super(app)
  }

  onOpen() {
    const { contentEl } = this
    contentEl.createEl('h3', { text: '新建分类' })
    const input = contentEl.createEl('input', { type: 'text', placeholder: '分类名称', cls: 'flowdesk-input' })
    const btn = contentEl.createEl('button', { text: '添加', cls: 'mod-cta' })
    btn.onclick = () => {
      const name = input.value.trim()
      if (!name) return
      this.onSubmit(name)
      this.close()
    }
  }

  onClose() { this.contentEl.empty() }
}

class AddLinkModal extends Modal {
  constructor(app: App, private onSubmit: (link: NavLink) => void) {
    super(app)
  }

  onOpen() {
    const { contentEl } = this
    contentEl.createEl('h3', { text: '添加链接' })
    const titleInput = contentEl.createEl('input', { type: 'text', placeholder: '标题', cls: 'flowdesk-input' })
    const urlInput = contentEl.createEl('input', { type: 'text', placeholder: 'https://...', cls: 'flowdesk-input' })
    const iconInput = contentEl.createEl('input', { type: 'text', placeholder: '图标 emoji（可选）', cls: 'flowdesk-input' })
    const btn = contentEl.createEl('button', { text: '添加', cls: 'mod-cta' })
    btn.onclick = () => {
      const title = titleInput.value.trim()
      const url = urlInput.value.trim()
      if (!title || !url) return
      this.onSubmit({ title, url, icon: iconInput.value.trim() || undefined })
      this.close()
    }
  }

  onClose() { this.contentEl.empty() }
}
