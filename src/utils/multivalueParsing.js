/**
 * Build regex to split by delimiter (escape special chars).
 */
export function splitRegexFor (delimiter) {
  if (!delimiter || typeof delimiter !== 'string') return /;/
  const escaped = delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(escaped)
}

/**
 * Parse single-line input: respects quoted strings that may contain delimiters.
 * Example: 1;2;3;"4;5;6" → ["1", "2", "3", "4;5;6"]
 * 
 * @param {string} line - The input line to parse
 * @param {string} delimiter - The delimiter to split on (default: ';')
 * @returns {string[]} Array of parsed tokens (quotes removed)
 */
export function parseInputLine (line, delimiter = ';') {
  const trimmed = (line ?? '').trim()
  if (!trimmed) return []
  
  // If entire line is quoted (and contains no delimiters outside quotes), return as single value
  // Check: starts with ", ends with ", and no "; pattern in between
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && !trimmed.slice(1, -1).includes('";')) {
    return [trimmed.slice(1, -1)]
  }
  
  // Two situations:
  // 1. If char is " → collect all chars until next ", then skip delimiter
  // 2. Otherwise → collect all chars until next delimiter ;
  const tokens = []
  const delimRe = splitRegexFor(delimiter)
  let i = 0
  
  console.log('[parseInputLine] Starting parse:', { input: trimmed, length: trimmed.length, delimiter })
  
  while (i < trimmed.length) {
    console.log(`[parseInputLine] Loop start: i=${i}, char='${trimmed[i]}', tokens=${JSON.stringify(tokens)}`)
    
    // Skip any leading delimiters
    const remaining = trimmed.slice(i)
    const delimMatch = remaining.match(delimRe)
    if (delimMatch && delimMatch.index === 0) {
      console.log(`[parseInputLine]   Skipping delimiter at i=${i}`)
      i += delimMatch[0].length
      continue
    }
    
    const char = trimmed[i]
    
    if (char === '"') {
      console.log(`[parseInputLine]   Situation 1: Found opening quote at i=${i}`)
      // Situation 1: Collect value between quotes until we find "; (quote + delimiter)
      i++ // Skip opening quote
      const startIdx = i
      console.log(`[parseInputLine]   Start collecting from i=${i} (startIdx=${startIdx})`)
      
      // Search for "; pattern starting from current position
      let foundEnd = false
      let endIdx = trimmed.length
      
      while (i < trimmed.length) {
        if (trimmed[i] === '"') {
          console.log(`[parseInputLine]     Found quote at i=${i}, checking if followed by delimiter`)
          // Found a quote - check if it's followed by delimiter
          const afterQuote = trimmed.slice(i + 1)
          const delimAfterQuote = afterQuote.match(delimRe)
          console.log(`[parseInputLine]     afterQuote='${afterQuote}', delimMatch=${delimAfterQuote ? 'found' : 'none'}, index=${delimAfterQuote?.index}`)
          
          if (delimAfterQuote && delimAfterQuote.index === 0) {
            // Found "; pattern - this is the closing quote
            endIdx = i
            foundEnd = true
            console.log(`[parseInputLine]     Found "; pattern! endIdx=${endIdx}`)
            break
          }
          // If quote is at end of string, it also closes
          if (afterQuote.length === 0) {
            endIdx = i
            foundEnd = true
            console.log(`[parseInputLine]     Quote at end of string! endIdx=${endIdx}`)
            break
          }
          console.log(`[parseInputLine]     Quote not followed by delimiter, continuing...`)
        }
        i++
      }
      
      // Extract value between quotes
      const value = trimmed.slice(startIdx, endIdx)
      console.log(`[parseInputLine]   Extracted value: '${value}' (startIdx=${startIdx}, endIdx=${endIdx})`)
      tokens.push(value)
      console.log(`[parseInputLine]   Pushed token, tokens=${JSON.stringify(tokens)}`)
      
      // Skip closing quote and delimiter
      if (foundEnd) {
        console.log(`[parseInputLine]   foundEnd=true, current i=${i}`)
        i++ // Skip closing quote
        console.log(`[parseInputLine]   After skipping closing quote, i=${i}`)
        const afterRemaining = trimmed.slice(i)
        const afterDelimMatch = afterRemaining.match(delimRe)
        console.log(`[parseInputLine]   afterRemaining='${afterRemaining}', delimMatch=${afterDelimMatch ? 'found' : 'none'}`)
        if (afterDelimMatch && afterDelimMatch.index === 0) {
          i += afterDelimMatch[0].length
          console.log(`[parseInputLine]   Skipped delimiter, i now=${i}`)
        }
      } else {
        // No closing quote found - use rest of string
        console.log(`[parseInputLine]   foundEnd=false, setting i to end`)
        i = trimmed.length
      }
    } else {
      // Situation 2: Collect value between delimiters
      let value = ''
      while (i < trimmed.length) {
        const ch = trimmed[i]
        // Check if this is a delimiter
        const checkRemaining = trimmed.slice(i)
        const checkMatch = checkRemaining.match(delimRe)
        if (checkMatch && checkMatch.index === 0) {
          // Found delimiter - stop collecting
          break
        }
        value += ch
        i++
      }
      const token = value.trim()
      if (token) {
        tokens.push(token)
      }
      // Skip delimiter
      if (i < trimmed.length) {
        const checkRemaining = trimmed.slice(i)
        const checkMatch = checkRemaining.match(delimRe)
        if (checkMatch && checkMatch.index === 0) {
          i += checkMatch[0].length
        }
      }
    }
  }
  
  return tokens
}

/**
 * Parse pasted text: newlines first, then delimiter per line; respects quoted strings.
 * Example: 1;2;3;"4;5;6" → ["1", "2", "3", "4;5;6"]
 * 
 * @param {string} text - The pasted text to parse
 * @param {string} delimiter - The delimiter to split on (default: ';')
 * @returns {string[]} Array of parsed tokens
 */
export function parsePasteText (text, delimiter = ';') {
  if (!text || typeof text !== 'string') return []
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.includes('\n') ? normalized.split('\n') : [normalized]
  const tokens = []
  for (const line of lines) {
    const parsed = parseInputLine(line, delimiter)
    tokens.push(...parsed)
  }
  return tokens
}
