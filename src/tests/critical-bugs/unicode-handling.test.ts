import { describe, expect, it } from 'vitest'
import { inputSanitizer } from '../../server/security.js'

describe('unicode and Special Character Handling', () => {
  it('should handle emoji in workflow names', () => {
    const emojiNames = [
      '🚀 Deployment Pipeline',
      'نظام العمل 📊', // Arabic with emoji
      '工作流程 🔧', // Chinese with emoji
      '👨‍👩‍👧‍👦 Family Process', // Multi-codepoint emoji
      'A\u0301\u0302\u0303\u0304', // Combining diacritics
    ]

    emojiNames.forEach((name) => {
      const sanitized = inputSanitizer.sanitizeString(name)
      expect(sanitized).toBeDefined()
      expect(sanitized.length).toBeGreaterThan(0)

      // Check if it survives JSON round-trip
      const json = JSON.stringify({ name: sanitized })
      const parsed = JSON.parse(json)
      expect(parsed.name).toBeDefined()
    })
  })

  it('should handle RTL (Right-to-Left) text', () => {
    const rtlText = 'مرحبا بالعالم' // Arabic: "Hello World"
    const mixed = `Start ${rtlText} End`

    const sanitized = inputSanitizer.sanitizeString(mixed)
    expect(sanitized).toContain('Start')
    expect(sanitized).toContain('End')
  })

  it('should handle zero-width characters and control characters', () => {
    const problematic = [
      'test\u200Bzero\u200Bwidth', // Zero-width space
      'test\uFEFFbom', // Byte order mark
      'test\u202Eltr', // Right-to-left override
      'test\u0000null', // Null character
    ]

    problematic.forEach((text) => {
      const sanitized = inputSanitizer.sanitizeString(text)
      expect(sanitized).not.toContain('\u0000')
      expect(sanitized).not.toContain('\u202E')
      // Should preserve visible text
      expect(sanitized).toContain('test')
    })
  })

  it('should handle very long unicode strings', () => {
    const longUnicode = '你好世界🌏'.repeat(10000) // ~50KB of unicode
    const sanitized = inputSanitizer.sanitizeString(longUnicode, 1000)

    expect(sanitized.length).toBeLessThanOrEqual(1000)
    expect(sanitized).toBeDefined()
  })
})
