import { supabase } from '../lib/supabaseClient'

function friendlyError(error) {
  const msg = error?.message ?? ''

  if (msg.includes('duplicate key') || msg.includes('unique constraint'))
    return 'Já existe um registro para este mês.'
  if (msg.includes('violates not-null'))
    return 'Preencha todos os campos obrigatórios.'
  if (msg.includes('JWT') || msg.includes('auth'))
    return 'Sessão expirada. Faça login novamente.'
  if (msg.includes('Failed to fetch') || msg.includes('network'))
    return 'Sem conexão com o servidor. Verifique sua internet.'

  return msg || 'Ocorreu um erro inesperado.'
}

function getUserId() {
  const session = supabase.auth.session?.() ?? null
  return session?.user?.id ?? null
}

// ── Goals ────────────────────────────────────────────────

export async function getGoal() {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .maybeSingle()

  if (error) throw new Error(friendlyError(error))
  return data
}

export async function upsertGoal({ title, target_amount, target_date }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from('goals')
    .upsert(
      {
        user_id: user.id,
        title,
        target_amount,
        target_date: target_date || null,
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single()

  if (error) throw new Error(friendlyError(error))
  return data
}

// ── Investments ──────────────────────────────────────────

export async function listInvestments() {
  const { data, error } = await supabase
    .from('investments')
    .select('*')
    .order('month', { ascending: true })

  if (error) throw new Error(friendlyError(error))
  return data ?? []
}

export async function upsertInvestment({ month, amount }) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('Mês inválido. Use o formato YYYY-MM (ex: 2026-03).')
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from('investments')
    .upsert(
      {
        user_id: user.id,
        month,
        amount,
      },
      { onConflict: 'user_id,month' },
    )
    .select()
    .single()

  if (error) throw new Error(friendlyError(error))
  return data
}

export async function deleteInvestment(id) {
  const { error } = await supabase
    .from('investments')
    .delete()
    .eq('id', id)

  if (error) throw new Error(friendlyError(error))
}
