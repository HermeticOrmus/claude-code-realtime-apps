import Dexie, { Table } from 'dexie'
import type { ChatMessage } from '@realtime-apps/shared'

export interface PendingMessage {
  id?: number
  messageId: string
  roomId: string
  text: string
  timestamp: number
  status: 'pending' | 'sent' | 'failed'
  retryCount: number
  error?: string
}

export interface CachedMessage extends ChatMessage {
  cachedAt: number
}

export interface CachedRoom {
  id: string
  name: string
  lastSync: number
}

export class OfflineDatabase extends Dexie {
  pendingMessages!: Table<PendingMessage, number>
  cachedMessages!: Table<CachedMessage, string>
  cachedRooms!: Table<CachedRoom, string>

  constructor() {
    super('RealtimeOfflineDB')

    this.version(1).stores({
      pendingMessages: '++id, messageId, roomId, timestamp, status',
      cachedMessages: 'id, roomId, timestamp',
      cachedRooms: 'id, lastSync'
    })
  }

  // Pending messages methods
  async addPendingMessage(message: Omit<PendingMessage, 'id'>): Promise<number> {
    return await this.pendingMessages.add(message)
  }

  async getPendingMessages(roomId?: string): Promise<PendingMessage[]> {
    if (roomId) {
      return await this.pendingMessages
        .where('roomId')
        .equals(roomId)
        .and(msg => msg.status === 'pending')
        .toArray()
    }
    return await this.pendingMessages.where('status').equals('pending').toArray()
  }

  async updateMessageStatus(
    messageId: string,
    status: 'sent' | 'failed',
    error?: string
  ): Promise<void> {
    await this.pendingMessages
      .where('messageId')
      .equals(messageId)
      .modify({ status, error })
  }

  async incrementRetryCount(messageId: string): Promise<void> {
    const message = await this.pendingMessages
      .where('messageId')
      .equals(messageId)
      .first()

    if (message) {
      await this.pendingMessages.update(message.id!, {
        retryCount: message.retryCount + 1
      })
    }
  }

  async deletePendingMessage(messageId: string): Promise<void> {
    await this.pendingMessages.where('messageId').equals(messageId).delete()
  }

  async getFailedMessages(): Promise<PendingMessage[]> {
    return await this.pendingMessages.where('status').equals('failed').toArray()
  }

  // Cached messages methods
  async cacheMessage(message: ChatMessage): Promise<void> {
    const cached: CachedMessage = {
      ...message,
      cachedAt: Date.now()
    }
    await this.cachedMessages.put(cached)
  }

  async getCachedMessages(roomId: string, limit: number = 50): Promise<CachedMessage[]> {
    return await this.cachedMessages
      .where('roomId')
      .equals(roomId)
      .reverse()
      .sortBy('timestamp')
      .then(msgs => msgs.slice(0, limit))
  }

  async clearOldCachedMessages(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAge
    await this.cachedMessages.where('cachedAt').below(cutoff).delete()
  }

  // Cached rooms methods
  async cacheRoom(room: CachedRoom): Promise<void> {
    await this.cachedRooms.put(room)
  }

  async getCachedRooms(): Promise<CachedRoom[]> {
    return await this.cachedRooms.toArray()
  }

  async updateRoomSync(roomId: string): Promise<void> {
    await this.cachedRooms.update(roomId, { lastSync: Date.now() })
  }

  // Cleanup
  async cleanup(): Promise<void> {
    // Remove sent messages
    await this.pendingMessages.where('status').equals('sent').delete()

    // Remove old cached messages (older than 7 days)
    await this.clearOldCachedMessages()
  }
}

// Singleton instance
export const db = new OfflineDatabase()
