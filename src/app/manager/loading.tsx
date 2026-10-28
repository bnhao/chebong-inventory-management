import Image from 'next/image'

export default function ManagerLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-4">
      <div className="relative h-14 w-44 animate-pulse">
        <Image
          src="/chebong-logo.png"
          alt="Chè Bông Logo"
          fill
          className="object-contain"
          priority
        />
      </div>
      <div className="w-36 h-1.5 bg-orange-100 rounded-full overflow-hidden">
        <div className="w-full h-full bg-[#e85d04] rounded-full animate-pulse" />
      </div>
      <p className="text-xs font-semibold text-gray-400 tracking-wide">
        Loading manager control center...
      </p>
    </div>
  )
}

