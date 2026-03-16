import { supabase } from '../lib/supabaseClient'

const LS_KEY = 'user_categories'

function getStore() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || []
  } catch {
    return []
  }
}

function setStore(cats) {
  localStorage.setItem(LS_KEY, JSON.stringify(cats))
}

async function getUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

export const DEFAULT_CATEGORIES = [
  { key: 'receita', label: 'Receitas', color: 'emerald', parent_category: 'receita', icon: '💰', is_default: true, sort_order: 0, income_type: 'recurring' },
  { key: 'salario', label: 'Salário', color: 'emerald', parent_category: 'receita', icon: '💵', is_default: true, sort_order: 1, income_type: 'recurring' },
  { key: 'extraordinario', label: 'Entrada Extraordinária', color: 'cyan', parent_category: 'receita', icon: '⭐', is_default: true, sort_order: 2, income_type: 'extraordinary' },
  { key: 'reserva_uso', label: 'Uso da Reserva', color: 'violet', parent_category: 'receita', icon: '🏦', is_default: true, sort_order: 3, income_type: 'reserve' },
  { key: 'fixas', label: 'Contas Fixas', color: 'rose', parent_category: 'fixas', icon: '🏠', is_default: true, sort_order: 4 },
  { key: 'cartao', label: 'Cartão', color: 'orange', parent_category: 'cartao', icon: '💳', is_default: true, sort_order: 5 },
  { key: 'compras', label: 'Compras/Gastos Diários', color: 'amber', parent_category: 'cartao', icon: '🛒', is_default: true, sort_order: 6 },
  { key: 'invest', label: 'Investimentos', color: 'indigo', parent_category: 'invest', icon: '📈', is_default: true, sort_order: 7 },
]

export const AVAILABLE_COLORS = [
  { key: 'rose', bg: '#f43f5e', label: 'Rosa' },
  { key: 'orange', bg: '#f97316', label: 'Laranja' },
  { key: 'amber', bg: '#f59e0b', label: 'Âmbar' },
  { key: 'emerald', bg: '#10b981', label: 'Verde' },
  { key: 'teal', bg: '#14b8a6', label: 'Teal' },
  { key: 'cyan', bg: '#06b6d4', label: 'Ciano' },
  { key: 'indigo', bg: '#6366f1', label: 'Índigo' },
  { key: 'violet', bg: '#8b5cf6', label: 'Violeta' },
  { key: 'pink', bg: '#ec4899', label: 'Pink' },
  { key: 'lime', bg: '#84cc16', label: 'Lima' },
  { key: 'sky', bg: '#0ea5e9', label: 'Azul' },
  { key: 'red', bg: '#ef4444', label: 'Vermelho' },
]

export const COLOR_MAP = Object.fromEntries(AVAILABLE_COLORS.map(c => [c.key, c.bg]))

export function slugify(text) {
  if (text == null || typeof text !== 'string') return ''
  const trimmed = text.trim()
  if (!trimmed) return ''
  return trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 30)
}

async function seedDefaults(user) {
  const rows = DEFAULT_CATEGORIES.map(c => ({
    user_id: user.id,
    key: c.key,
    label: c.label,
    color: c.color,
    parent_category: c.parent_category,
    icon: c.icon,
    is_default: true,
    sort_order: c.sort_order,
    income_type: c.income_type || null,
  }))

  try {
    const { data, error } = await supabase
      .from('user_categories')
      .insert(rows)
      .select()
    if (error) throw error
    setStore(data)
    return data
  } catch {
    const fallback = DEFAULT_CATEGORIES.map(c => ({
      id: crypto.randomUUID(),
      ...c,
      created_at: new Date().toISOString(),
    }))
    setStore(fallback)
    return fallback
  }
}

async function ensureBuiltinCategories(existingCats, user) {
  const existingKeys = new Set(existingCats.map(c => c.key))
  const missing = DEFAULT_CATEGORIES.filter(c => !existingKeys.has(c.key))
  if (missing.length === 0) return existingCats

  const added = []
  for (const cat of missing) {
    if (user) {
      try {
        const { data, error } = await supabase
          .from('user_categories')
          .insert({ user_id: user.id, key: cat.key, label: cat.label, color: cat.color, parent_category: cat.parent_category, icon: cat.icon, is_default: true, sort_order: cat.sort_order, income_type: cat.income_type || null })
          .select()
          .single()
        if (!error && data) added.push(data)
      } catch { /* ignore */ }
    } else {
      added.push({ id: crypto.randomUUID(), ...cat, created_at: new Date().toISOString() })
    }
  }

  const result = [...existingCats, ...added]
  setStore(result)
  return result
}

