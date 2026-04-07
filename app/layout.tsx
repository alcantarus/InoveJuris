import { Inter, JetBrains_Mono, Playfair_Display, Geist } from 'next/font/google'
import './globals.css'
import { EnvBanner } from '@/components/EnvBanner'
import { SessionMonitor } from '@/components/SessionMonitor'
import { SettingsProvider } from '@/components/providers/SettingsProvider';
import { PrivacyProvider } from '@/components/providers/PrivacyProvider';
import { OrganizationProvider } from '@/components/providers/OrganizationProvider';
import { GlobalSearch } from '@/components/GlobalSearch'
import { Toaster } from 'sonner'
import { ResizeObserverFix } from '@/components/ResizeObserverFix'
import { cookies } from 'next/headers'
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
})

export const metadata = {
  title: 'InoveJuris - Automação Jurídica',
  description: 'Sistema completo para gestão de escritórios de advocacia, processos e financeiro.',
}

export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
  
  // Get environment from cookies or env var for consistent SSR
  const cookieStore = await cookies();
  const envCookie = cookieStore.get('app_env')?.value;
  const appEnv = (envCookie as any) || process.env.NEXT_PUBLIC_APP_ENV || 'production';

  return (
    <html lang="pt-BR" className={cn(jetbrainsMono.variable, playfairDisplay.variable, "font-sans", geist.variable)} data-env={appEnv}>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `window.GEMINI_API_KEY = ${JSON.stringify(geminiKey)};`
        }} />
      </head>
      <body className="font-sans antialiased bg-slate-50 text-slate-900" suppressHydrationWarning>
        <ResizeObserverFix />
        <SettingsProvider>
          <PrivacyProvider>
            <OrganizationProvider>
              <EnvBanner />
              <SessionMonitor />
              <GlobalSearch />
              <Toaster position="top-right" richColors />
              {children}
            </OrganizationProvider>
          </PrivacyProvider>
        </SettingsProvider>
      </body>
    </html>
  )
}
