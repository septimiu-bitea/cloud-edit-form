/**
 * d.velop Pilot — prompts API ({systemBaseUri}/d42/api/v1/prompts).
 * @see https://help.d-velop.de/dev/documentation/dvelop-pilot#tag/prompts
 */
import { labelFromName } from '../utils/fieldBuilding.js'
import { coerceValueForType } from '../utils/valueCoercion.js'
import { toKeyedEntries } from '../utils/multivalueParsing.js'

export function pilotApiV1Base (base) {
  const b = String(base || '').replace(/\/$/, '')
  return `${b}/d42/api/v1`
}

function fetchOpts (apiKey) {
  return {
    credentials: apiKey ? 'omit' : 'include',
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
  }
}

/**
 * Read file as standard Base64 (RFC 4648) **with padding**.
 * d.velop Pilot decodes `context.documents[].document` with strict padding; base64url / no-padding causes "Incorrect padding".
 */
export async function fileToBase64Url (fileBlob) {
  const buf = await fileBlob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/**
 * d.velop Pilot accepts only these `documentMimeType` values (API validation).
 * e.g. Word (.docx) is not supported — use PDF instead.
 */
export const PILOT_ALLOWED_DOCUMENT_MIMES = Object.freeze([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'text/plain'
])

const _pilotAllowedSet = new Set(PILOT_ALLOWED_DOCUMENT_MIMES)

const _pilotExtToMime = Object.freeze({
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.txt': 'text/plain'
})

/**
 * Normalize browser `File.type` and fall back to extension when type is missing.
 * @returns {string} MIME string (may still be unsupported, e.g. docx)
 */
export function resolvePilotDocumentMimeType (file) {
  const raw = String(file?.type || '').trim().toLowerCase()
  if (raw && _pilotAllowedSet.has(raw)) return raw
  const name = String(file?.name || '')
  const lower = name.toLowerCase()
  const dot = lower.lastIndexOf('.')
  const ext = dot >= 0 ? lower.slice(dot) : ''
  if (ext && _pilotExtToMime[ext]) return _pilotExtToMime[ext]
  return raw
}

export function isPilotDocumentMimeSupported (mime) {
  return _pilotAllowedSet.has(String(mime || '').trim().toLowerCase())
}

/**
 * HTML `accept` for file inputs: Pilot MIME types plus extensions so OS dialogs
 * filter files reliably (some browsers ignore MIME-only lists).
 */
export const PILOT_FILE_ACCEPT = [
  ...PILOT_ALLOWED_DOCUMENT_MIMES,
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.tif',
  '.tiff',
  '.txt'
].join(',')

export function buildCategoriesCatalogText (categorySelectItems) {
  const lines = []
  for (const it of categorySelectItems || []) {
    const id = String(it?.value ?? '').trim()
    if (!id) continue
    const title = String(it?.title ?? id)
    lines.push(`- categoryId: "${id}" | title: ${title}`)
  }
  return lines.join('\n')
}

export function buildPropertiesCatalogText (catPropsArr, idMap, locale) {
  const props = (catPropsArr || []).filter(p => p && !p.readOnly)
  const lines = []
  for (const p of props) {
    const pid = String(p.id ?? '')
    if (!pid) continue
    const uuid = idMap[pid] || pid
    const label = labelFromName(p.name, locale) || pid
    const dt = String(p.dataType || 'STRING').toUpperCase()
    const multi = !!p.isMultiValue
    lines.push(
      `- propertyKey: "${uuid}" | label: ${label} | dataType: ${dt} | multiValue: ${multi}`
    )
  }
  return lines.join('\n')
}

/** Default step 1: pick document type from catalog. {context} is replaced by Pilot with document text. */
export function defaultStep1Template (categoriesText) {
  return `You are a document classification expert for a DMS. Your task is to choose exactly one document type from the list below based on the document content in {context}.

Return ONLY valid JSON (no markdown, no explanation) with this exact shape:
{ "categoryId": "<uuid from list>" }

Rules:
- categoryId MUST be copied exactly from one of the "categoryId" values below.
- If unsure, pick the closest match.

Allowed document types:
${categoriesText}

Document content placeholder (filled by the system):
{context}`
}

/**
 * Step 2: fill metadata for the **currently selected** document type.
 * When userChangedCategoryAfterPilot is true, the prompt tells the model the user switched type after a prior AI run.
 */
export function buildStep2PromptTemplate ({
  propertiesText,
  categoryId,
  categoryTitle,
  userChangedCategoryAfterPilot = false
}) {
  const id = String(categoryId || '').trim()
  const title = String(categoryTitle || id || '').trim()
  const header = id
    ? `The user selected this document type — only use property keys from the list below (they belong to this type):
- categoryId: "${id}"
- title: ${title}`
    : 'Fill metadata using only the property keys listed below.'

  const afterSwitch = userChangedCategoryAfterPilot
    ? `

The user changed the document type after a previous AI-assisted extraction. Treat this as a new extraction for the selected type only: ignore metadata that would apply only to a different document type. Do not reuse property keys from other types. If the file fits this type poorly, still fill what you can from the list below or omit uncertain fields.`
    : ''

  return `You are a metadata extraction expert for a DMS. ${header}${afterSwitch}

Based on the document content in {context}, fill the JSON object with property values for the fields listed below.

Return ONLY valid JSON (no markdown, no explanation) with this exact shape:
{ "properties": { "<propertyKey>": <value>, ... } }

Rules:
- Put the document title or display name in the appropriate property from the list below (e.g. title, name, or subject), not outside this object.
- Use "propertyKey" strings exactly as given (UUIDs).
- Omit a property if unknown; do not guess wildly.
- For multiValue true, use a JSON array of strings.
- For BOOLEAN use true or false.
- For DATE use ISO date YYYY-MM-DD.
- For NUMBER/DECIMAL/INTEGER use numbers or numeric strings.

Fields to fill:
${propertiesText}

Document content placeholder (filled by the system):
{context}`
}

export function buildPilotPromptBody ({ template, documentBase64Url, documentMimeType }) {
  return {
    prompt: { template },
    context: {
      type: 'document',
      documents: [
        {
          document: documentBase64Url,
          documentMimeType: documentMimeType || 'application/octet-stream'
        }
      ]
    }
  }
}

export async function createPromptRequest ({ base, apiKey, body }) {
  const url = `${pilotApiV1Base(base)}/prompts`
  const fo = fetchOpts(apiKey)
  const res = await fetch(url, {
    method: 'POST',
    credentials: fo.credentials,
    headers: {
      ...fo.headers,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, json, text }
}

export async function getPromptResult ({ base, apiKey, promptId }) {
  const url = `${pilotApiV1Base(base)}/prompts/${encodeURIComponent(promptId)}`
  const fo = fetchOpts(apiKey)
  const res = await fetch(url, {
    method: 'GET',
    credentials: fo.credentials,
    headers: {
      ...fo.headers,
      Accept: 'application/json'
    }
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, json, text }
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Poll until status is Completed or Error (or timeout).
 */
export async function pollPromptUntilDone ({
  base,
  apiKey,
  promptId,
  maxAttempts = 120,
  intervalMs = 500
} = {}) {
  let last = null
  for (let i = 0; i < maxAttempts; i++) {
    const r = await getPromptResult({ base, apiKey, promptId })
    last = r
    if (!r.ok) {
      const msg = r.json?.detail || r.json?.title || r.text?.slice(0, 300) || `HTTP ${r.status}`
      throw new Error(msg)
    }
    const st = r.json?.status
    if (st === 'Completed') return r.json
    if (st === 'Error') {
      const code = r.json?.result?.errorCode
      const detail = r.json?.result?.errorDetails?.detail || r.json?.detail
      throw new Error(detail || `Pilot error${code != null ? ` (${code})` : ''}`)
    }
    await sleep(intervalMs)
  }
  throw new Error('Pilot request timed out while waiting for a result.')
}

/**
 * Extract first JSON object from LLM text (handles markdown fences).
 */
export function extractJsonObject (text) {
  const t = String(text || '').trim()
  const tryParse = (s) => {
    try {
      return JSON.parse(s)
    } catch {
      return null
    }
  }
  let p = tryParse(t)
  if (p && typeof p === 'object') return p
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) {
    p = tryParse(fence[1].trim())
    if (p && typeof p === 'object') return p
  }
  const start = t.indexOf('{')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < t.length; i++) {
    const c = t[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) {
        p = tryParse(t.slice(start, i + 1))
        if (p && typeof p === 'object') return p
      }
    }
  }
  return null
}

export function resolveCategoryIdFromPilot (parsed, categorySelectItems) {
  if (!parsed || typeof parsed !== 'object') return null
  const raw = parsed.categoryId ?? parsed.category_id
  if (raw == null || raw === '') return null
  const want = String(raw).trim()
  const items = categorySelectItems || []
  const byValue = items.find(i => String(i.value) === want)
  if (byValue) return String(byValue.value)
  const lower = want.toLowerCase()
  const byLower = items.find(i => String(i.value).toLowerCase() === lower)
  if (byLower) return String(byLower.value)
  return null
}

function resolvePropKey (rawKey, idMap) {
  const s = String(rawKey ?? '').trim()
  if (!s) return null
  if (idMap[s]) return idMap[s]
  const vals = Object.values(idMap || {})
  if (vals.includes(s)) return s
  return s
}

/**
 * Map Pilot JSON properties into formData keys (UUID) and coerced values.
 */
export function pilotPropertiesToFormData (parsed, propsList, idMap) {
  const out = {}
  if (!parsed || typeof parsed !== 'object') return out
  const rawProps = parsed.properties
  if (!rawProps || typeof rawProps !== 'object') return out

  const props = (propsList || []).filter(p => p && !p.readOnly)
  const byUuid = new Map()
  for (const p of props) {
    const pid = String(p.id ?? '')
    if (!pid) continue
    const uuid = idMap[pid] || pid
    byUuid.set(uuid, p)
    byUuid.set(pid, p)
  }

  for (const [k, val] of Object.entries(rawProps)) {
    const uuid = resolvePropKey(k, idMap)
    if (!uuid || !byUuid.has(uuid)) continue
    const p = byUuid.get(uuid)
    const dt = String(p.dataType || 'STRING').toUpperCase()
    const isMulti = !!p.isMultiValue

    if (isMulti) {
      const arr = Array.isArray(val) ? val : (val == null || val === '' ? [] : [val])
      const strs = arr.map(x => String(coerceValueForType(x, dt) ?? '').trim()).filter(Boolean)
      out[uuid] = toKeyedEntries(strs, uuid)
    } else {
      out[uuid] = coerceValueForType(val, dt)
    }
  }
  return out
}

export function mergeEnvPromptSuffix (template) {
  const extra = (import.meta.env.VITE_PILOT_PROMPT_EXTRA || '').trim()
  if (!extra) return template
  return `${template}\n\nAdditional instructions:\n${extra}`
}
