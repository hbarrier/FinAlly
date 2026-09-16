import type { Metadata } from "next"
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale } from "next-intl/server"
import { DialogsHost } from "@/lib/dialogs"
import { FormatConfigSetter } from "@/components/fern/format-config-setter"
import { getUserSettings } from "@/lib/queries/user-settings"
import "./globals.css"

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
  title: "FinAlly — personal finances",
  description: "Your quiet place to look after your money.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [locale, settings] = await Promise.all([getLocale(), getUserSettings()])
  return (
    <html lang={locale} className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('fern-theme')==='dark'){document.documentElement.setAttribute('data-theme','dark')}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full">
        <NextIntlClientProvider>
          <FormatConfigSetter locale={locale} currency={settings?.currency ?? 'EUR'} />
          {children}
          <DialogsHost />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
