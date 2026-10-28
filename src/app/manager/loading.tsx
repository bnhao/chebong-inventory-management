export default function ManagerLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
            <div className="h-3 w-20 bg-gray-200 rounded-md" />
            <div className="h-7 w-28 bg-gray-200 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <div className="h-24 bg-amber-50/70 border border-amber-100 rounded-2xl" />
          <div className="h-24 bg-red-50/70 border border-red-100 rounded-2xl" />
          <div className="h-44 bg-white border border-gray-100 rounded-2xl" />
        </div>
        <div className="lg:col-span-5">
          <div className="h-96 bg-white border border-gray-100 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}

