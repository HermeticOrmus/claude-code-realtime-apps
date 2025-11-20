/**
 * Emoji Validation Utility
 *
 * Validates that reactions contain only valid emojis to prevent injection attacks
 * and ensure consistent reaction display across platforms.
 */

// Comprehensive emoji regex that matches most Unicode emoji characters
// Includes:
// - Basic emojis (😀-🙏)
// - Supplementary emojis (🚀-🛿)
// - Extended emojis with skin tone modifiers
// - Zero-width joiners and variation selectors
const EMOJI_REGEX = /^(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32-\ude3a]|[\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])+$/u

// Whitelist of commonly used reactions
// This provides a more restrictive option if needed
const COMMON_REACTIONS = new Set([
  '👍', '👎', '❤️', '😂', '😮', '😢', '😡', '🔥', '⭐', '✅',
  '❌', '🎉', '👏', '🙌', '💯', '🚀', '💪', '🤝', '👀', '💡',
  '🎯', '⚡', '💚', '💙', '💜', '🧡', '💛', '🖤', '🤍', '🤎'
])

export interface EmojiValidationOptions {
  /** Use strict whitelist of common reactions only */
  useWhitelist?: boolean
  /** Maximum length of emoji string (to prevent very long sequences) */
  maxLength?: number
  /** Allow multiple consecutive emojis */
  allowMultiple?: boolean
}

export class EmojiValidator {
  private options: Required<EmojiValidationOptions>

  constructor(options: EmojiValidationOptions = {}) {
    this.options = {
      useWhitelist: options.useWhitelist ?? false,
      maxLength: options.maxLength ?? 20, // Prevents abuse with very long emoji sequences
      allowMultiple: options.allowMultiple ?? false
    }
  }

  /**
   * Validates if a string is a valid emoji
   *
   * @param emoji - The string to validate
   * @returns true if valid, false otherwise
   */
  isValid(emoji: string): boolean {
    // Check null/undefined
    if (!emoji || typeof emoji !== 'string') {
      return false
    }

    // Check length
    if (emoji.length > this.options.maxLength) {
      return false
    }

    // Trim whitespace
    const trimmed = emoji.trim()
    if (trimmed.length === 0) {
      return false
    }

    // Check against whitelist if enabled
    if (this.options.useWhitelist) {
      return COMMON_REACTIONS.has(trimmed)
    }

    // Check if multiple emojis are allowed
    if (!this.options.allowMultiple) {
      // Count emoji characters
      const emojiCount = (trimmed.match(EMOJI_REGEX) || []).length
      if (emojiCount !== 1) {
        return false
      }
    }

    // Validate against regex
    return EMOJI_REGEX.test(trimmed)
  }

  /**
   * Sanitizes an emoji string by removing invalid characters
   * Returns null if no valid emoji found
   *
   * @param emoji - The string to sanitize
   * @returns Sanitized emoji or null
   */
  sanitize(emoji: string): string | null {
    if (!emoji || typeof emoji !== 'string') {
      return null
    }

    const trimmed = emoji.trim()

    // If using whitelist, only return if it's in the set
    if (this.options.useWhitelist) {
      return COMMON_REACTIONS.has(trimmed) ? trimmed : null
    }

    // Extract first valid emoji
    const matches = trimmed.match(EMOJI_REGEX)
    if (!matches || matches.length === 0) {
      return null
    }

    const sanitized = this.options.allowMultiple ? matches.join('') : matches[0]

    return sanitized.length <= this.options.maxLength ? sanitized : null
  }

  /**
   * Checks if a string contains only emojis (no other text)
   *
   * @param str - The string to check
   * @returns true if contains only emojis
   */
  isOnlyEmojis(str: string): boolean {
    if (!str || typeof str !== 'string') {
      return false
    }

    const trimmed = str.trim()
    const withoutEmojis = trimmed.replace(EMOJI_REGEX, '')

    return withoutEmojis.length === 0 && trimmed.length > 0
  }

  /**
   * Counts the number of emojis in a string
   *
   * @param str - The string to count emojis in
   * @returns Number of emojis found
   */
  countEmojis(str: string): number {
    if (!str || typeof str !== 'string') {
      return 0
    }

    const matches = str.match(EMOJI_REGEX)
    return matches ? matches.length : 0
  }
}

// Default validator instance
export const defaultEmojiValidator = new EmojiValidator({
  useWhitelist: false,
  maxLength: 10,
  allowMultiple: false
})

// Strict validator instance (whitelist only)
export const strictEmojiValidator = new EmojiValidator({
  useWhitelist: true,
  maxLength: 10,
  allowMultiple: false
})

/**
 * Quick validation function for convenience
 *
 * @param emoji - The emoji string to validate
 * @returns true if valid
 */
export function isValidEmoji(emoji: string): boolean {
  return defaultEmojiValidator.isValid(emoji)
}

/**
 * Quick sanitization function for convenience
 *
 * @param emoji - The emoji string to sanitize
 * @returns Sanitized emoji or null
 */
export function sanitizeEmoji(emoji: string): string | null {
  return defaultEmojiValidator.sanitize(emoji)
}
