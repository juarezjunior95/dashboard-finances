import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  listTransactions,
  upsertTransaction,
  deleteTransaction,
  getTransactionTotals,
  getDetailedTransactionTotals,
} from '../services/transactionService'
import { useToast } from '../contexts/ToastContext'
import { COLOR_MAP } from '../services/categoryService'
import ConfirmModal from './ConfirmModal'
import AiTransactionInput from './AiTransactionInput'

const FALLBACK_CATEGORIES = [
  { key: 'fixas', label: 'Contas Fixas', color: 'rose', parent_category: 'fixas' },
  { key: 'cartao', label: 'Cartão', color: 'orange', parent_category: 'cartao' },
  { key: 'invest', label: 'Investimentos', color: 'indigo', parent_category: 'invest' },
  { key: 'receita', label: 'Receita', color: 'emerald', parent_category: 'receita' },
]

function buildCatLookup(categories) {
  const map = {}
  for (const c of (categories || FALLBACK_CATEGORIES)) {
    const bg = COLOR_MAP[c.color] || '#6b7280'
    map[c.key] = {
      label: c.label,
      parent: c.parent_category,
      badge: `bg-[${bg}]/10 text-[${bg}]`,
      bgColor: bg,
    }
  }
  return map
}

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function formatDate(d) {
  if (!d) return '—'
  try {
    const date = typeof d === 'string' ? parseISO(d) : d
    return format(date, "dd MMM", { locale: ptBR })
  } catch {
    return '—'
  }
}

function valueColor(category, catLookup) {
  const info = catLookup[category]
  const parent = info?.parent || category
  if (parent === 'receita') return 'text-emerald-600 dark:text-emerald-400'
  if (parent === 'invest') return 'text-indigo-600 dark:text-indigo-400'
  return 'text-red-600 dark:text-red-400'
}

