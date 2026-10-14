import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import AuthProvider from './components/AuthProvider';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' });
const mono = JetBrains_Mono({ variable: '--font-mono-face', subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
    title: { default: 'CRO: A/B testing and experimentation', template: '%s · CRO' },
    description:
        'Run A/B and A/B/n tests with a small JavaScript SDK, deterministic visitor assignment and statistically sound results.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={`${inter.variable} ${mono.variable}`}>
            <body>
                <AuthProvider>{children}</AuthProvider>
            </body>
        </html>
    );
}
