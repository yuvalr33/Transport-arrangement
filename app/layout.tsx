import type { Metadata } from 'next'
import { Heebo } from 'next/font/google'
import './globals.css'

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'סידור קווי הפצה — ינאי בתי צמיחה',
  description: 'מערכת תכנון קווי הפצה — ינאי בתי צמיחה',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} font-heebo bg-base text-slate-200 antialiased`}>
        {children}
      </body>
    </html>
  )
}
