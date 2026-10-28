import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="w-full border-t border-gray-200/80 bg-white/70 backdrop-blur-xs py-6 mt-12 mb-16 md:mb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <div className="relative h-6 w-16 flex items-center shrink-0">
            <Image
              src="/chebong-logo.png"
              alt="Chè Bông Logo"
              fill
              className="object-contain object-left"
            />
          </div>
          <span className="font-semibold text-gray-700">Che Bong Inventory Management</span>
          <span className="text-gray-400">© Nguyen Hao Bui 2026</span>
        </div>
        <p className="text-[11px] text-gray-400">
          Mobile-First & Desktop Adaptive POS Inventory Suite
        </p>
      </div>
    </footer>
  )
}

