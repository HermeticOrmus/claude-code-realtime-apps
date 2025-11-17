import Redis from 'ioredis'
import { createAdapter } from '@socket.io/redis-adapter'
import { logger } from '../utils/logger'

export async function createRedisAdapter(redisUrl: string) {
  const pubClient = new Redis(redisUrl, {
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000)
      logger.warn(`Redis connection retry attempt ${times}, delay: ${delay}ms`)
      return delay
    },
    maxRetriesPerRequest: 3
  })

  const subClient = pubClient.duplicate()

  pubClient.on('connect', () => {
    logger.info('Redis pub client connected')
  })

  pubClient.on('error', (error) => {
    logger.error('Redis pub client error:', error)
  })

  subClient.on('connect', () => {
    logger.info('Redis sub client connected')
  })

  subClient.on('error', (error) => {
    logger.error('Redis sub client error:', error)
  })

  // Wait for both clients to be ready
  await Promise.all([
    pubClient.ping(),
    subClient.ping()
  ])

  return createAdapter(pubClient, subClient)
}

export class RedisService {
  private client: Redis

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      }
    })

    this.client.on('connect', () => {
      logger.info('Redis service client connected')
    })

    this.client.on('error', (error) => {
      logger.error('Redis service client error:', error)
    })
  }

  // User presence
  async setUserPresence(userId: string, status: string, ttl: number = 300): Promise<void> {
    await this.client.setex(`presence:${userId}`, ttl, status)
  }

  async getUserPresence(userId: string): Promise<string | null> {
    return await this.client.get(`presence:${userId}`)
  }

  async getAllPresence(): Promise<Record<string, string>> {
    const keys = await this.client.keys('presence:*')
    const presence: Record<string, string> = {}

    for (const key of keys) {
      const userId = key.replace('presence:', '')
      const status = await this.client.get(key)
      if (status) {
        presence[userId] = status
      }
    }

    return presence
  }

  // Active rooms
  async addUserToRoom(userId: string, roomId: string): Promise<void> {
    await this.client.sadd(`room:${roomId}:users`, userId)
    await this.client.sadd(`user:${userId}:rooms`, roomId)
  }

  async removeUserFromRoom(userId: string, roomId: string): Promise<void> {
    await this.client.srem(`room:${roomId}:users`, userId)
    await this.client.srem(`user:${userId}:rooms`, roomId)
  }

  async getRoomUsers(roomId: string): Promise<string[]> {
    return await this.client.smembers(`room:${roomId}:users`)
  }

  async getUserRooms(userId: string): Promise<string[]> {
    return await this.client.smembers(`user:${userId}:rooms`)
  }

  // Rate limiting
  async incrementRateLimit(key: string, windowSeconds: number, maxRequests: number): Promise<boolean> {
    const current = await this.client.incr(key)

    if (current === 1) {
      await this.client.expire(key, windowSeconds)
    }

    return current <= maxRequests
  }

  // Message caching (recent messages)
  async cacheMessage(roomId: string, message: any): Promise<void> {
    const key = `messages:${roomId}`
    await this.client.lpush(key, JSON.stringify(message))
    await this.client.ltrim(key, 0, 99) // Keep last 100 messages
    await this.client.expire(key, 3600) // Expire after 1 hour
  }

  async getCachedMessages(roomId: string, limit: number = 50): Promise<any[]> {
    const key = `messages:${roomId}`
    const messages = await this.client.lrange(key, 0, limit - 1)
    return messages.map(msg => JSON.parse(msg))
  }

  // Typing indicators (with TTL)
  async setTyping(roomId: string, userId: string, username: string): Promise<void> {
    const key = `typing:${roomId}`
    await this.client.hset(key, userId, username)
    await this.client.expire(key, 5) // Auto-expire after 5 seconds
  }

  async removeTyping(roomId: string, userId: string): Promise<void> {
    const key = `typing:${roomId}`
    await this.client.hdel(key, userId)
  }

  async getTypingUsers(roomId: string): Promise<Record<string, string>> {
    const key = `typing:${roomId}`
    return await this.client.hgetall(key)
  }

  // Connection tracking
  async trackConnection(userId: string, socketId: string): Promise<void> {
    await this.client.hset(`connections:${userId}`, socketId, Date.now().toString())
  }

  async removeConnection(userId: string, socketId: string): Promise<void> {
    await this.client.hdel(`connections:${userId}`, socketId)
  }

  async getUserConnections(userId: string): Promise<string[]> {
    const connections = await this.client.hkeys(`connections:${userId}`)
    return connections
  }

  // Cleanup
  async cleanup(): Promise<void> {
    await this.client.quit()
  }
}
