import TopBar from '@/components/TopBar'
import ManagerNav from '@/components/ManagerNav'
import BottomNav from '@/components/BottomNav'
import Footer from '@/components/Footer'

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50/70 text-gray-900 flex flex-col justify-between">
      <div>
        {/* Universal Top Header with Brand and Staff/Manager Switch */}
        <TopBar />

        {/* Main Content Area */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          {/* Manager Top Subnav Bar (hidden on mobile phone, visible on tablet/desktop) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                · Manager Portal (RBAC Authorized)
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-0.5">
                Manager Control Center
              </h1>
            </div>

            {/* Desktop Navigation Pill Group */}
            <div className="hidden md:block">
              <ManagerNav />
            </div>
          </div>

          {/* Page Content */}
          <main className="pb-24 md:pb-8 min-h-[calc(100vh-14rem)]">{children}</main>
        </div>
      </div>

      {/* Credit Footer */}
      <Footer />

      {/* Adaptive Mobile Bottom Navigation Bar */}
      <BottomNav />
    </div>
  )
}
