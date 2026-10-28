export default function StaffLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-32 bg-gray-200 rounded-md" />
          <div className="h-8 w-48 bg-gray-200 rounded-xl" />
        </div>
        <div className="h-10 w-10 bg-gray-200 rounded-full" />
      </div>

      {/* Alert Skeleton */}
      <div className="h-20 bg-amber-50/70 border border-amber-100 rounded-2xl" />

      {/* Quick Actions Skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-24 bg-gray-200 rounded-md" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-24 bg-gray-100 rounded-2xl" />
          <div className="h-24 bg-gray-100 rounded-2xl" />
          <div className="h-24 bg-gray-100 rounded-2xl" />
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="h-48 bg-white border border-gray-100 rounded-2xl" />
    </div>
  )
}

