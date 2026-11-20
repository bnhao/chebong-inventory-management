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
  const { formattedDate, shiftLabel } = getStoreHeaderContext()

  return (
    <div className="min-h-screen bg-app-canvas text-gray-900 flex flex-col justify-between">
      <div>
        <TopBar />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 enter-fade-up">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {formattedDate} · {shiftLabel}
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-0.5">
                Store Manager
              </h1>
            </div>

            <div className="hidden md:block">
              <ManagerNav />
            </div>
          </div>

          <main className="pb-24 md:pb-8 min-h-[calc(100vh-14rem)] enter-fade-up stagger-1">
            {children}
          </main>
        </div>
      </div>

      <Footer />
      <BottomNav />
    </div>
  )
}
