import { Socket } from 'socket.io'
import { logger } from '../utils/logger'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

const userMessageCounts = new Map<string, { count: number; resetAt: number }>()

const defaultConfig: RateLimitConfig = {
  windowMs: 60000, // 1 minute
  maxRequests: 60 // 60 messages per minute
}

export function checkRateLimit(userId: string, config: RateLimitConfig = defaultConfig): boolean {
  const now = Date.now()
  const userLimit = userMessageCounts.get(userId)

  if (!userLimit || now > userLimit.resetAt) {
    userMessageCounts.set(userId, {
      count: 1,
      resetAt: now + config.windowMs
    })
    return true
  }

  if (userLimit.count >= config.maxRequests) {
    return false
  }

  userLimit.count++
  return true
}

export async function rateLimitMiddleware(socket: Socket, next: (err?: Error) => void) {
  // Initial connection rate limit check
  const userId = socket.handshake.auth.userId || socket.id

  const allowed = checkRateLimit(userId, {
    windowMs: 60000,
    maxRequests: 10 // 10 connections per minute
  })

  if (!allowed) {
    logger.warn(`Rate limit exceeded for user: ${userId}`)
    return next(new Error('Rate limit exceeded'))
  }

  next()
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [userId, data] of userMessageCounts.entries()) {
    if (now > data.resetAt) {
      userMessageCounts.delete(userId)
    }
  }
}, 60000) // Clean up every minute

export class PerUserRateLimiter {
  private limits = new Map<string, Map<string, { count: number; resetAt: number }>>()

  constructor(
    private windowMs: number = 60000,
    private maxRequests: number = 60
  ) {}

  check(userId: string, action: string = 'default'): boolean {
    if (!this.limits.has(userId)) {
      this.limits.set(userId, new Map())
    }

    const userLimits = this.limits.get(userId)!
    const now = Date.now()
    const actionLimit = userLimits.get(action)

    if (!actionLimit || now > actionLimit.resetAt) {
      userLimits.set(action, {
        count: 1,
        resetAt: now + this.windowMs
      })
      return true
    }

    if (actionLimit.count >= this.maxRequests) {
      return false
    }

    actionLimit.count++
    return true
  }

  reset(userId: string, action?: string): void {
    if (action) {
      this.limits.get(userId)?.delete(action)
    } else {
      this.limits.delete(userId)
    }
  }

  cleanup(): void {
    const now = Date.now()
    for (const [userId, userLimits] of this.limits.entries()) {
      for (const [action, data] of userLimits.entries()) {
        if (now > data.resetAt) {
          userLimits.delete(action)
        }
      }
      if (userLimits.size === 0) {
        this.limits.delete(userId)
      }
    }
  }
}

// Global rate limiter instance
export const globalRateLimiter = new PerUserRateLimiter(60000, 60)

// Cleanup every minute
setInterval(() => {
  globalRateLimiter.cleanup()
}, 60000)
