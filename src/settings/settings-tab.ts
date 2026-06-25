import { App, PluginSettingTab, Setting } from 'obsidian'
import type FlowDeskPlugin from '../main'

export class FlowDeskSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: FlowDeskPlugin) {
    super(app, plugin)
  }

  display() {
    const { containerEl } = this
    containerEl.empty()

    new Setting(containerEl)
      .setName('任务目录')
      .setDesc('任务文件存储路径')
      .addText((text) =>
        text
          .setValue(this.plugin.settings.tasksDir)
          .onChange(async (value) => {
            this.plugin.settings.tasksDir = value
            await this.plugin.saveSettings()
          })
      )

    new Setting(containerEl)
      .setName('剪藏目录')
      .setDesc('摘要笔记存储路径')
      .addText((text) =>
        text
          .setValue(this.plugin.settings.clippingsDir)
          .onChange(async (value) => {
            this.plugin.settings.clippingsDir = value
            await this.plugin.saveSettings()
          })
      )

    new Setting(containerEl)
      .setName('看板列配置')
      .setDesc('状态列名及顺序，逗号分隔')
      .addText((text) =>
        text
          .setValue(this.plugin.settings.columns.join(', '))
          .onChange(async (value) => {
            this.plugin.settings.columns = value.split(',').map((s) => s.trim()).filter(Boolean)
            await this.plugin.saveSettings()
          })
      )

    new Setting(containerEl)
      .setName('归档自动隐藏')
      .setDesc('看板中默认折叠归档列')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.hideArchive)
          .onChange(async (value) => {
            this.plugin.settings.hideArchive = value
            await this.plugin.saveSettings()
          })
      )
  }
}
