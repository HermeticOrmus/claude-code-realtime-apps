/**
 * Input Validation and Sanitization Utilities
 *
 * Provides comprehensive input validation to prevent injection attacks,
 * buffer overflows, and other security vulnerabilities.
 */

import sanitizeHtml from 'sanitize-html'

export interface ValidationResult {
  isValid: boolean
  sanitized?: string
  error?: string
}

export interface InputLimits {
  maxLength: number
  minLength?: number
  allowEmpty?: boolean
}

export class InputValidator {
  /**
   * Validates and sanitizes text input
   *
   * @param input - The text to validate
   * @param limits - Size limits for the input
   * @returns Validation result with sanitized text
   */
  static validateText(input: unknown, limits: InputLimits = { maxLength: 5000 }): ValidationResult {
    // Type check
    if (typeof input !== 'string') {
      return {
        isValid: false,
        error: 'Input must be a string'
      }
    }

    // Empty check
    if (!limits.allowEmpty && input.trim().length === 0) {
      return {
        isValid: false,
        error: 'Input cannot be empty'
      }
    }

    // Length checks
    if (limits.minLength && input.length < limits.minLength) {
      return {
        isValid: false,
        error: `Input must be at least ${limits.minLength} characters`
      }
    }

    if (input.length > limits.maxLength) {
      return {
        isValid: false,
        error: `Input must not exceed ${limits.maxLength} characters`
      }
    }

    // Sanitize HTML
    const sanitized = sanitizeHtml(input, {
      allowedTags: [],
      allowedAttributes: {},
      disallowedTagsMode: 'recursiveEscape'
    })

    // Check for control characters (except newlines and tabs)
    const hasInvalidChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(sanitized)
    if (hasInvalidChars) {
      return {
        isValid: false,
        error: 'Input contains invalid control characters'
      }
    }

    return {
      isValid: true,
      sanitized
    }
  }

  /**
   * Validates room ID format
   *
   * @param roomId - The room ID to validate
   * @returns Validation result
   */
  static validateRoomId(roomId: unknown): ValidationResult {
    if (typeof roomId !== 'string') {
      return {
        isValid: false,
        error: 'Room ID must be a string'
      }
    }

    // UUID v4 format or alphanumeric with hyphens
    const validFormat = /^[a-zA-Z0-9-]{1,64}$/.test(roomId)

    if (!validFormat) {
      return {
        isValid: false,
        error: 'Invalid room ID format'
      }
    }

    return {
      isValid: true,
      sanitized: roomId
    }
  }

  /**
   * Validates user ID format
   *
   * @param userId - The user ID to validate
   * @returns Validation result
   */
  static validateUserId(userId: unknown): ValidationResult {
    if (typeof userId !== 'string') {
      return {
        isValid: false,
        error: 'User ID must be a string'
      }
    }

    const validFormat = /^[a-zA-Z0-9-_]{1,64}$/.test(userId)

    if (!validFormat) {
      return {
        isValid: false,
        error: 'Invalid user ID format'
      }
    }

    return {
      isValid: true,
      sanitized: userId
    }
  }

  /**
   * Validates username
   *
   * @param username - The username to validate
   * @returns Validation result
   */
  static validateUsername(username: unknown): ValidationResult {
    if (typeof username !== 'string') {
      return {
        isValid: false,
        error: 'Username must be a string'
      }
    }

    // Length check
    if (username.length < 3 || username.length > 32) {
      return {
        isValid: false,
        error: 'Username must be between 3 and 32 characters'
      }
    }

    // Format check: alphanumeric, underscore, hyphen
    const validFormat = /^[a-zA-Z0-9_-]+$/.test(username)

    if (!validFormat) {
      return {
        isValid: false,
        error: 'Username can only contain letters, numbers, underscores, and hyphens'
      }
    }

    // Prevent reserved names
    const reserved = ['admin', 'system', 'bot', 'moderator', 'support']
    if (reserved.includes(username.toLowerCase())) {
      return {
        isValid: false,
        error: 'This username is reserved'
      }
    }

    return {
      isValid: true,
      sanitized: username
    }
  }

