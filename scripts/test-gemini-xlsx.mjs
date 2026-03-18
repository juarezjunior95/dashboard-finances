/**
 * Testa extração Gemini com a mesma lógica do app (XLSX → CSV → API).
 * Uso: node scripts/test-gemini-xlsx.mjs [caminho-do-xlsx]
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'
import { GoogleGenerativeAI } from '@google/generative-ai'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function loadGeminiKey() {
  const envPath = path.join(root, '.env')
  if (!fs.existsSync(envPath)) return null
  const env = fs.readFileSync(envPath, 'utf8')
  const m = env.match(/^\s*VITE_GEMINI_API_KEY\s*=\s*(.+)$/m)
  return m ? m[1].trim() : null
}

const SYSTEM_PROMPT = `Você é um extrator de dados financeiros. Sua única saída deve ser um array JSON, sem texto antes ou depois.
OUTPUT: array de objetos com "data" (YYYY-MM-DD ou null), "descricao" (string), "valor" (number, negativo=despesa), "status" ("pago"|"pendente"), "is_reserva" (boolean).
Retorne APENAS o array JSON.`

const xlsxPath =
  process.argv[2] ||
  path.join(root, 'Orçamento Mensal.xlsx - Abril 26 (1).xlsx')

const apiKey = loadGeminiKey()
if (!apiKey || apiKey === 'sua-gemini-api-key-aqui') {
  console.error('❌ VITE_GEMINI_API_KEY ausente ou placeholder no .env')
  process.exit(1)
}

if (!fs.existsSync(xlsxPath)) {
  console.error('❌ Arquivo não encontrado:', xlsxPath)
  process.exit(1)
}

const wb = XLSX.readFile(xlsxPath)
const sheet = wb.Sheets[wb.SheetNames[0]]
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
const csv = data.map((r) => (r || []).map((c) => String(c ?? '')).join(',')).join('\n')
const maxChars = 45000
const csvSend = csv.length > maxChars ? csv.slice(0, maxChars) + '\n...[truncado]' : csv

console.log('📄 Planilha:', path.basename(xlsxPath))
console.log('   Linhas:', data.length, '| CSV chars:', csv.length, csvSend !== csv ? '(truncado para API)' : '')

const genAI = new GoogleGenerativeAI(apiKey)
const model = genAI.getGenerativeModel({
  model: 'gemini-flash-latest',
  systemInstruction: SYSTEM_PROMPT,
})

try {
  const result = await model.generateContent([
    {
      text:
        'Extraia todos os lançamentos financeiros do CSV abaixo e retorne apenas o array JSON.\n\n' +
        csvSend,
    },
  ])
  const raw = result.response.text()?.trim() || ''
  let items
  try {
    const clean = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    items = JSON.parse(clean)
  } catch {
    const match = raw.match(/\[[\s\S]*\]/)
    items = match ? JSON.parse(match[0]) : null
  }
  if (!items) throw new Error('JSON inválido na resposta')
  if (!Array.isArray(items)) items = [items]
  console.log('\n✅ Gemini respondeu OK. Lançamentos extraídos:', items.length)
  console.log('   Primeiros 5:', JSON.stringify(items.slice(0, 5), null, 2))
} catch (e) {
  console.error('\n❌ Erro na API Gemini:', e.message || e)
  process.exit(1)
}
