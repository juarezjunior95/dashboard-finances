import { supabase } from '../lib/supabaseClient'

const LS_KEY = 'transactions'

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

  if (!user) {
    const store = getStore()
    const items = store[month] || []
    return items.sort((a, b) =>
      (b.date || '').localeCompare(a.date || '') ||
      (b.created_at || '').localeCompare(a.created_at || '')
    )
  }

  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .order('date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    const store = getStore()
    store[month] = data || []
    setStore(store)
    return data || []
  } catch {
    const store = getStore()
    return (store[month] || []).sort((a, b) =>
      (b.date || '').localeCompare(a.date || '') ||
      (b.created_at || '').localeCompare(a.created_at || '')
    )
  }
}

export async function upsertTransaction({ id, month, category, description, amount, date, source }) {
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

  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
  } catch (err) {
    throw err
  }

  const store = getStore()
  if (store[month]) {
    store[month] = store[month].filter(t => t.id !== id)
    setStore(store)
  }
}

export async function getTransactionTotals(month) {
  const txs = await listTransactions(month)
  const { listCategories, groupByParent, getCategoryMap } = await import('../services/categoryService')
  const categories = await listCategories()
  const categoryMap = getCategoryMap(categories)
  
  const detailedTotals = {}
  for (const tx of txs) {
    if (!detailedTotals[tx.category]) detailedTotals[tx.category] = 0
    detailedTotals[tx.category] += Number(tx.amount) || 0
  }
  
  return groupByParent(detailedTotals, categoryMap)
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

  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('source', source)
    if (error) throw error
  } catch (err) {
    throw err
  }

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

  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', user.id)
      .eq('month', month)
    if (error) throw error
  } catch (err) {
    throw err
  }

  const store = getStore()
  store[month] = []
  setStore(store)
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
