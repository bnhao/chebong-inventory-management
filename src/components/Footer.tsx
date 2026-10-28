export default function Footer() {
  return (
    <footer className="w-full border-t border-gray-200/80 bg-white/50 backdrop-blur-xs py-6 mt-12 mb-16 md:mb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-[#e85d04] flex items-center justify-center">
            <span className="text-white font-black text-[10px]">C</span>
          </div>
          <span className="font-semibold text-gray-700">Che Bong Inventory Management</span>
          <span>© Nguyen Hao Bui 2026</span>
        </div>
        <p className="text-[11px] text-gray-400">
          Mobile-First & Desktop Adaptive POS Inventory Suite
        </p>
      </div>
    </footer>
  )
}

