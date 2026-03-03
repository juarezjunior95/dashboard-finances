import { useState } from 'react'

const DISMISS_KEY = 'onboarding-dismissed'

const STEPS = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
    title: 'Importe ou preencha',
    desc: 'Importe um extrato (CSV, XLSX, XML) ou preencha seus valores manualmente.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Veja seu dashboard',
    desc: 'Clique em "Aplicar" para visualizar KPIs, graficos e insights financeiros.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    title: 'Defina metas',
    desc: 'Configure limites de orcamento e metas de investimento para acompanhar.',
  },
]

export default function Welcome() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === 'true' } catch { return false }
  })

  if (dismissed) return null

  const handleStart = () => {
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, 'true')
    const target = document.getElementById('input-section')
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, 'true')
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 sm:p-8 text-center space-y-6">
      {/* Icon */}
      <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      {/* Title */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">
          Bem-vindo ao Dashboard de Financas!
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Comece em 3 passos simples para ter controle total das suas financas.
        </p>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {STEPS.map((step, i) => (
          <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2">
            <div className="mx-auto w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              {step.icon}
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              <span className="text-indigo-600 dark:text-indigo-400 mr-1">{i + 1}.</span>
              {step.title}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {step.desc}
            </p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handleStart}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          Comecar
        </button>
        <button
          onClick={handleDismiss}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
        >
          Nao mostrar novamente
        </button>
      </div>
    </div>
  )
}
