export interface UserProfile {
  id: string
  name: string
  email: string
  role: string
}

export interface UserService {
  getUsers(): Promise<UserProfile[]>
  getUser(id: string): Promise<UserProfile | null>
  searchUsers(query: string): Promise<UserProfile[]>
}

export const userService: UserService = {
  async getUsers() {
    return [
      { id: '1', name: 'Alicia Gomez', email: 'alicia@example.com', role: 'Owner' },
      { id: '2', name: 'Noah Chen', email: 'noah@example.com', role: 'Admin' },
      { id: '3', name: 'Mina Patel', email: 'mina@example.com', role: 'User' },
    ]
  },

  async getUser(id: string) {
    return {
      id,
      name: 'Sample user',
      email: 'sample@example.com',
      role: 'User',
    }
  },

  async searchUsers(query: string) {
    const users = await this.getUsers()
    return users.filter((user) =>
      user.name.toLowerCase().includes(query.toLowerCase()) ||
      user.email.toLowerCase().includes(query.toLowerCase()),
    )
  },
}
