import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'

function key() {
  const secret = process.env.MOLONI_TOKEN_ENCRYPTION_KEY || process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('MOLONI_TOKEN_ENCRYPTION_KEY ou AUTH_SECRET precisa estar definido')
  }
  return createHash('sha256').update(secret).digest()
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.')
}

export function decryptSecret(payload: string) {
  const [ivRaw, tagRaw, encryptedRaw] = payload.split('.')
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('Segredo cifrado inválido')
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivRaw, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
