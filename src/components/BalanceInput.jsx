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

export default function BalanceInput({ value, updatedAt, onSave }) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (value != null) setInputValue(String(value))
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  const handleSave = () => {
    const num = parseFloat(inputValue)
    if (!isNaN(num) && num >= 0) {
      onSave(num)
    }
    setEditing(false)
  }

  const handleClear = () => {
    onSave(null)
    setInputValue('')
    setEditing(false)
  }

  const hasValue = value != null && value > 0
  const dateLabel = formatUpdatedAt(updatedAt)

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">🏦</span>
          <h3 className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400">
            Saldo atual da conta
          </h3>
        </div>
        {hasValue && !editing && (
          <button
            onClick={handleClear}
            className="text-[10px] text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors cursor-pointer"
          >
            Limpar
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400 dark:text-gray-500">
              R$
            </span>
            <input
              ref={inputRef}
              type="number"
              step="0.01"
              min="0"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 text-sm font-medium bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-shadow"
              placeholder="0,00"
            />
          </div>
          <button
            onClick={handleSave}
            className="px-3 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            Salvar
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-full text-left cursor-pointer group"
        >
          {hasValue ? (
            <div>
              <p className="text-lg sm:text-xl font-bold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                {BRL(value)}
              </p>
              {dateLabel && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Atualizado em {dateLabel}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 py-1">
              <span className="text-sm text-gray-400 dark:text-gray-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                Clique para informar o saldo real da conta
              </span>
              <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
          )}
        </button>
      )}

      {!hasValue && !editing && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
          Sem saldo informado — usando saldo calculado como referência.
        </p>
      )}
    </div>
  )
}
