const LS_KEY = 'activity_log'

function getStore() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || {}
  } catch {
    return {}
  }
}

function setStore(store) {
  localStorage.setItem(LS_KEY, JSON.stringify(store))
}

const MAX_ENTRIES_PER_MONTH = 200

/**
 * Adds an activity log entry for a given month.
 * @param {string} month - "YYYY-MM"
 * @param {{ type: string, description: string, details?: object }} entry
 */
export function logActivity(month, { type, description, details }) {
  const store = getStore()
  if (!store[month]) store[month] = []

  store[month].unshift({
    id: crypto.randomUUID(),
    type,
    description,
    details: details || null,
    timestamp: new Date().toISOString(),
  })

  if (store[month].length > MAX_ENTRIES_PER_MONTH) {
    store[month] = store[month].slice(0, MAX_ENTRIES_PER_MONTH)
  }

  setStore(store)
}

/**
 * Returns all activity log entries for a given month, newest first.
 */
export function getActivityLog(month) {
  const store = getStore()
  return store[month] || []
}

/**
 * Clears all activity log entries for a given month.
 */
export function clearActivityLog(month) {
  const store = getStore()
  delete store[month]
  setStore(store)
}

export const ACTIVITY_TYPES = {
  BALANCE_UPDATE: 'balance_update',
  RESERVE_UPDATE: 'reserve_update',
  RESERVE_TRANSFER: 'reserve_transfer',
  STATUS_CHANGE: 'status_change',
  IMPORT: 'import',
  MANUAL_ADJUST: 'manual_adjust',
  GOAL_CREATE: 'goal_create',
  GOAL_UPDATE: 'goal_update',
  RESET: 'reset',
}

export const ACTIVITY_META = {
  [ACTIVITY_TYPES.BALANCE_UPDATE]:    { icon: '💰', label: 'Saldo atualizado',       color: 'emerald' },
  [ACTIVITY_TYPES.RESERVE_UPDATE]:    { icon: '🛡️', label: 'Reserva atualizada',     color: 'violet' },
  [ACTIVITY_TYPES.RESERVE_TRANSFER]:  { icon: '💸', label: 'Transferência reserva',  color: 'rose' },
  [ACTIVITY_TYPES.STATUS_CHANGE]:     { icon: '✓',  label: 'Status alterado',        color: 'blue' },
  [ACTIVITY_TYPES.IMPORT]:            { icon: '📄', label: 'Importação',             color: 'indigo' },
  [ACTIVITY_TYPES.MANUAL_ADJUST]:     { icon: '✏️', label: 'Ajuste manual',          color: 'amber' },
  [ACTIVITY_TYPES.GOAL_CREATE]:       { icon: '🎯', label: 'Meta criada',            color: 'cyan' },
  [ACTIVITY_TYPES.GOAL_UPDATE]:       { icon: '🎯', label: 'Meta atualizada',        color: 'cyan' },
  [ACTIVITY_TYPES.RESET]:             { icon: '🗑️', label: 'Dados limpos',           color: 'red' },
}