const STATUS_CYCLE = [null, 'pending', 'paid']
const STATUS_META = {
  paid:    { label: 'Pago',     cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300', icon: '✓' },
  pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300', icon: '⏳' },
  null:    { label: '—',        cls: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500', icon: '' },
}

function StatusBadge({ status, onClick }) {
  const meta = STATUS_META[status] || STATUS_META[null]
  return (
    <button
      onClick={onClick}
      title={`Status: ${meta.label}. Clique para alterar.`}
      className={`inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-semibold rounded-full cursor-pointer transition-colors hover:ring-2 hover:ring-indigo-300 dark:hover:ring-indigo-600 ${meta.cls}`}
    >
      {meta.icon && <span>{meta.icon}</span>}
      <span>{meta.label}</span>
    </button>
  )
}

const EMPTY_FORM = { date: '', description: '', category: 'fixas', amount: '' }

function TransactionForm({ initial, onSave, onCancel, saving, allCategories }) {
  const [form, setForm] = useState(() => ({
    date: initial?.date || '',
    description: initial?.description || '',
    category: initial?.category || 'fixas',
    amount: initial?.amount != null ? String(initial.amount) : '',
  }))

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) return
    onSave({
      date: form.date || null,
      description: form.description,
      category: form.category,
      amount: parseFloat(form.amount),
    })
  }

  const parents = ['receita', 'fixas', 'cartao', 'invest']
  const grouped = parents.map(p => ({
    parent: p,
    items: (allCategories || FALLBACK_CATEGORIES).filter(c => c.parent_category === p),
  }))

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 sm:gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex-1 min-w-0">
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Data</label>
        <input type="date" name="date" value={form.date} onChange={handleChange}
          className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
      </div>
      <div className="flex-[2] min-w-0">
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Descrição</label>
        <input type="text" name="description" value={form.description} onChange={handleChange} placeholder="Ex: Aluguel"
          className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
      </div>
      <div className="w-full sm:w-40">
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Categoria</label>
        <select name="category" value={form.category} onChange={handleChange}
          className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-400 focus:outline-none">
          {grouped.map(g => (
            <optgroup key={g.parent} label={g.items.find(c => c.is_default)?.label || g.parent}>
              {g.items.map(c => <option key={c.key} value={c.key}>{c.icon ? `${c.icon} ` : ''}{c.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="w-full sm:w-28">
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Valor (R$)</label>
        <input type="number" name="amount" value={form.amount} onChange={handleChange} step="0.01" min="0" placeholder="0,00"
          className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
      </div>
      <div className="flex gap-2 shrink-0">
        <button type="submit" disabled={saving || !form.amount || Number(form.amount) <= 0}
          className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed">
          {saving ? '...' : 'Salvar'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer">
          Cancelar
        </button>
      </div>
    </form>
  )
}

function MobileCard({ tx, onEdit, onDelete, onToggleStatus, catLookup }) {
  const cat = catLookup[tx.category] || catLookup.fixas || { label: tx.category, bgColor: '#6b7280' }
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full"
            style={{ backgroundColor: `${cat.bgColor}18`, color: cat.bgColor }}>
            {cat.label}
          </span>
          <StatusBadge status={tx.payment_status || null} onClick={() => onToggleStatus(tx)} />
          <span className="text-[10px] text-gray-400 dark:text-gray-500">{formatDate(tx.date)}</span>
        </div>
        <p className="text-xs text-gray-700 dark:text-gray-300 truncate" title={tx.description}>
          {tx.description || '—'}
        </p>
      </div>
      <span className={`text-sm font-bold tabular-nums shrink-0 ${valueColor(tx.category, catLookup)}`}>
        {BRL(tx.amount)}
      </span>
      <div className="flex gap-1 shrink-0">
        <button onClick={() => onEdit(tx)} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400" title="Editar">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        </button>
        <button onClick={() => onDelete(tx)} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer text-gray-400 hover:text-red-600 dark:hover:text-red-400" title="Excluir">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  )
}

const PAGE_SIZE = 50

export default function TransactionList({ month, onTotalsChanged, onDetailedTotals, categories, onStatusChange }) {
  const { showToast } = useToast()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [filterCat, setFilterCat] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const catLookup = useMemo(() => buildCatLookup(categories), [categories])
  const allCats = categories || FALLBACK_CATEGORIES

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listTransactions(month)
      setTransactions(data)
      setExpanded(prev => (prev === null ? data.length === 0 : prev))
    } catch {
      showToast({ type: 'error', message: 'Erro ao carregar transações.' })
    } finally {
      setLoading(false)
    }
  }, [month, showToast])

  useEffect(() => {
    load()
    setAdding(false)
    setEditId(null)
    setFilterCat('all')
    setFilterStatus('all')
    setSearch('')
    setVisibleCount(PAGE_SIZE)
    setExpanded(null)
  }, [month, load])

  const recalcAndNotify = useCallback(async () => {
    try {
      const totals = await getTransactionTotals(month)
      onTotalsChanged?.(totals)
      const detailed = await getDetailedTransactionTotals(month)
      onDetailedTotals?.(detailed)
    } catch {
      showToast({ type: 'error', message: 'Erro ao recalcular totais.' })
    }
  }, [month, onTotalsChanged, onDetailedTotals, showToast])

  const handleSaveNew = useCallback(async (formData) => {
    setSaving(true)
    try {
      await upsertTransaction({ month, ...formData, source: 'manual' })
      setAdding(false)
      await load()
      await recalcAndNotify()
    } catch {
      showToast({ type: 'error', message: 'Erro ao salvar transação.' })
    } finally {
      setSaving(false)
    }
  }, [month, load, recalcAndNotify, showToast])

  const handleAiConfirm = useCallback(async (parsed) => {
    try {
      await upsertTransaction({ month, ...parsed, source: 'ai' })
      await load()
      await recalcAndNotify()
      showToast({ type: 'success', message: `Transação "${parsed.description}" adicionada via IA.` })
    } catch {
      showToast({ type: 'error', message: 'Erro ao salvar transação via IA.' })
    }
  }, [month, load, recalcAndNotify, showToast])

  const handleSaveEdit = useCallback(async (formData) => {
    setSaving(true)
    try {
      await upsertTransaction({ id: editId, month, ...formData })
      setEditId(null)
      await load()
      await recalcAndNotify()
    } catch {
      showToast({ type: 'error', message: 'Erro ao atualizar transação.' })
    } finally {
      setSaving(false)
    }
  }, [editId, month, load, recalcAndNotify, showToast])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    try {
      await deleteTransaction(deleteTarget.id, month)
      setDeleteTarget(null)
      await load()
      await recalcAndNotify()
    } catch {
      showToast({ type: 'error', message: 'Erro ao excluir transação.' })
    }
  }, [deleteTarget, month, load, recalcAndNotify, showToast])

  const handleToggleStatus = useCallback(async (tx) => {
    const currentIdx = STATUS_CYCLE.indexOf(tx.payment_status || null)
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length]
    try {
      await upsertTransaction({
        id: tx.id,
        month,
        category: tx.category,
        description: tx.description,
        amount: tx.amount,
        date: tx.date,
        source: tx.source,
        payment_status: nextStatus,
      })
      setTransactions(prev => prev.map(t =>
        t.id === tx.id ? { ...t, payment_status: nextStatus } : t
      ))
      await recalcAndNotify()
      const statusLabel = STATUS_META[nextStatus]?.label || 'Sem status'
      onStatusChange?.(tx.description || tx.category, statusLabel)
    } catch {
      showToast({ type: 'error', message: 'Erro ao alterar status.' })
    }
  }, [month, recalcAndNotify, showToast, onStatusChange])

  const filtered = useMemo(() => {
    let items = transactions
    if (filterCat !== 'all') items = items.filter(t => t.category === filterCat)
    if (filterStatus !== 'all') {
      items = items.filter(t => {
        const s = t.payment_status || null
        if (filterStatus === 'unknown') return s === null
        return s === filterStatus
      })
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      items = items.filter(t => (t.description || '').toLowerCase().includes(q))
    }
    return items
  }, [transactions, filterCat, filterStatus, search])

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])

  const filteredTotals = useMemo(() => {
    const totals = { fixas: 0, cartao: 0, invest: 0, receita: 0 }
    for (const tx of filtered) {
      const info = catLookup[tx.category]
      const parent = info?.parent ?? tx.category
      if (parent in totals) totals[parent] += Number(tx.amount) || 0
    }
    return totals
  }, [filtered, catLookup])

  const totalGeral = filteredTotals.receita - filteredTotals.fixas - filteredTotals.cartao - filteredTotals.invest

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 cursor-pointer group">
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            Transações do mês
          </h2>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
            ({transactions.length} lançamento{transactions.length !== 1 ? 's' : ''})
          </span>
        </button>
        {expanded && (
          <button onClick={() => { setAdding(true); setEditId(null) }}
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Adicionar
          </button>
        )}
      </div>

      {!expanded ? null : (
        <>
          {/* Add form */}
          {adding && (
            <TransactionForm
              initial={EMPTY_FORM}
              onSave={handleSaveNew}
              onCancel={() => setAdding(false)}
              saving={saving}
              allCategories={allCats}
            />
          )}

          {/* AI Natural Language Input */}
          <AiTransactionInput onConfirm={handleAiConfirm} />

          {/* Filters */}
          {transactions.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setVisibleCount(PAGE_SIZE) }}
                  className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none">
                  <option value="all">Todas categorias</option>
                  {allCats.map(c => <option key={c.key} value={c.key}>{c.icon ? `${c.icon} ` : ''}{c.label}</option>)}
                </select>
                <div className="relative flex-1">
                  <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input type="text" value={search} onChange={e => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE) }}
                    placeholder="Buscar descrição..."
                    className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { key: 'all', label: 'Todos' },
                  { key: 'paid', label: 'Pago' },
                  { key: 'pending', label: 'Pendente' },
                  { key: 'unknown', label: 'Sem status' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setFilterStatus(opt.key); setVisibleCount(PAGE_SIZE) }}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded-full cursor-pointer transition-colors ${
                      filterStatus === opt.key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {transactions.length === 0 && !adding && (
            <div className="text-center py-8 space-y-3">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Nenhuma transação neste mês. Importe um arquivo ou adicione manualmente.
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                Problemas ao carregar?
              </p>
              <button
                type="button"
                onClick={() => load()}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer underline focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded"
              >
                Tente novamente
              </button>
            </div>
          )}

          {/* Desktop table */}
          {filtered.length > 0 && (
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                    <th className="text-left py-2 font-semibold w-20">Data</th>
                    <th className="text-left py-2 font-semibold">Descrição</th>
                    <th className="text-left py-2 font-semibold w-28">Categoria</th>
                    <th className="text-right py-2 font-semibold w-28">Valor</th>
                    <th className="text-center py-2 font-semibold w-24">Status</th>
                    <th className="text-right py-2 font-semibold w-16">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(tx => {
                    if (editId === tx.id) {
                      return (
                        <tr key={tx.id}>
                          <td colSpan={6} className="py-2">
                            <TransactionForm
                              initial={{ date: tx.date?.split('T')[0] || '', description: tx.description, category: tx.category, amount: tx.amount }}
                              onSave={handleSaveEdit}
                              onCancel={() => setEditId(null)}
                              saving={saving}
                              allCategories={allCats}
                            />
                          </td>
                        </tr>
                      )
                    }
                    const cat = catLookup[tx.category] || catLookup.fixas || { label: tx.category, bgColor: '#6b7280' }
                    return (
                      <tr key={tx.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="py-2 text-gray-500 dark:text-gray-400">{formatDate(tx.date)}</td>
                        <td className="py-2 text-gray-700 dark:text-gray-300 truncate max-w-[200px]" title={tx.description}>
                          {tx.description || '—'}
                        </td>
                        <td className="py-2">
                          <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full"
                            style={{ backgroundColor: `${cat.bgColor}18`, color: cat.bgColor }}>
                            {cat.label}
                          </span>
                        </td>
                        <td className={`py-2 text-right font-bold tabular-nums ${valueColor(tx.category, catLookup)}`}>
                          {BRL(tx.amount)}
                        </td>
                        <td className="py-2 text-center">
                          <StatusBadge status={tx.payment_status || null} onClick={() => handleToggleStatus(tx)} />
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setEditId(tx.id); setAdding(false) }}
                              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer" title="Editar">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button onClick={() => setDeleteTarget(tx)}
                              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer" title="Excluir">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile cards */}
          {filtered.length > 0 && (
            <div className="sm:hidden space-y-2">
              {visible.map(tx => {
                if (editId === tx.id) {
                  return (
                    <TransactionForm
                      key={tx.id}
                      initial={{ date: tx.date?.split('T')[0] || '', description: tx.description, category: tx.category, amount: tx.amount }}
                      onSave={handleSaveEdit}
                      onCancel={() => setEditId(null)}
                      saving={saving}
                      allCategories={allCats}
                    />
                  )
                }
                return (
                  <MobileCard
                    key={tx.id}
                    tx={tx}
                    onEdit={(t) => { setEditId(t.id); setAdding(false) }}
                    onDelete={(t) => setDeleteTarget(t)}
                    onToggleStatus={handleToggleStatus}
                    catLookup={catLookup}
                  />
                )
              })}
            </div>
          )}

          {/* Load more */}
          {filtered.length > visibleCount && (
            <div className="text-center pt-2">
              <button onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 cursor-pointer">
                Mostrar mais ({filtered.length - visibleCount} restantes)
              </button>
            </div>
          )}

          {/* Footer totals */}
          {filtered.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 border-t border-gray-100 dark:border-gray-800">
              {Object.entries(filteredTotals).filter(([, v]) => v > 0).map(([cat, val]) => {
                const info = catLookup[cat]
                if (!info) return null
                return (
                  <span key={cat} className="text-[10px] text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">{info.label}:</span> {BRL(val)}
                  </span>
                )
              })}
              <span className={`text-[10px] font-bold ml-auto ${totalGeral >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                Saldo: {BRL(totalGeral)}
              </span>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir transação"
        message="Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
