import type { Metadata } from 'next';
import { Anton, Archivo } from 'next/font/google';
import './globals.css';

const display = Anton({ weight: '400', subsets: ['latin'], variable: '--font-display' });
const body = Archivo({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: '20 Bucks Each — Leilão de jogadores da NBA',
  description: 'Cada um com $20. Dispute jogadores da NBA no leilão e monte o quinteto mais forte.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
