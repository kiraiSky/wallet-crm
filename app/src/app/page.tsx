import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { EMPLOYEE_HOME } from '@/lib/access'

export default async function HomePage() {
  const session = await auth()
  redirect(session?.user?.role === 'EMPLOYEE' ? EMPLOYEE_HOME : '/dashboard')
}
