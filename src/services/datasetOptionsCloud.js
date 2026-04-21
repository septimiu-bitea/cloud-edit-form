/**
 * Load dataset value lists for category properties (`hasValueList` and/or `dataSetId`).
 * Cloud: REST `/objectmanagement/datasets`. On-premise: storedoctype + optional `resolveValues` (valid-values POST).
 */
import { createApi } from './api.js'
import { normalizeDatasetOptions } from '@/utils/valueCoercion.js'
import { log } from '@/utils/debug.js'

function collectDatasetIdsFromCatProps (catPropsArr) {
  const ids = new Set()
  for (const p of catPropsArr || []) {
    const hasFlag = !!p?.hasValueList
    const dsIdRaw = String(p?.dataSetId || '').trim()
    if (!hasFlag && !dsIdRaw) continue
    const ds = String(p.dataSetId || p.id || '').trim()
    if (ds) ids.add(ds)
  }
  return ids
}

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
  const ids = collectDatasetIdsFromCatProps(catPropsArr)
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

/**
 * On-premise: datasets from storedoctype; values may load lazily via `resolveValues` + `objectDefinitionId` (document type id).
 * @param {string} [objectDefinitionId] — selected category / storage document type id (required for dynamic lists).
 */
export async function fetchOnPremiseDatasetOptionsMap ({
  base,
  repoId,
  catPropsArr = [],
  locale = 'en',
  apiKey,
  objectDefinitionId = ''
} = {}) {
  const ids = collectDatasetIdsFromCatProps(catPropsArr)
  if (ids.size === 0) return {}

  const Dv = createApi({ base, locale, apiKey, onPremise: true })
  const listRes = await Dv.datasets(base, repoId)
  const listArr = Array.isArray(listRes?.arr) ? listRes.arr : []
  const byId = new Map()
  for (const d of listArr) {
    const id = String(d?.id ?? d?.uuid ?? '').trim()
    if (id) byId.set(id, d)
  }

  const out = {}
  const oid = String(objectDefinitionId || '').trim()

  for (const id of ids) {
    try {
      const ds = byId.get(id)
      if (!ds) {
        out[id] = []
        log('[datasetOptionsOnPrem] no dataset entry for', id)
        continue
      }
      let values = ds.values
      const hasVals = Array.isArray(values) && values.length > 0
      if (!hasVals && typeof ds.resolveValues === 'function') {
        if (!oid) {
          log('[datasetOptionsOnPrem] no objectDefinitionId for dynamic dataset', id)
          out[id] = []
          continue
        }
        values = await ds.resolveValues({ objectDefinitionId: oid })
      }
      if (Array.isArray(values) && values.length) {
        const merged = { ...ds, values }
        out[id] = normalizeDatasetOptions(merged, locale)
      } else {
        out[id] = []
        log('[datasetOptionsOnPrem] no values for dataset', id)
      }
    } catch (e) {
      log('[datasetOptionsOnPrem] failed dataset', id, e)
      out[id] = []
    }
  }
  return out
}

/**
 * Unified loader for import (and similar): cloud DMS config API or on-premise storedoctype + valid-values.
 */
export async function fetchDatasetOptionsMap ({
  base,
  repoId,
  catPropsArr = [],
  locale = 'en',
  apiKey,
  onPremise = false,
  /** On-premise: same as selected category id (storage document type id). */
  categoryId = ''
} = {}) {
  if (onPremise) {
    return fetchOnPremiseDatasetOptionsMap({
      base,
      repoId,
      catPropsArr,
      locale,
      apiKey,
      objectDefinitionId: categoryId
    })
  }
  return fetchCloudDatasetOptionsMap({ base, repoId, catPropsArr, locale, apiKey })
}
