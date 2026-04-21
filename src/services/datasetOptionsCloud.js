/**
 * Cloud: load dataset value lists for category properties (hasValueList + dataSetId).
 */
import { createApi } from './api.js'
import { normalizeDatasetOptions } from '@/utils/valueCoercion.js'
import { log } from '@/utils/debug.js'

/**
 * @returns {Promise<Record<string, { label: string, value: string }[]>>}
 *   Keys are `dataSetId` strings (same as property.dataSetId or fallback property.id).
 */
export async function fetchCloudDatasetOptionsMap ({
  base,
  repoId,
  catPropsArr = [],
  locale = 'en',
  apiKey
} = {}) {
  const ids = new Set()
  for (const p of catPropsArr) {
    // Primary: `hasValueList` from d.velop. Also load when `dataSetId` is set (some APIs omit the flag).
    const hasFlag = !!p?.hasValueList
    const dsId = String(p?.dataSetId || '').trim()
    if (!hasFlag && !dsId) continue
    const ds = String(p.dataSetId || p.id || '').trim()
    if (ds) ids.add(ds)
  }
  if (ids.size === 0) return {}

  const Dv = createApi({ base, locale, apiKey, onPremise: false })
  const listRes = await Dv.datasets(base, repoId)
  const listArr = Array.isArray(listRes?.arr) ? listRes.arr : []
  const byId = new Map()
  for (const d of listArr) {
    const id = String(d?.id ?? d?.uuid ?? '').trim()
    if (id) byId.set(id, d)
  }

  const out = {}
  for (const id of ids) {
    try {
      let ds = byId.get(id)
      const hasVals = ds && Array.isArray(ds.values) && ds.values.length > 0
      if (!hasVals) {
        const one = await Dv.dataset(base, repoId, id)
        const item = one?.item || one?.raw
        if (item && Array.isArray(item.values) && item.values.length) {
          ds = item
        }
      }
      if (ds && Array.isArray(ds.values) && ds.values.length) {
        out[id] = normalizeDatasetOptions(ds, locale)
      } else {
        out[id] = []
        log('[datasetOptionsCloud] no values for dataset', id)
      }
    } catch (e) {
      log('[datasetOptionsCloud] failed dataset', id, e)
      out[id] = []
    }
  }
  return out
}
