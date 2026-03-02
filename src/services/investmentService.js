import { supabase } from '../lib/supabaseClient'

const LS_KEY = 'investment_planner'

// ── localStorage helpers ─────────────────────────────────

function getStore() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || { goal: null, investments: [] }
  } catch {
    return { goal: null, investments: [] }
  }
}

function setStore(store) {
  localStorage.setItem(LS_KEY, JSON.stringify(store))
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

// ── Goals ────────────────────────────────────────────────

export async function getGoal() {
  const user = await getUser()
  if (!user) return getStore().goal

  try {
    const { data, error } = await supabase
      .from('investment_goals')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) throw error
    const store = getStore()
    store.goal = data
    setStore(store)
    return data
  } catch {
    return getStore().goal
  }
}

export async function upsertGoal({ title, target_amount, target_date }) {
  const payload = { title, target_amount, target_date }
  const user = await getUser()

  if (!user) {
    const store = getStore()
    store.goal = {
      id: store.goal?.id || crypto.randomUUID(),
      ...payload,
      created_at: store.goal?.created_at || new Date().toISOString(),
    }
    setStore(store)
    return store.goal
  }

  const { data, error } = await supabase
    .from('investment_goals')
    .upsert(
      { user_id: user.id, ...payload },
      { onConflict: 'user_id' },
    )
    .select()
    .single()

  if (error) {
    const store = getStore()
    store.goal = { ...store.goal, id: store.goal?.id || crypto.randomUUID(), ...payload }
    setStore(store)
    throw error
  }

  const store = getStore()
  store.goal = data
  setStore(store)
  return data
}

// ── Investments ──────────────────────────────────────────

export async function listInvestments() {
  const user = await getUser()
  if (!user) return getStore().investments

  try {
    const { data, error } = await supabase
      .from('investments')
      .select('*')
      .eq('user_id', user.id)
      .order('month', { ascending: true })
    if (error) throw error
    const store = getStore()
    store.investments = data || []
    setStore(store)
    return data || []
  } catch {
    return getStore().investments
  }
}

export async function upsertInvestment({ month, amount }) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('Mês inválido. Use YYYY-MM.')
  }

  const user = await getUser()

  if (!user) {
    const store = getStore()
    const idx = store.investments.findIndex(i => i.month === month)
    const inv = {
      id: idx >= 0 ? store.investments[idx].id : crypto.randomUUID(),
      month,
      amount,
      created_at: idx >= 0 ? store.investments[idx].created_at : new Date().toISOString(),
    }
    if (idx >= 0) store.investments[idx] = inv
    else store.investments.push(inv)
    store.investments.sort((a, b) => a.month.localeCompare(b.month))
    setStore(store)
    return inv
  }

  const { data, error } = await supabase
    .from('investments')
    .upsert(
      { user_id: user.id, month, amount },
      { onConflict: 'user_id,month' },
    )
    .select()
    .single()

  if (error) throw error

  const store = getStore()
  const idx = store.investments.findIndex(i => i.month === month)
  if (idx >= 0) store.investments[idx] = data
  else store.investments.push(data)
  store.investments.sort((a, b) => a.month.localeCompare(b.month))
  setStore(store)
  return data
}

export async function deleteInvestment(id) {
  const user = await getUser()

  if (!user) {
    const store = getStore()
    store.investments = store.investments.filter(i => i.id !== id)
    setStore(store)
    return
  }

  const { error } = await supabase
    .from('investments')
    .delete()
    .eq('id', id)

  if (error) throw error

  const store = getStore()
  store.investments = store.investments.filter(i => i.id !== id)
  setStore(store)
}

export async function checkOnline() {
  return !!(await getUser())
}
