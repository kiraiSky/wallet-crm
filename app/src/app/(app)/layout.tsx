import { TopNav } from './_components/TopNav'
import { MobileBottomNav } from './_components/MobileBottomNav'
import { getCurrentUser } from '@/lib/current-user'

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  return (
    <>
      <TopNav
        userName={user.nome}
        userInitials={initialsOf(user.nome)}
        userRole={user.role}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6">
        {children}
      </main>
      <MobileBottomNav />
    </>
  )
}
