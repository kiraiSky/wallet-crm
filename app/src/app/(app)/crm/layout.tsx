import { CrmSubNav } from './_components/CrmSubNav'

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CrmSubNav />
      {children}
    </>
  )
}
