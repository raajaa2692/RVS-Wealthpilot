import './globals.css'
export const metadata = { title: 'RVS WealthPilot', description: 'AI investing copilot' }
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>
}