  /**
   * Validates file attachment metadata
   *
   * @param attachment - The attachment object to validate
   * @returns Validation result
   */
  static validateAttachment(attachment: unknown): ValidationResult {
    if (typeof attachment !== 'object' || attachment === null) {
      return {
        isValid: false,
        error: 'Attachment must be an object'
      }
    }

    const att = attachment as any

    // Check required fields
    if (!att.type || !att.url || typeof att.size !== 'number') {
      return {
        isValid: false,
        error: 'Attachment missing required fields: type, url, size'
      }
    }

    // Validate type
    const validTypes = ['image', 'file', 'video', 'audio']
    if (!validTypes.includes(att.type)) {
      return {
        isValid: false,
        error: 'Invalid attachment type'
      }
    }

    // Validate URL format (basic check)
    try {
      new URL(att.url)
    } catch {
      return {
        isValid: false,
        error: 'Invalid attachment URL'
      }
    }

    // Validate size (10MB max)
    const MAX_SIZE = 10 * 1024 * 1024
    if (att.size > MAX_SIZE) {
      return {
        isValid: false,
        error: 'Attachment too large (max 10MB)'
      }
    }

    if (att.size < 0) {
      return {
        isValid: false,
        error: 'Invalid attachment size'
      }
    }

    return {
      isValid: true,
      sanitized: {
        type: att.type,
        url: att.url,
        size: att.size,
        name: att.name || 'untitled'
      }
    }
  }

  /**
   * Validates array input
   *
   * @param input - The array to validate
   * @param maxLength - Maximum array length
   * @returns Validation result
   */
  static validateArray(input: unknown, maxLength: number = 100): ValidationResult {
    if (!Array.isArray(input)) {
      return {
        isValid: false,
        error: 'Input must be an array'
      }
    }

    if (input.length > maxLength) {
      return {
        isValid: false,
        error: `Array must not exceed ${maxLength} items`
      }
    }

    return {
      isValid: true
    }
  }

  /**
   * Validates timestamp
   *
   * @param timestamp - The timestamp to validate
   * @returns Validation result
   */
  static validateTimestamp(timestamp: unknown): ValidationResult {
    if (typeof timestamp !== 'number') {
      return {
        isValid: false,
        error: 'Timestamp must be a number'
      }
    }

    // Check if it's a reasonable timestamp (between 2020 and 2100)
    const MIN_TIMESTAMP = 1577836800000 // 2020-01-01
    const MAX_TIMESTAMP = 4102444800000 // 2100-01-01

    if (timestamp < MIN_TIMESTAMP || timestamp > MAX_TIMESTAMP) {
      return {
        isValid: false,
        error: 'Invalid timestamp value'
      }
    }

    return {
      isValid: true,
      sanitized: timestamp
    }
  }

  /**
   * Detects potential SQL injection patterns
   *
   * @param input - The string to check
   * @returns true if SQL injection detected
   */
  static hasSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
      /(--|\/\*|\*\/|;|'|")/,
      /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/i,
      /\bUNION\b.*\bSELECT\b/i
    ]

    return sqlPatterns.some(pattern => pattern.test(input))
  }

  /**
   * Detects potential XSS patterns
   *
   * @param input - The string to check
   * @returns true if XSS detected
   */
  static hasXSS(input: string): boolean {
    const xssPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/i,
      /<iframe/i,
      /javascript:/i,
      /on\w+\s*=/i, // Event handlers like onclick=
      /<img[^>]+src[\s\S]*?>/i
    ]

    return xssPatterns.some(pattern => pattern.test(input))
  }

  /**
   * Detects potential NoSQL injection patterns
   *
   * @param input - The value to check
   * @returns true if NoSQL injection detected
   */
  static hasNoSQLInjection(input: any): boolean {
    // Check for MongoDB operators
    if (typeof input === 'object' && input !== null) {
      const keys = Object.keys(input)
      const mongoOperators = ['$gt', '$gte', '$lt', '$lte', '$ne', '$in', '$nin', '$regex', '$where']
      return keys.some(key => mongoOperators.includes(key))
    }

    return false
  }
}

/**
 * Validates multiple inputs in batch
 *
 * @param validations - Map of field names to validation functions
 * @returns Object with validation results
 */
export function validateBatch(
  validations: Record<string, () => ValidationResult>
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  for (const [field, validate] of Object.entries(validations)) {
    const result = validate()
    if (!result.isValid && result.error) {
      errors[field] = result.error
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}
