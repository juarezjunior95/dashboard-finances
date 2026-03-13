/**
 * Chaves do localStorage que armazenam dados por usuário.
 * Como as chaves são globais (não incluem user_id), ao trocar de usuário
 * o cache do usuário anterior precisa ser limpo para não vazar dados.
 */
const USER_DATA_KEYS = [
  'transactions',
  'user_categories',
  'monthly_snapshots',
  'budgets',
  'investment_planner',
  'planner_overrides',
  'planner_limits',
  'dismissed_alerts',
  'financial_goals',
  'activity_log',
  'ai_insights_cache',
  'ai_category_cache',
  'dashboard-financas-totals', // legado
]

/**
 * Remove do localStorage todos os dados considerados do usuário logado.
 * Deve ser chamado no logout para que o próximo login não veja dados do usuário anterior.
 */
export function clearUserData() {
  try {
    for (const key of USER_DATA_KEYS) {
      localStorage.removeItem(key)
    }
  } catch {
    // Ignorar falhas (storage cheio, privado, etc.)
  }
}
