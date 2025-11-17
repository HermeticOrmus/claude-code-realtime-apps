import { v4 as uuidv4 } from 'uuid'

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
  return `msg-${uuidv4()}`
}

/**
 * Generate a unique room ID
 */
export function generateRoomId(): string {
  return `room-${uuidv4()}`
}

/**
 * Generate a unique user ID
 */
export function generateUserId(): string {
  return `user-${uuidv4()}`
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `session-${uuidv4()}`
}

/**
 * Sanitize text content (basic XSS prevention)
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 5000) // Max 5000 chars
}

/**
 * Format timestamp to ISO string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString()
}

/**
 * Check if timestamp is recent (within last N milliseconds)
 */
export function isRecentTimestamp(timestamp: number, windowMs: number = 5000): boolean {
  return Date.now() - timestamp < windowMs
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0
  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      func(...args)
    }
  }
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

/**
 * Calculate exponential backoff delay
 */
export function exponentialBackoff(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 30000,
  multiplier: number = 1.5
): number {
  return Math.min(baseDelay * Math.pow(multiplier, attempt), maxDelay)
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxAttempts - 1) {
        const delay = exponentialBackoff(attempt, baseDelay)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

/**
 * Generate a hash from a string (simple non-cryptographic)
 */
export function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Create a color from a user ID (for avatars, cursors, etc.)
 */
export function colorFromUserId(userId: string): string {
  const hash = simpleHash(userId)
  const hue = hash % 360
  return `hsl(${hue}, 70%, 60%)`
}
