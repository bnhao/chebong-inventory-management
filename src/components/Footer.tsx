import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="w-full border-t border-gray-200/80 bg-white/80 backdrop-blur-md py-6 mt-12 mb-16 md:mb-0 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3">
          <div className="relative h-6 w-6 flex items-center shrink-0">
            <Image
              src="/chebong-bowl.png"
              alt="CB Inventory Logo"
              fill
              className="object-contain logo-drop-shadow"
            />
          </div>
          <span className="font-semibold text-gray-700">CB Inventory</span>
          <span className="text-gray-300">•</span>
          <span className="text-gray-500 inline-flex items-center gap-1.5">
            Developed by{' '}
            <span className="font-bold text-[#e85d04] bg-orange-50/90 border border-orange-200/70 px-2 py-0.5 rounded-md shadow-2xs">
              Cleverstock
            </span>
          </span>
          <span className="text-gray-300">•</span>
          <span className="text-gray-400">© Cleverstock 2026</span>
        </div>
        <p className="text-[11px] text-gray-400">
          Mobile-First & Desktop Adaptive POS Inventory Suite
        </p>
      </div>
    </footer>
  )
}

