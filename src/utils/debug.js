import { DEBUG } from '@/config'

export function log (...args) {
  if (DEBUG) console.log('[vue-app]', ...args)
}

export function dbgTable (label, objOrArr) {
  if (!DEBUG) return
  console.groupCollapsed(label)
  if (Array.isArray(objOrArr)) {
    objOrArr.slice(0, 10).forEach((x, i) => console.log(i, x))
    if (objOrArr.length > 10) console.log('…', objOrArr.length - 10, 'more')
  } else if (objOrArr && typeof objOrArr === 'object') {
    console.table(objOrArr)
  }
  console.groupEnd()
}
