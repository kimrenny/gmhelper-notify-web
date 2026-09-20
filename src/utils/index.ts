export const formatAppName = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, '-')

export * from './directMessage'
export * from './template'
export * from './activity'
export * from './automation'

