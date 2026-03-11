import { supabase } from '../lib/supabaseClient'

const LS_KEY = 'financial_goals'

function getStore() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || []
  } catch {
    return []
  }
}

function setStore(goals) {
  localStorage.setItem(LS_KEY, JSON.stringify(goals))
}

async function getUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

export async function listGoals() {
  const user = await getUser()
  if (!user) return getStore()

  try {
    const { data, error } = await supabase
      .from('financial_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (error) throw error

    const goals = data || []
    setStore(goals)
    return goals
  } catch {
    return getStore()
  }
}

export async function upsertGoal({ id, name, target_amount, current_amount, deadline, icon, color, active }) {
  const payload = {
    name,
    target_amount: Number(target_amount) || 0,
    current_amount: Number(current_amount) || 0,
    deadline: deadline || null,
    icon: icon || '🎯',
    color: color || 'indigo',
    active: active !== false,
    updated_at: new Date().toISOString(),
  }

  const user = await getUser()

  if (!user) {
    const store = getStore()
    if (id) {
      const idx = store.findIndex(g => g.id === id)
      if (idx >= 0) {
        store[idx] = { ...store[idx], ...payload }
        setStore(store)
        return store[idx]
      }
    }
    const entry = { id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() }
    store.push(entry)
    setStore(store)
    return entry
  }

  if (id) {
    const { data, error } = await supabase
      .from('financial_goals')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) throw error
    const store = getStore()
    const idx = store.findIndex(g => g.id === id)
    if (idx >= 0) store[idx] = data; else store.push(data)
    setStore(store)
    return data
  }

  const { data, error } = await supabase
    .from('financial_goals')
    .insert({ user_id: user.id, ...payload })
    .select()
    .single()
  if (error) throw error
  const store = getStore()
  store.push(data)
  setStore(store)
  return data
}

export async function deleteGoal(id) {
  const user = await getUser()

  if (!user) {
    const store = getStore().filter(g => g.id !== id)
    setStore(store)
    return
  }

  const { error } = await supabase
    .from('financial_goals')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw error

  const store = getStore().filter(g => g.id !== id)
  setStore(store)
}

export const GOAL_ICONS = ['🎯', '💰', '🏠', '🚗', '✈️', '📚', '💻', '🛡️', '🎓', '❤️']
export const GOAL_COLORS = ['indigo', 'emerald', 'violet', 'rose', 'amber', 'cyan', 'blue', 'orange']
