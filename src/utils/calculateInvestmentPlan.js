import { addMonths, differenceInMonths, format, parseISO, startOfMonth } from 'date-fns'

function round2(v) {
  return Math.round(v * 100) / 100
}

export function calculateInvestmentPlan({
  targetAmount,
  targetDate,
  now = new Date(),
  investmentsActual = [],
  monthlyOverrides = {},
  minPerMonth = 0,
  maxPerMonth = Infinity,
}) {
  if (!targetAmount || !targetDate) {
    return {
      status: 'empty', percent: 0, totalReal: 0, remaining: 0,
      monthsRemaining: 0, recommendedPerMonth: 0, nextMonthSuggestion: 0,
      schedule: [], warnings: [],
    }
  }

  const warnings = []
  const tgtAmt = round2(Number(targetAmount))

  const actualMap = new Map()
  let totalReal = 0
  for (const { month, amount } of investmentsActual) {
    const amt = round2(Number(amount) || 0)
    actualMap.set(month, (actualMap.get(month) || 0) + amt)
    totalReal += amt
  }
  totalReal = round2(totalReal)

  const remaining = round2(Math.max(tgtAmt - totalReal, 0))
  const percent = tgtAmt > 0 ? round2((totalReal / tgtAmt) * 100) : 0

  const nowStart = startOfMonth(now)
  const currentKey = format(nowStart, 'yyyy-MM')

  const targetParsed = typeof targetDate === 'string' ? parseISO(targetDate) : targetDate
  const targetKey = format(startOfMonth(targetParsed), 'yyyy-MM')

  const monthsRemaining = Math.max(
    0,
    differenceInMonths(parseISO(targetKey + '-01'), nowStart) + 1,
  )

  let status = 'active'
  if (tgtAmt - totalReal <= 0) status = 'completed'
  else if (monthsRemaining <= 0) status = 'overdue'

  // Month range for the schedule
  const actualKeys = [...actualMap.keys()].sort()
  const rangeStart = actualKeys.length > 0 && actualKeys[0] < currentKey
    ? actualKeys[0]
    : currentKey
  const rangeEnd = targetKey >= currentKey ? targetKey : currentKey
  const lastActual = actualKeys.length > 0 ? actualKeys[actualKeys.length - 1] : currentKey
  const finalEnd = rangeEnd > lastActual ? rangeEnd : lastActual

  const allMonths = []
  let cursor = parseISO(rangeStart + '-01')
  const endDate = parseISO(finalEnd + '-01')
  while (cursor <= endDate) {
    allMonths.push(format(cursor, 'yyyy-MM'))
    cursor = addMonths(cursor, 1)
  }

  // Future months that still need planning (no actual investment)
  const futureUnfilled = allMonths.filter(
    m => m >= currentKey && m <= targetKey && !actualMap.has(m),
  )

  // Base recommended per month
  let baseRec = 0
  if (status === 'active' && futureUnfilled.length > 0) {
    baseRec = round2(remaining / futureUnfilled.length)
  } else if (status === 'overdue') {
    baseRec = remaining
  }

  const cMin = Math.max(0, Number(minPerMonth) || 0)
  const cMax = isFinite(maxPerMonth) && maxPerMonth > 0 ? Number(maxPerMonth) : Infinity
  const clampedRec = round2(Math.min(Math.max(baseRec, cMin), cMax))

  if (status === 'active' && isFinite(cMax) && clampedRec * futureUnfilled.length < remaining - 0.01) {
    warnings.push('Com esse limite máximo, você não atingirá a meta no prazo.')
  }

  // Handle user overrides
  const validOverrides = new Map()
  let overrideSum = 0
  for (const m of futureUnfilled) {
    if (m in monthlyOverrides && monthlyOverrides[m] != null) {
      const val = round2(Number(monthlyOverrides[m]) || 0)
      validOverrides.set(m, val)
      overrideSum += val
    }
  }

  const freeMonths = futureUnfilled.filter(m => !validOverrides.has(m))
  const leftAfterOverrides = Math.max(0, remaining - overrideSum)
  let freePlanned = freeMonths.length > 0
    ? round2(leftAfterOverrides / freeMonths.length)
    : 0
  freePlanned = round2(Math.min(Math.max(freePlanned, cMin), cMax))

  // Build schedule
  let runningTotal = 0
  const schedule = allMonths.map(month => {
    const actual = actualMap.get(month) || 0
    const _isPast = month < currentKey
    const inRange = month >= currentKey && month <= targetKey
    const isUnfilled = inRange && !actualMap.has(month)

    const recommended = inRange && status !== 'completed' ? clampedRec : 0

    let planned = 0
    if (isUnfilled && status === 'active') {
      planned = validOverrides.has(month) ? validOverrides.get(month) : freePlanned
    } else {
      planned = actual
    }

    if (actual > 0) {
      runningTotal += actual
    } else if (isUnfilled) {
      runningTotal += planned
    }

    const gap = actual > 0 && recommended > 0 ? round2(actual - recommended) : 0
    const projectedTotal = round2(runningTotal)
    const pct = tgtAmt > 0 ? round2((projectedTotal / tgtAmt) * 100) : 0

    return {
      month,
      recommended: round2(recommended),
      planned: round2(planned),
      actual: round2(actual),
      gap,
      projectedTotal,
      percent: pct,
      editable: isUnfilled && status === 'active',
    }
  })

  const currentEntry = schedule.find(s => s.month === currentKey)
  const nextSuggestion = currentEntry
    ? (currentEntry.editable ? currentEntry.planned : clampedRec)
    : clampedRec

  return {
    status,
    percent,
    totalReal,
    remaining,
    monthsRemaining,
    recommendedPerMonth: clampedRec,
    nextMonthSuggestion: round2(nextSuggestion),
    schedule,
    warnings,
  }
}
