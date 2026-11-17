import type { Metadata } from 'next';
import { Anton, Archivo } from 'next/font/google';
import { I18nProvider } from '@/i18n/I18nProvider';
import { THEME_INIT_SCRIPT } from '@/theme/theme';
import './globals.css';

const display = Anton({ weight: '400', subsets: ['latin'], variable: '--font-display' });
const body = Archivo({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: '20 Bucks Each — Leilão de jogadores da NBA',
  description: 'Cada um com $20. Dispute jogadores da NBA no leilão e monte o quinteto mais forte.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The theme script and the language provider change <html> attributes on the client.
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
