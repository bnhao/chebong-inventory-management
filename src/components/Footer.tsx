import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="w-full border-t border-neutral-900/[0.08] bg-white py-6 mt-12 mb-16 md:mb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#737373]">
        <div className="flex items-center gap-2">
          <div className="relative h-5 w-5 shrink-0">
            <Image
              src="/chebong-bowl.png"
              alt="CB Inventory"
              fill
              className="object-contain"
              sizes="20px"
            />
          </div>
          <span className="font-medium text-[#525252]">CB Inventory</span>
          <span className="text-neutral-300">·</span>
          <span>Chè Bông Dessert &amp; Snacks</span>
        </div>
        <p className="text-xs text-[#737373]">Built by Cleverstock · 2026</p>
      </div>
    </footer>
  )
}
