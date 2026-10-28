import TopBar from '@/components/TopBar'
import BottomNav from '@/components/BottomNav'
import Footer from '@/components/Footer'

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50/70 text-gray-900 flex flex-col justify-between">
      <div>
        {/* Universal Sticky TopBar */}
        <TopBar />

        {/* Responsive Main Container: Full width on mobile, max-w-7xl on desktop */}
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <main className="pb-24 md:pb-8 min-h-[calc(100vh-14rem)]">
            {children}
          </main>
        </div>
      </div>

      {/* Credit Footer */}
      <Footer />

      {/* Bottom Nav: Only visible on mobile, hidden on tablet/desktop */}
      <BottomNav />
    </div>
  )
}
