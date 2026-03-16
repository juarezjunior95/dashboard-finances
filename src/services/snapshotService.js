import { supabase } from '../lib/supabaseClient'

const LS_KEY = 'monthly_snapshots'

// ── localStorage helpers ─────────────────────────────────

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

// ── Auth helper ──────────────────────────────────────────

async function getUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

// ── Snapshots ────────────────────────────────────────────

export async function getSnapshot(month) {
  const user = await getUser()
  if (!user) return getStore()[month] || null

  try {
    const { data, error } = await supabase
      .from('monthly_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .maybeSingle()
    if (error) throw error

    if (data) {
      const store = getStore()
      store[month] = data
      setStore(store)
    }
    return data
  } catch {
    // Com usuário logado, não devolver cache: pode ser de outro usuário
    return null
  }
}

export async function upsertSnapshot({ month, receita, fixas, cartao, invest, recurring_income, extraordinary_income, reserve_usage, real_balance, reserve_total, debt_amortization, reserve_transferred }) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('Mês inválido. Use YYYY-MM.')
  }

  const payload = {
    month,
    receita: Number(receita) || 0,
    fixas: Number(fixas) || 0,
    cartao: Number(cartao) || 0,
    invest: Number(invest) || 0,
  }

  // Only include new optional fields if explicitly provided (not undefined)
  if (recurring_income !== undefined) payload.recurring_income = recurring_income != null ? Number(recurring_income) : null
  if (extraordinary_income !== undefined) payload.extraordinary_income = extraordinary_income != null ? Number(extraordinary_income) : null
  if (reserve_usage !== undefined) payload.reserve_usage = reserve_usage != null ? Number(reserve_usage) : null
  if (real_balance !== undefined) {
    payload.real_balance = real_balance != null ? Number(real_balance) : null
    if (real_balance != null) payload.real_balance_updated_at = new Date().toISOString()
  }
  if (reserve_total !== undefined) payload.reserve_total = reserve_total != null ? Number(reserve_total) : null
  if (debt_amortization !== undefined) payload.debt_amortization = debt_amortization != null ? Number(debt_amortization) : null
  if (reserve_transferred !== undefined) payload.reserve_transferred = reserve_transferred != null ? Number(reserve_transferred) : null

  const user = await getUser()

  if (!user) {
    const store = getStore()
    store[month] = {
      ...store[month],
      id: store[month]?.id || crypto.randomUUID(),
      ...payload,
      created_at: store[month]?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setStore(store)
    return store[month]
  }

  // Try update first to avoid overwriting optional fields not included in payload
  const { data: existing } = await supabase
    .from('monthly_snapshots')
    .select('id')
    .eq('user_id', user.id)
    .eq('month', month)
    .maybeSingle()

  let data, error
  if (existing) {
    const result = await supabase
      .from('monthly_snapshots')
      .update(payload)
      .eq('user_id', user.id)
      .eq('month', month)
      .select()
      .single()
    data = result.data
    error = result.error
  } else {
    const result = await supabase
      .from('monthly_snapshots')
      .insert({ user_id: user.id, ...payload })
      .select()
      .single()
    data = result.data
    error = result.error
  }

  if (error) {
    const store = getStore()
    store[month] = { ...store[month], id: store[month]?.id || crypto.randomUUID(), ...payload }
    setStore(store)
    throw error
  }

  const store = getStore()
  store[month] = data
  setStore(store)
  return data
}

/**
 * Retorna breakdown de receita com fallback para legado.
 * Se recurring_income estiver preenchido, usa a separação; senão, trata receita como recorrente.
 */
export function getEffectiveIncome(snapshot) {
  if (!snapshot) {
    return { recurring: 0, extraordinary: 0, reserve: 0, total: 0, hasBreakdown: false }
  }
  if (snapshot.recurring_income != null) {
    return {
      recurring: Number(snapshot.recurring_income) || 0,
      extraordinary: Number(snapshot.extraordinary_income) || 0,
      reserve: Number(snapshot.reserve_usage) || 0,
      total: Number(snapshot.receita) || 0,
      hasBreakdown: true,
    }
  }
  return {
    recurring: Number(snapshot.receita) || 0,
    extraordinary: 0,
    reserve: 0,
    total: Number(snapshot.receita) || 0,
    hasBreakdown: false,
  }
}

export async function listMonths() {
  const user = await getUser()

  if (!user) {
    return Object.keys(getStore()).sort()
  }

  try {
    const { data, error } = await supabase
      .from('monthly_snapshots')
      .select('month')
      .eq('user_id', user.id)
      .order('month', { ascending: true })
    if (error) throw error

    const months = (data || []).map(r => r.month)

    const store = getStore()
    const localMonths = Object.keys(store)
    const merged = [...new Set([...months, ...localMonths])].sort()
    return merged
  } catch {
    // Com usuário logado, não devolver cache: pode ser de outro usuário
    return []
  }
}

export async function listAllSnapshots() {
  const user = await getUser()
  if (!user) {
    const store = getStore()
    return Object.values(store).sort((a, b) => (a.month || '').localeCompare(b.month || ''))
  }

  try {
    const { data, error } = await supabase
      .from('monthly_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .order('month', { ascending: true })
    if (error) throw error

    const store = getStore()
    for (const snap of (data || [])) {
      store[snap.month] = snap
    }
    setStore(store)
    return data || []
  } catch {
    // Com usuário logado, não devolver cache: pode ser de outro usuário
    return []
  }
}

export async function deleteSnapshot(month) {
  const user = await getUser()

  if (!user) {
    const store = getStore()
    delete store[month]
    setStore(store)
    return
  }

  const { error } = await supabase
    .from('monthly_snapshots')
    .delete()
    .eq('user_id', user.id)
    .eq('month', month)

  if (error) throw error

  const store = getStore()
  delete store[month]
  setStore(store)
}
