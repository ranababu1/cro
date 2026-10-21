'use client';

import { useState } from 'react';
import Link from 'next/link';

type Tier = { name: string; monthly: number | null; yearly: number | null; body: string; cta: string; href: string; popular?: boolean };

const tiers: Tier[] = [
    { name: 'Free', monthly: 0, yearly: 0, body: 'For side projects and trying it out.', cta: 'Start for free', href: '/signin' },
    { name: 'Starter', monthly: 10, yearly: 100, body: 'For one growing site that tests regularly.', cta: 'Choose Starter', href: '/signin' },
    { name: 'Growth', monthly: 50, yearly: 500, body: 'For teams running tests every week.', cta: 'Choose Growth', href: '/signin', popular: true },
    { name: 'Enterprise', monthly: null, yearly: null, body: 'For high traffic, compliance and procurement needs.', cta: 'Contact us', href: 'mailto:hello@freeabtest.com' },
];

const highlights: Record<string, string[]> = {
    Free: [
        '10,000 tested visitors a month, up to 300 a day',
        '1 running test at a time',
        '1 new test a month',
        '1 page URL per test',
        '1 goal per test: a click on a CSS selector',
        '1 project',
        '1 domain',
        'A/B only: control plus 1 variation',
    ],
    Starter: ['250,000 tested visitors a month', '20 active experiments', '3 projects and 5 team seats', 'Heatmaps, funnels, popups and surveys'],
    Growth: ['1,000,000 tested visitors a month', '10 projects and 15 team seats', 'Visual editor', 'Auto-shift traffic to the winner'],
    Enterprise: ['Custom tested visitors', 'Unlimited team seats', 'Audit log kept 2 years', 'Named contact with an SLA'],
};

export function BillingCards() {
    const [yearly, setYearly] = useState(false);
    return (
        <div>
            <div className="mt-4 inline-flex rounded-full border border-zinc-200 bg-white p-1 text-sm font-medium" role="group" aria-label="Billing period">
                <button type="button" onClick={() => setYearly(false)} aria-pressed={!yearly} className={`rounded-full px-4 py-2 ${!yearly ? 'bg-blue-600 text-white' : 'text-zinc-600'}`}>Monthly</button>
                <button type="button" onClick={() => setYearly(true)} aria-pressed={yearly} className={`rounded-full px-4 py-2 ${yearly ? 'bg-blue-600 text-white' : 'text-zinc-600'}`}>Yearly <span className={yearly ? 'text-teal-100' : 'text-teal-700'}>(2 months free)</span></button>
            </div>
            <div className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                {tiers.map((t) => {
                    const price = t.monthly === null ? 'Custom' : `$${yearly ? t.yearly : t.monthly}`;
                    const unit = t.monthly === null ? '' : yearly ? '/yr' : '/mo';
                    const note = t.monthly === null ? 'Contact us' : t.monthly === 0 ? 'Free forever, no card' : yearly ? `About $${((t.yearly as number) / 12).toFixed(2)}/mo, billed yearly` : 'Billed monthly';
                    return (
                        <div key={t.name} className={`relative flex flex-col rounded-2xl border bg-white p-6 ${t.popular ? 'border-blue-600 ring-1 ring-blue-600' : 'border-zinc-200'}`}>
                            {t.popular && <span className="absolute -top-3 left-7 rounded-full bg-gradient-to-r from-[#2563eb] to-[#14b8a6] px-3 py-1 text-xs font-semibold text-white">Most popular</span>}
                            <h2 className="text-lg font-semibold">{t.name}</h2>
                            <p className="mt-1 min-h-[40px] text-sm text-zinc-600">{t.body}</p>
                            <p className="mt-4 text-4xl font-bold tracking-tight text-[#0b1630]">{price}<span className="text-base font-medium text-zinc-500">{unit}</span></p>
                            <p className="mt-1 text-xs text-zinc-500">{note}</p>
                            <ul className="mt-4 flex-1 space-y-1.5 text-sm leading-5 text-zinc-700" data-testid={`plan-${t.name.toLowerCase()}-limits`}>
                                {highlights[t.name].map((i) => <li key={i} className="flex gap-2"><span className="text-teal-600" aria-hidden>✓</span>{i}</li>)}
                            </ul>
                            <Link href={t.href} className={`mt-6 inline-flex h-11 items-center justify-center rounded-lg text-sm font-semibold ${t.popular ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-zinc-300 text-zinc-900 hover:bg-zinc-50'}`}>{t.cta}</Link>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
