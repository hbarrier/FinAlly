import type { Metadata } from "next"
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { seed } from "@/lib/seed"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
})

export const metadata: Metadata = {
  title: "Fern — personal finances",
  description: "Your quiet place to look after your money.",
}

// Force dynamic rendering so seed() runs on real requests, not during build
export const dynamic = 'force-dynamic'

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Seed on first real request (no-op if already done)
  await seed()

  return (
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('fern-theme')==='dark'){document.documentElement.setAttribute('data-theme','dark')}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
