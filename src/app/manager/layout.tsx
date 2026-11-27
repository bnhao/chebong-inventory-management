import TopBar from '@/components/TopBar'
import ManagerNav from '@/components/ManagerNav'
import BottomNav from '@/components/BottomNav'
import Footer from '@/components/Footer'
import { getStoreHeaderContext } from '@/lib/timezone'

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { formattedDate } = getStoreHeaderContext(new Date())

  return (
    <div className="min-h-screen bg-app-canvas text-[#171717] flex flex-col justify-between">
      <div>
        <TopBar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-xs text-[#737373] font-mono tabular-nums">
                {formattedDate} · Manager
              </p>
              <h1 className="text-2xl sm:text-[28px] leading-[1.15] font-medium text-[#171717] tracking-[-0.015em] mt-1">
                Manager overview
              </h1>
            </div>

            <div className="hidden md:block">
              <ManagerNav />
            </div>
          </div>

          <main className="pb-24 md:pb-8 min-h-[calc(100vh-14rem)] enter-fade-up">
            {children}
          </main>
        </div>
      </div>
      <Footer />
      <BottomNav />
    </div>
  )
}
