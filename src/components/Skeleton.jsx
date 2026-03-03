function Bone({ className = '' }) {
  return <div className={`bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse ${className}`} />
}

export function SkeletonKpiCard() {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-3 sm:p-5 space-y-2">
      <Bone className="h-3 w-20" />
      <Bone className="h-6 sm:h-8 w-32" />
      <Bone className="h-3 w-24" />
      <Bone className="h-1.5 w-full mt-1" />
      <Bone className="h-3 w-28" />
    </div>
  )
}

export function SkeletonInputCard() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-4">
      <Bone className="h-4 w-28" />
      <div className="space-y-3">
        <Bone className="h-10 w-full rounded-xl" />
        <Bone className="h-10 w-full rounded-xl" />
      </div>
    </div>
  )
}

export function SkeletonChart() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-3">
      <Bone className="h-4 w-36" />
      <Bone className="h-[280px] md:h-[360px] w-full rounded-xl" />
    </div>
  )
}

export function SkeletonBudgetProgress() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-4">
      <Bone className="h-4 w-36" />
      {[1, 2, 3].map(i => (
        <div key={i} className="space-y-2">
          <div className="flex items-center justify-between">
            <Bone className="h-3 w-24" />
            <Bone className="h-7 w-28 rounded-lg" />
          </div>
          <Bone className="h-2.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonInvestmentPlanner() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-4">
      <Bone className="h-4 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Bone className="h-10 w-full rounded-xl" />
        <Bone className="h-10 w-full rounded-xl" />
        <Bone className="h-10 w-full rounded-xl" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 space-y-2">
            <Bone className="h-3 w-16" />
            <Bone className="h-5 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonDashboardPage() {
  return (
    <div className="space-y-4 sm:space-y-8">
      {/* Input cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <SkeletonInputCard />
        <SkeletonInputCard />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map(i => <SkeletonKpiCard key={i} />)}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <SkeletonChart />
        <SkeletonChart />
      </div>
    </div>
  )
}
