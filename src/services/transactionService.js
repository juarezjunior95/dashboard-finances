import { supabase } from '../lib/supabaseClient'

const LS_KEY = 'transactions'
const PARENT_MAP_KEY = 'categories_parent_map'

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

async function getUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

export async function listTransactions(month) {
  const user = await getUser()

  // Se não conseguimos confirmar o usuário (ex.: lock do Supabase), não devolver cache
  // para evitar mostrar transações de outro usuário.
  if (!user) return []

  const FETCH_TIMEOUT_MS = 15000

  try {
    const query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .order('date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), FETCH_TIMEOUT_MS)
    })

    const { data, error } = await Promise.race([query, timeoutPromise])

    if (error) throw error

    const store = getStore()
    store[month] = data || []
    setStore(store)
    return data || []
  } catch {
    // Com usuário logado, não devolver cache: pode ser de outro usuário (ex.: após troca de conta)
    return []
  }
}

export async function upsertTransaction({ id, month, category, description, amount, date, source, payment_status }) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('Mês inválido. Use YYYY-MM.')
  }

  const payload = {
    month,
    category,
    description: description || '',
    amount: Number(amount) || 0,
    date: date || null,
    source: source || 'manual',
    payment_status: payment_status || null,
  }

  const user = await getUser()

  if (!user) {
    const store = getStore()
    if (!store[month]) store[month] = []

    if (id) {
      const idx = store[month].findIndex(t => t.id === id)
      if (idx !== -1) {
        store[month][idx] = { ...store[month][idx], ...payload }
      }
    } else {
      const newTx = {
        id: crypto.randomUUID(),
        ...payload,
        created_at: new Date().toISOString(),
      }
      store[month].push(newTx)
    }

    setStore(store)
    return store[month].find(t => t.id === id) || store[month][store[month].length - 1]
  }

  try {
    const row = { user_id: user.id, ...payload }
    let result

    if (id) {
      const { data, error } = await supabase
        .from('transactions')
        .update(payload)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()
      if (error) throw error
      result = data
    } else {
      const { data, error } = await supabase
        .from('transactions')
        .insert(row)
        .select()
        .single()
      if (error) throw error
      result = data
    }

    const store = getStore()
    if (!store[month]) store[month] = []
    if (id) {
      const idx = store[month].findIndex(t => t.id === id)
      if (idx !== -1) store[month][idx] = result
      else store[month].push(result)
    } else {
      store[month].push(result)
    }
    setStore(store)
    return result
  } catch (err) {
    const store = getStore()
    if (!store[month]) store[month] = []

    if (id) {
      const idx = store[month].findIndex(t => t.id === id)
      if (idx !== -1) store[month][idx] = { ...store[month][idx], ...payload }
    } else {
      store[month].push({ id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() })
    }
    setStore(store)
    throw err
  }
}

