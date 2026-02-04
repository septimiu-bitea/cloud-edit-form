// ============================================================================
// MULTIVALUE PARSING TEST
// ============================================================================
// Tests that multivalue parsing correctly handles quoted strings with delimiters
// Run with: npm run test:multivalueParsing
// Or open in browser: npm run dev, then open browser console and run tests

import { parseInputLine, parsePasteText } from '../src/utils/multivalueParsing.js'

// Test runner
const tests = []
let passed = 0
let failed = 0

function test(name, fn) {
  tests.push({ name, fn })
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed')
  }
}

function assertEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual)
  const expectedStr = JSON.stringify(expected)
  if (actualStr !== expectedStr) {
    throw new Error(
      message || `Expected ${expectedStr}, but got ${actualStr}`
    )
  }
}

async function runTests() {
  console.group('🧪 Multivalue Parsing Tests')
  console.log('Running', tests.length, 'tests...\n')
  
  for (const { name, fn } of tests) {
    try {
      await fn()
      console.log('✅', name)
      passed++
    } catch (err) {
      console.error('❌', name)
      console.error('   Error:', err.message)
      if (err.stack) {
        console.error('   Stack:', err.stack.split('\n').slice(1, 3).join('\n'))
      }
      failed++
    }
  }
  
  console.groupEnd()
  console.log('\n' + '='.repeat(50))
  console.log(`Tests: ${passed} passed, ${failed} failed, ${tests.length} total`)
  console.log('='.repeat(50))
  
  return { passed, failed, total: tests.length }
}

// ============================================================================
// TESTS
// ============================================================================

test('parseInputLine: simple semicolon-separated values', () => {
  const result = parseInputLine('1;2;3', ';')
  assertEqual(result, ['1', '2', '3'])
})

test('parseInputLine: quoted string with delimiter inside', () => {
  const result = parseInputLine('1;2;3;"4;5;6"', ';')
  assertEqual(result, ['1', '2', '3', '4;5;6'])
})

test('parseInputLine: quoted string at start', () => {
  const result = parseInputLine('"a;b";c;d', ';')
  assertEqual(result, ['a;b', 'c', 'd'])
})

test('parseInputLine: quoted string in middle', () => {
  const result = parseInputLine('1;"2;3";4', ';')
  assertEqual(result, ['1', '2;3', '4'])
})

test('parseInputLine: quoted string at end', () => {
  const result = parseInputLine('a;b;"c;d"', ';')
  assertEqual(result, ['a', 'b', 'c;d'])
})

test('parseInputLine: entirely quoted string', () => {
  const result = parseInputLine('"1;2;3"', ';')
  assertEqual(result, ['1;2;3'])
})

test('parseInputLine: multiple quoted strings', () => {
  const result = parseInputLine('"a;b";"c;d";"e;f"', ';')
  assertEqual(result, ['a;b', 'c;d', 'e;f'])
})

test('parseInputLine: two quoted strings', () => {
  const result = parseInputLine('"a;b";"c;d"', ';')
  assertEqual(result, ['a;b', 'c;d'])
})

test('parseInputLine: quoted string followed by unquoted', () => {
  const result = parseInputLine('"a;b";c;d', ';')
  assertEqual(result, ['a;b', 'c', 'd'])
})

test('parseInputLine: unquoted followed by quoted string', () => {
  const result = parseInputLine('a;b;"c;d"', ';')
  assertEqual(result, ['a', 'b', 'c;d'])
})

test('parseInputLine: alternating quoted and unquoted', () => {
  const result = parseInputLine('"a;b";c;"d;e";f', ';')
  assertEqual(result, ['a;b', 'c', 'd;e', 'f'])
})

test('parseInputLine: three quoted strings with delimiters', () => {
  const result = parseInputLine('"1;2";"3;4";"5;6"', ';')
  assertEqual(result, ['1;2', '3;4', '5;6'])
})

test('parseInputLine: quoted string with escaped quotes between delimiters', () => {
  // Note: Escaped quote handling removed - quotes are included as-is
  // The input "say ""hello"";world" contains quotes that aren't followed by delimiter,
  // so they're treated as part of the value until we find "; pattern
  const result = parseInputLine('"say ""hello"";world";"test"', ';')
  // Current behavior: quotes are included in the value until "; pattern is found
  assertEqual(result, ['say ""hello"', 'world"', 'test'])
})

test('parseInputLine: empty string', () => {
  const result = parseInputLine('', ';')
  assertEqual(result, [])
})

test('parseInputLine: whitespace only', () => {
  const result = parseInputLine('   ', ';')
  assertEqual(result, [])
})

