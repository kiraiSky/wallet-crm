import NextAuth, { type DefaultSession } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      nome: string
      role: 'OWNER' | 'EMPLOYEE'
    } & DefaultSession['user']
  }
  interface User {
    id?: string
    nome: string
    role: 'OWNER' | 'EMPLOYEE'
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    nome: string
    role: 'OWNER' | 'EMPLOYEE'
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: {},
        senha: {},
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? '').toLowerCase().trim()
        const senha = String(credentials?.senha ?? '')
        if (!email || !senha) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !user.active) return null

        const ok = await bcrypt.compare(senha, user.senha)
        if (!ok) return null

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          nome: user.nome,
          name: user.nome,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.nome = user.nome
        token.role = user.role
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id
      session.user.nome = token.nome
      session.user.role = token.role
      return session
    },
  },
})
