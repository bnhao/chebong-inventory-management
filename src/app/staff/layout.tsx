import TopBar from '@/components/TopBar'
import BottomNav from '@/components/BottomNav'
import Footer from '@/components/Footer'

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-app-canvas text-[#171717] flex flex-col justify-between">
      <div>
        <TopBar />
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
