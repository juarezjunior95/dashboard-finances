import { supabase } from '../lib/supabaseClient'

const LS_KEY = 'budgets'

// ── localStorage helpers ─────────────────────────────────

function getStore() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || []
  } catch {
    return []
  }
}

function setStore(budgets) {
  localStorage.setItem(LS_KEY, JSON.stringify(budgets))
}

// ── Auth helper ──────────────────────────────────────────

async function getUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

// ── Budgets ──────────────────────────────────────────────

export async function getBudgets() {
  const user = await getUser()
  if (!user) return getStore()

  try {
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', user.id)
    if (error) throw error

    const budgets = data || []
    setStore(budgets)
    return budgets
  } catch {
    return getStore()
  }
}

export async function upsertBudget({ category, limit_amount }) {
  const payload = { category, limit_amount: Number(limit_amount) || 0 }
  const user = await getUser()

  if (!user) {
    const store = getStore()
    const idx = store.findIndex(b => b.category === category)
    const entry = {
      id: idx >= 0 ? store[idx].id : crypto.randomUUID(),
      ...payload,
      created_at: idx >= 0 ? store[idx].created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (idx >= 0) store[idx] = entry
    else store.push(entry)
    setStore(store)
    return entry
  }

  const { data, error } = await supabase
    .from('budgets')
    .upsert(
      { user_id: user.id, ...payload },
      { onConflict: 'user_id,category' },
    )
    .select()
    .single()

  if (error) {
    const store = getStore()
    const idx = store.findIndex(b => b.category === category)
    const entry = { ...(idx >= 0 ? store[idx] : {}), id: crypto.randomUUID(), ...payload }
    if (idx >= 0) store[idx] = entry
    else store.push(entry)
    setStore(store)
    throw error
  }

  const store = getStore()
  const idx = store.findIndex(b => b.category === category)
  if (idx >= 0) store[idx] = data
  else store.push(data)
  setStore(store)
  return data
}
