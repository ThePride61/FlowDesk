import { Plugin } from 'obsidian'
import { DEFAULT_SETTINGS, FlowDeskSettings } from './types'
import { TaskService } from './services/task-service'
import { KanbanView } from './views/kanban-view'
import { FlowDeskSettingTab } from './settings/settings-tab'
import { registerCommands } from './commands/index'

export default class FlowDeskPlugin extends Plugin {
  settings: FlowDeskSettings
  taskService: TaskService

  async onload() {
    await this.loadSettings()
    this.taskService = new TaskService(this.app, this.settings)
    this.registerView(
      KanbanView.VIEW_TYPE,
      (leaf) => new KanbanView(leaf, this.taskService, this.settings)
    )
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
