import { App, parseYaml, stringifyYaml, TFile } from 'obsidian'
import { FlowDeskSettings, Priority, Task, TaskStatus } from '../types'

export class TaskService {
  constructor(private app: App, private settings: FlowDeskSettings) {}

  async loadTasks(): Promise<Task[]> {
    const dir = this.settings.tasksDir
    const files = this.app.vault.getFiles().filter(
      (f) => f.path.startsWith(dir + '/') && f.extension === 'md'
    )
    const tasks: Task[] = []
    for (const file of files) {
      const task = await this.parseTaskFile(file)
      if (task) tasks.push(task)
    }
    return tasks
  }

  async createTask(title: string, description: string, priority: Priority = 'normal'): Promise<Task> {
    const today = this.today()
    const slug = title.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '-').slice(0, 40)
    const filePath = `${this.settings.tasksDir}/${Date.now()}-${slug}.md`
    const fm = { title, status: '收集箱' as TaskStatus, priority, tags: [], related: [], created: today, updated: today }
    await this.ensureDir(this.settings.tasksDir)
    await this.app.vault.create(filePath, `---\n${stringifyYaml(fm)}---\n\n## 描述\n${description}\n\n## 备注\n`)
    return { filePath, ...fm }
  }

  async updateStatus(filePath: string, status: TaskStatus): Promise<void> {
    await this.updateTask(filePath, { status })
  }

  async updateTask(filePath: string, partial: Partial<Task>): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath) as TFile
    const raw = await this.app.vault.read(file)
    const { fm, body } = this.splitFrontmatter(raw)
    const { filePath: _fp, ...rest } = { ...fm, ...partial } as any
    await this.app.vault.modify(file, `---\n${stringifyYaml({ ...rest, updated: this.today() })}---\n${body}`)
  }

  async deleteTask(filePath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath) as TFile
    await this.app.vault.delete(file)
  }

  private async parseTaskFile(file: TFile): Promise<Task | null> {
    try {
      const raw = await this.app.vault.read(file)
      const { fm } = this.splitFrontmatter(raw)
      if (!fm.title || !fm.status) return null
      return {
        filePath: file.path,
        title: fm.title as string,
        status: fm.status as TaskStatus,
        priority: (fm.priority as Priority) ?? 'normal',
        tags: (fm.tags as string[]) ?? [],
        related: (fm.related as string[]) ?? [],
        created: (fm.created as string) ?? '',
        updated: (fm.updated as string) ?? '',
      }
    } catch {
      return null
    }
  }

  private splitFrontmatter(raw: string): { fm: Record<string, unknown>; body: string } {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
    if (!match) return { fm: {}, body: raw }
    return { fm: parseYaml(match[1]) as Record<string, unknown>, body: match[2] }
  }

  private async ensureDir(dir: string): Promise<void> {
    if (!this.app.vault.getAbstractFileByPath(dir)) {
      await this.app.vault.createFolder(dir)
    }
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10)
  }
}
