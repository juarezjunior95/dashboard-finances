import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setSubmitting(true)

    try {
      if (isRegister) {
        await signUp(email, password)
        setInfo('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
        setIsRegister(false)
      } else {
        await signIn(email, password)
      }
    } catch (err) {
      const msg = err?.message || 'Erro desconhecido'
      setError(
        msg.includes('Invalid login')
          ? 'E-mail ou senha incorretos.'
          : msg.includes('already registered')
            ? 'Este e-mail já está cadastrado.'
            : msg,
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            Dashboard de Finanças
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {isRegister ? 'Crie sua conta' : 'Entre na sua conta'}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 space-y-5"
        >
          {error && (
            <div className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {info && (
            <div className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 text-sm">
              {info}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100
                placeholder-gray-300 dark:placeholder-gray-600
                text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100
                placeholder-gray-300 dark:placeholder-gray-600
                text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400
              text-white font-semibold py-2.5 rounded-xl transition-colors cursor-pointer
              disabled:cursor-not-allowed"
          >
            {submitting
              ? 'Aguarde...'
              : isRegister
                ? 'Criar conta'
                : 'Entrar'}
          </button>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            {isRegister ? 'Já tem conta?' : 'Não tem conta?'}{' '}
            <button
              type="button"
              onClick={() => {
                setIsRegister((v) => !v)
                setError('')
                setInfo('')
              }}
              className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
            >
              {isRegister ? 'Entrar' : 'Criar conta'}
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
