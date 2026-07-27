import type { ReactNode } from 'react'
import Header from '../components/Header'

type AppLayoutProps = {
  children: ReactNode
}

function AppLayout({ children }: AppLayoutProps) {
  return (
    <div>
      <Header />
      <main>{children}</main>
    </div>
  )
}

export default AppLayout