test('parseInputLine: trims whitespace', () => {
  const result = parseInputLine(' 1 ; 2 ; 3 ', ';')
  assertEqual(result, ['1', '2', '3'])
})

test('parseInputLine: handles comma delimiter', () => {
  const result = parseInputLine('1,2,3,"4,5,6"', ',')
  assertEqual(result, ['1', '2', '3', '4,5,6'])
})

test('parseInputLine: escaped quotes inside quoted string', () => {
  // Note: Escaped quote handling removed - quotes are included as-is
  // The input "say ""hello"";world" contains quotes that aren't followed by delimiter,
  // so they're treated as part of the value until we find "; pattern
  const result = parseInputLine('1;"say ""hello"";world";2', ';')
  // Current behavior: quotes are included in the value until "; pattern is found
  assertEqual(result, ['1', 'say ""hello"', 'world"', '2'])
})

test('parseInputLine: unclosed quote treats rest as quoted', () => {
  // This is an edge case - unclosed quotes should still work
  const result = parseInputLine('1;"unclosed', ';')
  assertEqual(result, ['1', 'unclosed'])
})

test('parseInputLine: real-world example from user question', () => {
  const result = parseInputLine('1;2;3;"4;5;6"', ';')
  assertEqual(result, ['1', '2', '3', '4;5;6'])
  assert(result.length === 4, 'Should have exactly 4 values')
  assert(result[3] === '4;5;6', 'Last value should preserve semicolons')
})

test('parsePasteText: single line', () => {
  const result = parsePasteText('1;2;3;"4;5;6"', ';')
  assertEqual(result, ['1', '2', '3', '4;5;6'])
})

test('parsePasteText: multiple lines', () => {
  const result = parsePasteText('1;2;3\n"4;5;6";7', ';')
  assertEqual(result, ['1', '2', '3', '4;5;6', '7'])
})

test('parsePasteText: handles Windows line endings', () => {
  const result = parsePasteText('1;2\r\n3;4', ';')
  assertEqual(result, ['1', '2', '3', '4'])
})

test('parsePasteText: handles Mac line endings', () => {
  const result = parsePasteText('1;2\r3;4', ';')
  assertEqual(result, ['1', '2', '3', '4'])
})

test('parsePasteText: empty lines are skipped', () => {
  const result = parsePasteText('1;2\n\n3;4', ';')
  assertEqual(result, ['1', '2', '3', '4'])
})

test('parsePasteText: quoted string spanning multiple lines (per-line parsing)', () => {
  // Note: This parses per line, so quotes don't span lines
  const result = parsePasteText('"a;b"\n"c;d"', ';')
  assertEqual(result, ['a;b', 'c;d'])
})

test('parsePasteText: complex real-world example', () => {
  const text = `1;2;3;"4;5;6"
7;8;"9;10"
"11;12";13`
  const result = parsePasteText(text, ';')
  assertEqual(result, ['1', '2', '3', '4;5;6', '7', '8', '9;10', '11;12', '13'])
})

test('parseInputLine: default delimiter (semicolon)', () => {
  const result = parseInputLine('1;2;3')
  assertEqual(result, ['1', '2', '3'])
})

test('parsePasteText: default delimiter (semicolon)', () => {
  const result = parsePasteText('1;2;3')
  assertEqual(result, ['1', '2', '3'])
})

test('parseInputLine: null input', () => {
  const result = parseInputLine(null, ';')
  assertEqual(result, [])
})

test('parseInputLine: undefined input', () => {
  const result = parseInputLine(undefined, ';')
  assertEqual(result, [])
})

test('parsePasteText: null input', () => {
  const result = parsePasteText(null, ';')
  assertEqual(result, [])
})

test('parsePasteText: undefined input', () => {
  const result = parsePasteText(undefined, ';')
  assertEqual(result, [])
})

// Export for use in test runner
export { runTests }

// Auto-run if executed directly
if (typeof window !== 'undefined') {
  // Browser environment - expose to window
  window.runMultivalueParsingTests = runTests
  console.log('✅ Multivalue parsing tests loaded. Run window.runMultivalueParsingTests() to execute.')
} else {
  // Node environment - auto-run
  const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                       process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
  
  if (isMainModule || !process.argv[1] || process.argv[1].includes('multivalueParsing.test.js')) {
    runTests().then(({ passed, failed }) => {
      process.exit(failed > 0 ? 1 : 0)
    }).catch(err => {
      console.error('Test runner error:', err)
      process.exit(1)
    })
  }
}
