import Image from 'next/image'

export default function StaffLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="relative h-10 w-10">
        <Image
          src="/chebong-bowl.png"
          alt="CB Inventory"
          fill
          className="object-contain"
          priority
        />
      </div>
      <p className="text-sm text-[#737373]">Loading inventory</p>
    </div>
  )
}
