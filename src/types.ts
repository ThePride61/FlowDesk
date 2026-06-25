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
