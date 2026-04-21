/**
 * Formats a byte count with binary prefixes (1024 B = 1 KB).
 */
export function formatByteSizeShort (bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n < 0) return '—'
  const base = 1024
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  if (n < base) return `${Math.round(n)} ${units[0]}`
  const exp = Math.min(
    Math.floor(Math.log(n) / Math.log(base)),
    units.length - 1
  )
  const v = n / base ** exp
  const fracDigits = v >= 100 ? 0 : v >= 10 ? 1 : 2
  const rounded = Number(v.toFixed(fracDigits))
  return `${rounded} ${units[exp]}`
}
