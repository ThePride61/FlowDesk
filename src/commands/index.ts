import { App, Modal, Notice, Plugin } from 'obsidian'
import { TaskService } from '../services/task-service'
import { TaskStatus } from '../types'
import { KanbanView } from '../views/kanban-view'

export function registerCommands(plugin: Plugin, taskService: TaskService) {
  plugin.addCommand({
    id: 'create-task',
    name: '创建任务',
    callback: () => new CreateTaskModal(plugin.app, taskService).open(),
  })

  plugin.addCommand({
    id: 'list-tasks',
    name: '列出任务（打开看板）',
    callback: () => {
      plugin.app.workspace.getLeaf().setViewState({ type: KanbanView.VIEW_TYPE, active: true })
    },
  })

  plugin.addCommand({
    id: 'move-task',
    name: '移动任务状态',
    checkCallback: (checking) => {
      const file = plugin.app.workspace.getActiveFile()
      if (!file) return false
      if (!checking) new MoveTaskModal(plugin.app, taskService, file.path).open()
      return true
    },
  })

  plugin.addCommand({
    id: 'delete-task',
    name: '删除任务',
    checkCallback: (checking) => {
      const file = plugin.app.workspace.getActiveFile()
      if (!file) return false
      if (!checking) {
        taskService.deleteTask(file.path).then(() => new Notice('任务已删除'))
      }
      return true
    },
  })
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

class MoveTaskModal extends Modal {
  constructor(app: App, private taskService: TaskService, private filePath: string) {
    super(app)
  }

  onOpen() {
    const { contentEl } = this
    contentEl.createEl('h3', { text: '移动到状态' })
    const select = contentEl.createEl('select', { cls: 'flowdesk-filter' })
    const statuses: TaskStatus[] = ['收集箱', '进行中', '等待中', '已完成', '归档']
    statuses.forEach((s) => select.createEl('option', { value: s, text: s }))
    const btn = contentEl.createEl('button', { text: '确认', cls: 'mod-cta' })
    btn.onclick = async () => {
      await this.taskService.updateStatus(this.filePath, select.value as TaskStatus)
      new Notice(`已移动到：${select.value}`)
      this.close()
    }
  }

  onClose() { this.contentEl.empty() }
}
