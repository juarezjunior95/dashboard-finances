export default function DarkToggle({ dark, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      className="relative w-14 h-7 rounded-full cursor-pointer
        bg-gray-200 dark:bg-gray-700
        transition-colors duration-300
        focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2
        dark:focus:ring-offset-gray-900"
    >
      <span
        className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full
          bg-white shadow-md
          flex items-center justify-center text-sm
          transition-transform duration-300
          ${dark ? 'translate-x-7' : 'translate-x-0'}`}
      >
        {dark ? '🌙' : '☀️'}
      </span>
    </button>
  )
}
