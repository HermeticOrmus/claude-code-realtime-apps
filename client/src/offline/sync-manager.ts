import { ResilientWebSocketClient } from '../websocket/resilient-client'
import { db, PendingMessage } from './database'
import type { ChatMessage } from '@realtime-apps/shared'

export interface SyncManagerOptions {
  maxRetries: number
  retryDelay: number
  syncInterval: number
}

export class SyncManager {
  private syncInterval: NodeJS.Timeout | null = null
  private isSyncing = false

  constructor(
    private client: ResilientWebSocketClient,
    private options: SyncManagerOptions = {
      maxRetries: 3,
      retryDelay: 2000,
      syncInterval: 5000
    }
  ) {
    this.setupEventHandlers()
    this.startPeriodicSync()
  }

  private setupEventHandlers(): void {
    // Sync when connection restored
    this.client.on('connect', () => {
      console.log('Connection restored, starting sync...')
      this.syncPendingMessages()
    })

    this.client.on('reconnected', () => {
      console.log('Reconnected, starting sync...')
      this.syncPendingMessages()
    })

    // Listen for message confirmations
    this.client.on('message:confirmed', async (data: { messageId: string }) => {
      await db.updateMessageStatus(data.messageId, 'sent')
    })

    // Listen for message failures
    this.client.on('message:failed', async (data: { messageId: string; error: string }) => {
      await db.updateMessageStatus(data.messageId, 'failed', data.error)
    })

    // Listen for incoming messages to cache them
    this.client.on('message:new', async (message: ChatMessage) => {
      await db.cacheMessage(message)
    })
  }

  private startPeriodicSync(): void {
    this.syncInterval = setInterval(() => {
      if (this.client.connected && navigator.onLine) {
        this.syncPendingMessages()
      }
    }, this.options.syncInterval)
  }

  async sendMessage(roomId: string, text: string): Promise<string> {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const pendingMessage: Omit<PendingMessage, 'id'> = {
      messageId,
      roomId,
      text,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0
    }

    // Store locally first
    await db.addPendingMessage(pendingMessage)

    // Try to send if online
    if (this.client.connected) {
      this.client.emit('message:send', {
        messageId,
        roomId,
        text
      })
    }

    return messageId
  }

  async syncPendingMessages(): Promise<void> {
    if (this.isSyncing || !this.client.connected) {
      return
    }

    this.isSyncing = true

    try {
      const pending = await db.getPendingMessages()

      console.log(`Syncing ${pending.length} pending messages`)

      for (const message of pending) {
        // Skip if max retries exceeded
        if (message.retryCount >= this.options.maxRetries) {
          await db.updateMessageStatus(message.messageId, 'failed', 'Max retries exceeded')
          continue
        }

        try {
          // Increment retry count
          await db.incrementRetryCount(message.messageId)

          // Send message
          this.client.emit('message:send', {
            messageId: message.messageId,
            roomId: message.roomId,
            text: message.text
          })

          // Wait a bit between retries
          if (message.retryCount > 0) {
            await new Promise(resolve => setTimeout(resolve, this.options.retryDelay))
          }
        } catch (error) {
          console.error('Failed to sync message:', error)
        }
      }
    } finally {
      this.isSyncing = false
    }
  }

  async getPendingCount(roomId?: string): Promise<number> {
    const pending = await db.getPendingMessages(roomId)
    return pending.length
  }

  async getFailedMessages(): Promise<PendingMessage[]> {
    return await db.getFailedMessages()
  }

  async retryFailedMessage(messageId: string): Promise<void> {
    await db.pendingMessages
      .where('messageId')
      .equals(messageId)
      .modify({
        status: 'pending',
        retryCount: 0,
        error: undefined
      })

    await this.syncPendingMessages()
  }

  async retryAllFailed(): Promise<void> {
    const failed = await this.getFailedMessages()

    for (const message of failed) {
      await this.retryFailedMessage(message.messageId)
    }
  }

  async clearSentMessages(): Promise<void> {
    await db.pendingMessages.where('status').equals('sent').delete()
  }

  async getCachedMessages(roomId: string, limit: number = 50): Promise<ChatMessage[]> {
    return await db.getCachedMessages(roomId, limit)
  }

  async cleanup(): Promise<void> {
    await db.cleanup()
  }

  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }
}