export async function listCategories() {
  const user = await getUser()

  if (!user) {
    const stored = getStore()
    if (stored.length > 0) return ensureBuiltinCategories(stored, null)
    const fallback = DEFAULT_CATEGORIES.map(c => ({
      id: crypto.randomUUID(),
      ...c,
      created_at: new Date().toISOString(),
    }))
    setStore(fallback)
    return fallback
  }

  try {
    const { data, error } = await supabase
      .from('user_categories')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true })

    if (error) throw error

    if (!data || data.length === 0) {
      return await seedDefaults(user)
    }

    const withBuiltins = await ensureBuiltinCategories(data, user)
    setStore(withBuiltins)
    return withBuiltins
  } catch {
    // Com usuário logado, não usar cache (pode ser de outro usuário); retornar só padrões
    const fallback = DEFAULT_CATEGORIES.map(c => ({
      id: crypto.randomUUID(),
      ...c,
      created_at: new Date().toISOString(),
    }))
    setStore(fallback)
    return fallback
  }
}

export async function upsertCategory({ id, key, label, color, parent_category, icon, sort_order }) {
  const catKey = key || slugify(label)
  const payload = {
    key: catKey,
    label,
    color,
    parent_category,
    icon: icon || '',
    is_default: false,
    sort_order: sort_order ?? 99,
  }

  const user = await getUser()

  if (!user) {
    const stored = getStore()
    if (id) {
      const idx = stored.findIndex(c => c.id === id)
      if (idx !== -1) stored[idx] = { ...stored[idx], ...payload }
    } else {
      stored.push({ id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() })
    }
    setStore(stored)
    return stored.find(c => c.key === catKey) || stored[stored.length - 1]
  }

  try {
    if (id) {
      const { data, error } = await supabase
        .from('user_categories')
        .update(payload)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()
      if (error) throw error
      const stored = getStore()
      const idx = stored.findIndex(c => c.id === id)
      if (idx !== -1) stored[idx] = data
      else stored.push(data)
      setStore(stored)
      return data
    } else {
      const { data, error } = await supabase
        .from('user_categories')
        .insert({ user_id: user.id, ...payload })
        .select()
        .single()
      if (error) throw error
      const stored = getStore()
      stored.push(data)
      setStore(stored)
      return data
    }
  } catch (err) {
    const stored = getStore()
    if (id) {
      const idx = stored.findIndex(c => c.id === id)
      if (idx !== -1) stored[idx] = { ...stored[idx], ...payload }
    } else {
      stored.push({ id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() })
    }
    setStore(stored)
    throw err
  }
}

export async function deleteCategory(id) {
  const stored = getStore()
  const cat = stored.find(c => c.id === id)
  if (cat?.is_default) throw new Error('Não é possível excluir categorias padrão.')

  const user = await getUser()

  if (!user) {
    setStore(stored.filter(c => c.id !== id))
    return
  }

  if (cat) {
    await supabase
      .from('transactions')
      .update({ category: cat.parent_category })
      .eq('user_id', user.id)
      .eq('category', cat.key)
  }

  const { error } = await supabase
    .from('user_categories')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw error

  setStore(stored.filter(c => c.id !== id))
}

export function getCategoryMap(categories) {
  const map = new Map()
  for (const c of categories) {
    map.set(c.key, { label: c.label, color: c.color, parent_category: c.parent_category, icon: c.icon, is_default: c.is_default, income_type: c.income_type || null })
  }
  return map
}

export function groupByParent(totalsPerCategory, categoryMap) {
  const result = { receita: 0, fixas: 0, cartao: 0, invest: 0 }
  for (const [key, amount] of Object.entries(totalsPerCategory)) {
    const cat = categoryMap.get(key)
    const parent = cat ? cat.parent_category : key
    if (parent in result) {
      result[parent] += Number(amount) || 0
    }
  }
  return result
}
