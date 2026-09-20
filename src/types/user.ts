export interface UserSearchResult {
  id: string
  username: string
  email: string
  role: string
  language: string
  isActive: boolean
  isBlocked: boolean
  registrationDate: string
  lastActivityAt?: string | null
}

