import { App, ItemView, Modal, Notice, WorkspaceLeaf } from 'obsidian'
import { Task, TaskStatus, FlowDeskSettings } from '../types'
import { TaskService } from '../services/task-service'

export class KanbanView extends ItemView {
  static VIEW_TYPE = 'flowdesk-kanban'

  private tasks: Task[] = []
  private filterTag = ''
  private filterPriority = ''
  private dragFilePath = ''

  constructor(leaf: WorkspaceLeaf, private taskService: TaskService, private settings: FlowDeskSettings) {
    super(leaf)
  }

  getViewType() { return KanbanView.VIEW_TYPE }
  getDisplayText() { return 'FlowDesk 看板' }

  async onOpen() {
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
    root.addClass('flowdesk-kanban')

    this.renderToolbar(root)
    this.renderColumns(root)
  }

  private renderToolbar(root: HTMLElement) {
    const toolbar = root.createDiv('flowdesk-toolbar')

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

  private renderColumns(root: HTMLElement) {
    const cols = root.createDiv('flowdesk-columns')
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

      filtered.forEach((task) => {
        const card = this.renderCard(task)
        cards.appendChild(card)
      })

      colEl.ondragover = (e) => { e.preventDefault(); colEl.addClass('drag-over') }
      colEl.ondragleave = () => colEl.removeClass('drag-over')
      colEl.ondrop = async (e) => {
        e.preventDefault()
        colEl.removeClass('drag-over')
        if (this.dragFilePath) {
          await this.taskService.updateStatus(this.dragFilePath, col as TaskStatus)
          this.dragFilePath = ''
        }
      }
    }
  }

  private renderCard(task: Task): HTMLElement {
    const card = createDiv({ cls: `flowdesk-card priority-${task.priority}` })
    card.draggable = true
    card.ondragstart = () => { this.dragFilePath = task.filePath }

    card.createDiv({ cls: 'card-title', text: task.title })

    if (task.tags.length) {
      const tagsEl = card.createDiv('card-tags')
      task.tags.forEach((tag) => tagsEl.createSpan({ cls: 'card-tag', text: tag }))
    }

    card.createDiv({ cls: 'card-date', text: task.updated })

    card.onclick = () => {
      const file = this.app.vault.getAbstractFileByPath(task.filePath)
      if (file) this.app.workspace.getLeaf().openFile(file as any)
    }

    return card
  }
}

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