export async function deleteTransaction(id, month) {
  const user = await getUser()

  if (!user) {
    const store = getStore()
    if (store[month]) {
      store[month] = store[month].filter(t => t.id !== id)
      setStore(store)
    }
    return
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error

  const store = getStore()
  if (store[month]) {
    store[month] = store[month].filter(t => t.id !== id)
    setStore(store)
  }
}

export async function getTransactionTotals(month) {
  const txs = await listTransactions(month)
  
  // Build parent_category map from localStorage categories
  let parentMap = {}
  try {
    const catsRaw = localStorage.getItem('user_categories')
    if (catsRaw) {
      const cats = JSON.parse(catsRaw)
      for (const c of cats) {
        parentMap[c.key] = c.parent_category || c.key
      }
    }
  } catch { /* ignore */ }
  
  // Fallback defaults if no categories found
  if (Object.keys(parentMap).length === 0) {
    parentMap = {
      receita: 'receita',
      fixas: 'fixas',
      cartao: 'cartao',
      compras: 'cartao',
      invest: 'invest',
    }
  }
  
  const detailedTotals = {}
  for (const tx of txs) {
    if (!detailedTotals[tx.category]) detailedTotals[tx.category] = 0
    detailedTotals[tx.category] += Number(tx.amount) || 0
  }
  
  // Group by parent category; exclude 'reserva' from operational totals (Disponível / Gasto diário)
  const OPERATIONAL_PARENTS = ['receita', 'fixas', 'cartao', 'invest']
  const totals = { receita: 0, fixas: 0, cartao: 0, invest: 0 }
  for (const [key, amount] of Object.entries(detailedTotals)) {
    const parent = parentMap[key] || key
    if (parent === 'reserva') continue
    if (OPERATIONAL_PARENTS.includes(parent)) {
      totals[parent] += Number(amount) || 0
    }
  }
  
  if (import.meta.env.DEV) {
    console.log('[getTransactionTotals]', { month, txCount: txs.length, detailedTotals, parentMap, totals })
  }

  return totals
}

export async function getDetailedTransactionTotals(month) {
  const txs = await listTransactions(month)
  const totals = {}
  for (const tx of txs) {
    if (!totals[tx.category]) totals[tx.category] = 0
    totals[tx.category] += Number(tx.amount) || 0
  }
  return totals
}

export async function deleteTransactionsBySource(month, source) {
  const user = await getUser()

  if (!user) {
    const store = getStore()
    if (store[month]) {
      store[month] = store[month].filter(t => t.source !== source)
      setStore(store)
    }
    return
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('user_id', user.id)
    .eq('month', month)
    .eq('source', source)
  if (error) throw error

  const store = getStore()
  if (store[month]) {
    store[month] = store[month].filter(t => t.source !== source)
    setStore(store)
  }
}

export async function clearTransactions(month) {
  const user = await getUser()

  if (!user) {
    const store = getStore()
    store[month] = []
    setStore(store)
    return
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('user_id', user.id)
    .eq('month', month)
  if (error) throw error

  const store = getStore()
  store[month] = []
  setStore(store)
}

// Receita separada por income_type (recurring, extraordinary, reserve)
export async function getIncomeTotals(month, categories) {
  const txs = await listTransactions(month)
  const result = { recurring: 0, extraordinary: 0, reserve: 0 }
  for (const tx of txs) {
    const cat = categories.find(c => c.key === tx.category)
    const parent = cat?.parent_category || tx.category
    if (parent !== 'receita') continue
    const incomeType = cat?.income_type || 'recurring'
    if (incomeType in result) {
      result[incomeType] += Number(tx.amount) || 0
    } else {
      result.recurring += Number(tx.amount) || 0
    }
  }
  return result
}

// Despesas separadas por payment_status (paid, pending, unknown)
/**
 * Receita pendente de recebimento (payment_status = 'pending' em categorias de receita).
 * Usado no cálculo de transferência imediata da reserva.
 */
export async function getPendingIncome(month) {
  const txs = await listTransactions(month)
  const incomeCategories = ['receita', 'salario', 'extraordinario', 'reserva_uso']

  let parentMap = {}
  try {
    const catsRaw = localStorage.getItem('user_categories')
    if (catsRaw) {
      const cats = JSON.parse(catsRaw)
      for (const c of cats) parentMap[c.key] = c.parent_category || c.key
    }
  } catch { /* ignore */ }

  let total = 0
  for (const tx of txs) {
    if (tx.payment_status !== 'pending') continue
    const parent = parentMap[tx.category] || tx.category
    if (incomeCategories.includes(tx.category) || parent === 'receita') {
      total += Number(tx.amount) || 0
    }
  }
  return total
}

export async function getExpensesByStatus(month) {
  const txs = await listTransactions(month)
  const result = { paid: 0, pending: 0, unknown: 0 }
  const incomeCategories = ['receita', 'salario', 'extraordinario', 'reserva_uso']

  let parentMap = {}
  try {
    const catsRaw = localStorage.getItem('user_categories')
    if (catsRaw) {
      const cats = JSON.parse(catsRaw)
      for (const c of cats) parentMap[c.key] = c.parent_category || c.key
    }
  } catch { /* ignore */ }

  for (const tx of txs) {
    if (incomeCategories.includes(tx.category)) continue
    const parent = parentMap[tx.category] || tx.category
    if (parent === 'receita') continue
    const status = tx.payment_status || 'unknown'
    if (status in result) {
      result[status] += Number(tx.amount) || 0
    } else {
      result.unknown += Number(tx.amount) || 0
    }
  }
  return result
}

export async function bulkInsertTransactions(month, transactions) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('Mês inválido. Use YYYY-MM.')
  }

  const user = await getUser()
  const rows = transactions.map(tx => ({
    month,
    category: tx.category,
    description: tx.description || '',
    amount: Number(tx.amount) || 0,
    date: tx.date || null,
    source: tx.source || 'import',
    payment_status: tx.payment_status || null,
  }))

  if (!user) {
    const store = getStore()
    if (!store[month]) store[month] = []
    const newTxs = rows.map(r => ({
      id: crypto.randomUUID(),
      ...r,
      created_at: new Date().toISOString(),
    }))
    store[month] = [...store[month], ...newTxs]
    setStore(store)
    return newTxs
  }

  try {
    const withUser = rows.map(r => ({ user_id: user.id, ...r }))
    const { data, error } = await supabase
      .from('transactions')
      .insert(withUser)
      .select()

    if (error) throw error

    const store = getStore()
    if (!store[month]) store[month] = []
    store[month] = [...store[month], ...(data || [])]
    setStore(store)
    return data || []
  } catch {
    const store = getStore()
    if (!store[month]) store[month] = []
    const fallback = rows.map(r => ({
      id: crypto.randomUUID(),
      ...r,
      created_at: new Date().toISOString(),
    }))
    store[month] = [...store[month], ...fallback]
    setStore(store)
    return fallback
  }
}
