import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import "@xyflow/react/dist/style.css"
import { Providers } from "./providers"
import { ThemeScript } from "@/components/theme-script"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
})

export const metadata: Metadata = {
  title: "CodeMind AI — Repository Intelligence",
  description: "AI-powered legacy codebase understanding system",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <ThemeScript />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
