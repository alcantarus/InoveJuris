import { JetBrains_Mono, Playfair_Display, Geist } from 'next/font/google'
import './globals.css'
import { EnvBanner } from '@/components/EnvBanner'
import { SessionMonitor } from '@/components/SessionMonitor'
import { SettingsProvider } from '@/components/providers/SettingsProvider'
import { PrivacyProvider } from '@/components/providers/PrivacyProvider'
import { GlobalSearch } from '@/components/GlobalSearch'
import { LeadsButton } from '@/components/LeadsButton'
import { Toaster } from 'sonner'
import { ResizeObserverFix } from '@/components/ResizeObserverFix'
import { GeminiLegacyCleanup } from '@/components/GeminiLegacyCleanup'
import { AuthProvider } from '@/lib/auth'
import { cookies } from 'next/headers'
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  preload: false,
})

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  preload: false,
})

export const metadata = {
  title: 'InoveJuris - Automação Jurídica',
  description: 'Sistema completo para gestão de escritórios de advocacia, processos e financeiro.',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Get environment from cookies or env var for consistent SSR
  const cookieStore = await cookies();
  const envCookie = cookieStore.get('app_env')?.value;
  const appEnv = (envCookie as any) || 'production';

  return (
    <html lang="pt-BR" className={cn(jetbrainsMono.variable, playfairDisplay.variable, "font-sans", geist.variable)} data-env={appEnv}>
      {/* A chave do Gemini nao e mais injetada no cliente. */}
      <body className="font-sans antialiased bg-slate-50 text-slate-900 overflow-x-hidden" suppressHydrationWarning>
        <GeminiLegacyCleanup />
        <ResizeObserverFix />
        <AuthProvider>
          <SettingsProvider>
            <PrivacyProvider>
              <EnvBanner />
              <SessionMonitor />
              <GlobalSearch />
              <LeadsButton />
              <Toaster position="top-right" richColors />
              {children}
            </PrivacyProvider>
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
