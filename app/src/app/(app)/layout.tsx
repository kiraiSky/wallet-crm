import { TopNav } from './_components/TopNav'
import { MobileBottomNav } from './_components/MobileBottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6">
        {children}
      </main>
      <MobileBottomNav />
    </>
  )
}
