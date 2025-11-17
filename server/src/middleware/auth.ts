import { Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { logger } from '../utils/logger'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export interface TokenPayload {
  id: string
  username: string
  email: string
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d'
  })
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload
}

export async function authMiddleware(socket: Socket, next: (err?: Error) => void) {
  try {
    const token = socket.handshake.auth.token

    if (!token) {
      logger.warn('Connection attempt without token')
      return next(new Error('Authentication required'))
    }

    // Verify token
    const payload = verifyToken(token)

    // Attach user data to socket
    socket.data.user = {
      id: payload.id,
      username: payload.username,
      email: payload.email
    }

    logger.info(`Authentication successful for user: ${payload.username}`)
    next()
  } catch (error) {
    logger.error('Authentication failed:', error)
    next(new Error('Authentication failed'))
  }
}

// Demo: Create a test token for development
export function createDemoToken(): string {
  return generateToken({
    id: 'user-demo-123',
    username: 'demo_user',
    email: 'demo@example.com'
  })
}
