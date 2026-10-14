import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Caveat } from 'next/font/google';
import './globals.css';
import AuthProvider from './components/AuthProvider';
import { Analytics } from '@vercel/analytics/next';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' });
const mono = JetBrains_Mono({ variable: '--font-mono-face', subsets: ['latin'], display: 'swap' });
// Handwritten accent used for one annotation on the landing page.
const hand = Caveat({ variable: '--font-hand-face', subsets: ['latin'], display: 'swap', weight: ['500'] });

export const metadata: Metadata = {
    title: { default: 'freeabtest.com: A/B testing and experimentation', template: '%s · freeabtest.com' },
    description:
        'Run A/B and A/B/n tests with a small JavaScript SDK, deterministic visitor assignment and statistically sound results.',
    applicationName: 'freeabtest.com',
    icons: {
        icon: [
            { url: '/favicon.ico', sizes: '48x48' },
            { url: '/icon.png', type: 'image/png', sizes: '32x32' },
        ],
        apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={`${inter.variable} ${mono.variable} ${hand.variable}`}>
            <body>
                <AuthProvider>{children}</AuthProvider>
                <Analytics />
            </body>
        </html>
    );
}
