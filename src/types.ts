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
  order: number
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

export interface NavLink {
  title: string
  url: string
  icon?: string
}

export interface NavCategory {
  name: string
  links: NavLink[]
}

export const DEFAULT_NAV: NavCategory[] = [
  {
    name: '常用',
    links: [
      { title: 'Google', url: 'https://www.google.com' },
      { title: 'GitHub', url: 'https://github.com' },
    ],
  },
]
