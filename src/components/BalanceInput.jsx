import { useState, useEffect, useRef } from 'react'

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function formatUpdatedAt(isoStr) {
  if (!isoStr) return null
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return null
  }
}

function InlineBalanceField({ icon, label, hint, value, updatedAt, onSave, onClear, accentColor = 'indigo' }) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState(() => (value != null ? String(value) : ''))
  const inputRef = useRef(null)

  const startEditing = () => {
    setInputValue(value != null ? String(value) : '')
    setEditing(true)
  }

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  const handleSave = () => {
    const trimmed = inputValue.trim()
    if (trimmed === '' || trimmed === '0') {
      onClear()
      setInputValue('')
      setEditing(false)
      return
    }
    const num = parseFloat(trimmed)
    if (!isNaN(num) && num > 0) {
      onSave(num)
    }
    setEditing(false)
  }

  const handleClearClick = () => {
    onClear()
    setInputValue('')
    setEditing(false)
  }

  const hasValue = value != null && value > 0
  const dateLabel = formatUpdatedAt(updatedAt)

  const colorMap = {
    indigo: { border: 'border-indigo-300 dark:border-indigo-700', ring: 'focus:ring-indigo-400', btn: 'bg-indigo-600 hover:bg-indigo-700', text: 'text-indigo-600 dark:text-indigo-400', hoverText: 'group-hover:text-indigo-500 dark:group-hover:text-indigo-400', hoverIcon: 'group-hover:text-indigo-400' },
    violet: { border: 'border-violet-300 dark:border-violet-700', ring: 'focus:ring-violet-400', btn: 'bg-violet-600 hover:bg-violet-700', text: 'text-violet-600 dark:text-violet-400', hoverText: 'group-hover:text-violet-500 dark:group-hover:text-violet-400', hoverIcon: 'group-hover:text-violet-400' },
    rose: { border: 'border-rose-300 dark:border-rose-700', ring: 'focus:ring-rose-400', btn: 'bg-rose-600 hover:bg-rose-700', text: 'text-rose-600 dark:text-rose-400', hoverText: 'group-hover:text-rose-500 dark:group-hover:text-rose-400', hoverIcon: 'group-hover:text-rose-400' },
  }
  const c = colorMap[accentColor] || colorMap.indigo

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{icon}</span>
          <h3 className="text-[11px] sm:text-xs font-semibold text-gray-600 dark:text-gray-400">{label}</h3>
        </div>
        {hasValue && !editing && (
          <button
            onClick={handleClearClick}
            className="text-[10px] text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors cursor-pointer"
          >
            Limpar
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400 dark:text-gray-500">R$</span>
            <input
              ref={inputRef}
              type="number"
              step="0.01"
              min="0"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
              className={`w-full pl-9 pr-3 py-2 rounded-xl border ${c.border} text-sm font-medium bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 ${c.ring} transition-shadow`}
              placeholder="0,00"
            />
          </div>
          <button onClick={handleSave} className={`px-3 py-2 text-xs font-medium text-white ${c.btn} rounded-xl transition-colors cursor-pointer shrink-0`}>
            Salvar
          </button>
          <button onClick={() => setEditing(false)} className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer shrink-0">
            Cancelar
          </button>
        </div>
      ) : (
        <button onClick={startEditing} className="w-full text-left cursor-pointer group">
          {hasValue ? (
            <div>
              <p className={`text-base sm:text-lg font-bold ${c.text} transition-colors`}>{BRL(value)}</p>
              {dateLabel && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Atualizado em {dateLabel}</p>}
            </div>
          ) : (
            <div className="flex items-center gap-2 py-1">
              <span className={`text-xs text-gray-400 dark:text-gray-500 ${c.hoverText} transition-colors`}>{hint}</span>
              <svg className={`w-3.5 h-3.5 text-gray-300 dark:text-gray-600 ${c.hoverIcon} transition-colors`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
          )}
        </button>
      )}
    </div>
  )
}

export default function BalanceInput({ value, updatedAt, onSave, reserveTotal, onSaveReserve, reserveTransferred, onSaveReserveTransferred }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <InlineBalanceField
          icon="🏦"
          label="Saldo da conta"
          hint="Informar saldo real"
          value={value}
          updatedAt={updatedAt}
          onSave={(v) => onSave(v)}
          onClear={() => onSave(null)}
          accentColor="indigo"
        />
        <InlineBalanceField
          icon="🛡️"
          label="Fundo de reserva"
          hint="Fundo de emergência; não conta como disponível para gastos"
          value={reserveTotal}
          updatedAt={null}
          onSave={(v) => onSaveReserve(v)}
          onClear={() => onSaveReserve(null)}
          accentColor="violet"
        />
        <InlineBalanceField
          icon="💸"
          label="Transferido da reserva"
          hint="Quanto já usou da reserva"
          value={reserveTransferred}
          updatedAt={null}
          onSave={(v) => onSaveReserveTransferred(v)}
          onClear={() => onSaveReserveTransferred(null)}
          accentColor="rose"
        />
      </div>
    </div>
  )
}
