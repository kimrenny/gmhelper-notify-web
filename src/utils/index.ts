export const formatAppName = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, '-')

export * from './directMessage'
export * from './template'
export * from './activity'
export * from './automation'
export {
  TRANSACTIONAL_STATUS_LABELS,
  TRANSACTIONAL_STATUS_OPTIONS,
  COMMON_TRANSACTIONAL_TEMPLATES,
  getTransactionalStatusBadgeStyle,
  formatTemplateKey,
} from './transactional'

