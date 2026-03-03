import { useState } from 'react'
import { SOURCE } from '../utils/financialRules'

const SCORE_STYLES = {
  healthy: {
    bg: 'bg-emerald-50 dark:bg-emerald-950',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-400',
    label: 'Saude Financeira: Boa',
    icon: 'check',
  },
  attention: {
    bg: 'bg-amber-50 dark:bg-amber-950',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
    label: 'Saude Financeira: Atencao',
    icon: 'alert',
  },
  critical: {
    bg: 'bg-red-50 dark:bg-red-950',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
    label: 'Saude Financeira: Critica',
    icon: 'danger',
  },
}

function ScoreIcon({ type, className = '' }) {
  if (type === 'check') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${className}`} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    )
  }
  if (type === 'alert') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${className}`} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${className}`} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  )
}

export default function FinancialInsights({ analysis }) {
  const [showHelp, setShowHelp] = useState(false)

  if (!analysis || analysis.overallScore === 'empty') return null

  const style = SCORE_STYLES[analysis.overallScore] || SCORE_STYLES.healthy

  return (
    <div className={`rounded-2xl border p-3 sm:p-4 ${style.bg} ${style.border}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ScoreIcon type={style.icon} className={style.text} />
          <span className={`text-xs sm:text-sm font-bold ${style.text}`}>
            {style.label}
          </span>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="shrink-0 w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400
              text-[9px] font-bold flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600
              transition-colors cursor-pointer"
            title="O que e a regra 50-30-20?"
          >
            ?
          </button>
        </div>
        <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 shrink-0">
          Regra 50-30-20
        </span>
      </div>

      <p className={`text-[11px] sm:text-xs mt-1.5 ${style.text} opacity-80`}>
        {analysis.overallMessage}
      </p>

      {showHelp && (
        <div className="mt-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Como funciona?</p>
          <p className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            Metodo criado pela economista <strong>Elizabeth Warren</strong> no livro <em>All Your Worth</em>.
            Divide sua renda em tres partes:
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-rose-50 dark:bg-rose-950 rounded-lg p-2">
              <p className="text-lg font-bold text-rose-600 dark:text-rose-400">50%</p>
              <p className="text-[10px] text-gray-600 dark:text-gray-400">Necessidades</p>
              <p className="text-[9px] text-gray-400 dark:text-gray-500">Moradia, contas, transporte</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-2">
              <p className="text-lg font-bold text-orange-600 dark:text-orange-400">30%</p>
              <p className="text-[10px] text-gray-600 dark:text-gray-400">Desejos</p>
              <p className="text-[9px] text-gray-400 dark:text-gray-500">Lazer, restaurantes, compras</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-950 rounded-lg p-2">
              <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">20%</p>
              <p className="text-[10px] text-gray-600 dark:text-gray-400">Investir</p>
              <p className="text-[9px] text-gray-400 dark:text-gray-500">Poupanca, reserva, metas</p>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Fonte: {SOURCE}. Recomendado por Nubank, InfoMoney, Serasa e Banco Central.
          </p>
        </div>
      )}
    </div>
  )
}
