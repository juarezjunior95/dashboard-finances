import { useCallback, useEffect, useState } from 'react'
import {
  listCategories,
  upsertCategory,
  deleteCategory,
  AVAILABLE_COLORS,
  slugify,
} from '../services/categoryService'
import { useToast } from '../contexts/ToastContext'
import ConfirmModal from './ConfirmModal'

const PARENTS = [
  { key: 'receita', label: 'Receita', icon: '💰' },
  { key: 'fixas', label: 'Contas Fixas', icon: '🏠' },
  { key: 'cartao', label: 'Cartão', icon: '💳' },
  { key: 'invest', label: 'Investimentos', icon: '📈' },
]

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {AVAILABLE_COLORS.map(c => (
        <button
          key={c.key}
          type="button"
          onClick={() => onChange(c.key)}
          title={c.label}
          className={`w-5 h-5 rounded-full border-2 transition-all cursor-pointer ${
            value === c.key ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent hover:border-gray-400'
          }`}
          style={{ backgroundColor: c.bg }}
        />
      ))}
    </div>
  )
}

function CategoryForm({ parentKey, initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    label: initial?.label || '',
    icon: initial?.icon || '',
    color: initial?.color || 'rose',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.label.trim()) return
    onSave({
      key: initial?.key || slugify(form.label),
      label: form.label.trim(),
      icon: form.icon.trim().slice(0, 2),
      color: form.color,
      parent_category: parentKey,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex gap-2">
        <div className="w-14">
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Emoji</label>
          <input type="text" maxLength={2} value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))}
            placeholder="🏷️"
            className="w-full px-2 py-1.5 text-xs text-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Nome *</label>
          <input type="text" value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
            placeholder="Ex: Aluguel"
            className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Cor</label>
        <ColorPicker value={form.color} onChange={c => setForm(p => ({ ...p, color: c }))} />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving || !form.label.trim()}
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

export default function CategoryManager({ onCategoriesChanged }) {
  const { showToast } = useToast()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingFor, setAddingFor] = useState(null)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await listCategories()
      setCategories(data)
    } catch {
      showToast({ type: 'error', message: 'Erro ao carregar categorias.' })
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  const notifyChanged = useCallback(async () => {
    const data = await listCategories()
    setCategories(data)
    onCategoriesChanged?.(data)
  }, [onCategoriesChanged])

  const handleSaveNew = useCallback(async (formData) => {
    setSaving(true)
    try {
      await upsertCategory(formData)
      setAddingFor(null)
      await notifyChanged()
    } catch {
      showToast({ type: 'error', message: 'Erro ao criar subcategoria.' })
    } finally {
      setSaving(false)
    }
  }, [notifyChanged, showToast])

  const handleSaveEdit = useCallback(async (formData) => {
    setSaving(true)
    try {
      await upsertCategory({ id: editId, ...formData })
      setEditId(null)
      await notifyChanged()
    } catch {
      showToast({ type: 'error', message: 'Erro ao atualizar subcategoria.' })
    } finally {
      setSaving(false)
    }
  }, [editId, notifyChanged, showToast])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    try {
      await deleteCategory(deleteTarget.id)
      setDeleteTarget(null)
      await notifyChanged()
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Erro ao excluir subcategoria.' })
    }
  }, [deleteTarget, notifyChanged, showToast])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 bg-gray-100 dark:bg-gray-800/50 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {PARENTS.map(parent => {
        const subs = categories.filter(c => c.parent_category === parent.key)
        const defaultCat = subs.find(c => c.is_default)
        const customs = subs.filter(c => !c.is_default)

        return (
          <div key={parent.key} className="space-y-2">
            {/* Section header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{parent.icon}</span>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{parent.label}</span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                  ({subs.length})
                </span>
              </div>
              <button
                onClick={() => { setAddingFor(parent.key); setEditId(null) }}
                className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 cursor-pointer flex items-center gap-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Adicionar
              </button>
            </div>

            {/* Default category */}
            {defaultCat && (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/30">
                <span className="text-sm">{defaultCat.icon}</span>
                <span className="text-xs text-gray-700 dark:text-gray-300 font-medium flex-1">{defaultCat.label}</span>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  Padrão
                </span>
              </div>
            )}

            {/* Custom subcategories */}
            {customs.map(cat => {
              if (editId === cat.id) {
                return (
                  <CategoryForm
                    key={cat.id}
                    parentKey={parent.key}
                    initial={cat}
                    onSave={handleSaveEdit}
                    onCancel={() => setEditId(null)}
                    saving={saving}
                  />
                )
              }

              const colorBg = AVAILABLE_COLORS.find(c => c.key === cat.color)?.bg || '#6b7280'

              return (
                <div key={cat.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <span className="text-sm">{cat.icon || '🏷️'}</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium flex-1">{cat.label}</span>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colorBg }} />
                  <button onClick={() => { setEditId(cat.id); setAddingFor(null) }}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer" title="Editar">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={() => setDeleteTarget(cat)}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer" title="Excluir">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              )
            })}

            {/* Empty hint */}
            {customs.length === 0 && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 px-2">
                Adicione subcategorias para detalhar seus gastos
              </p>
            )}

            {/* Add form */}
            {addingFor === parent.key && (
              <CategoryForm
                parentKey={parent.key}
                onSave={handleSaveNew}
                onCancel={() => setAddingFor(null)}
                saving={saving}
              />
            )}
          </div>
        )
      })}

      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir categoria"
        message={deleteTarget ? `Excluir categoria "${deleteTarget.label}"? As transações desta categoria serão movidas para "${PARENTS.find(p => p.key === deleteTarget.parent_category)?.label || deleteTarget.parent_category}".` : ''}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
