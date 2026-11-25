'use client';

import { useState } from 'react';
import Link from 'next/link';

type Tier = { name: string; monthly: number | null; yearly: number | null; body: string; cta: string; href: string; popular?: boolean };

const tiers: Tier[] = [
    { name: 'Free', monthly: 0, yearly: 0, body: 'For side projects and trying it out.', cta: 'Start for free', href: '/signin' },
    { name: 'Starter', monthly: 20, yearly: 200, body: 'For one growing site that tests regularly.', cta: 'Choose Starter', href: '/signin' },
    { name: 'Growth', monthly: 50, yearly: 500, body: 'For teams running tests every week.', cta: 'Choose Growth', href: '/signin', popular: true },
    { name: 'Enterprise', monthly: null, yearly: null, body: 'For high traffic, compliance and procurement needs.', cta: 'Contact us', href: 'mailto:hello@freeabtest.com' },
];

const highlights: Record<string, string[]> = {
    Free: ['Up to 10,000 tested visitors a month', '1 project', '1 domain'],
    Starter: ['250,000 tested visitors a month', '20 active experiments', '3 projects and 5 team seats', 'Heatmaps, funnels, popups and surveys'],
    Growth: ['1,000,000 tested visitors a month', '10 projects and 15 team seats', 'Visual editor', 'Auto-shift traffic to the winner'],
    Enterprise: ['Custom tested visitors', 'Unlimited team seats', 'Audit log kept 2 years', 'Named contact with an SLA'],
};

/** checkout: paid checkout is on, so Starter and Growth go to Billing (through sign-in when signed out). Off: sign-in as before. */
export function BillingCards({ checkout = false }: { checkout?: boolean }) {
    const [yearly, setYearly] = useState(false);
    return (
        <div>
            <div className="mt-8 inline-flex rounded-full border border-line bg-white p-1 text-[14px] font-medium" role="group" aria-label="Billing period">
                <button type="button" onClick={() => setYearly(false)} aria-pressed={!yearly} className={`rounded-full px-4 py-2 ${!yearly ? 'bg-navy-950 text-white' : 'text-muted-strong hover:text-navy-950'}`}>Monthly</button>
                <button type="button" onClick={() => setYearly(true)} aria-pressed={yearly} className={`rounded-full px-4 py-2 ${yearly ? 'bg-navy-950 text-white' : 'text-muted-strong hover:text-navy-950'}`}>Yearly <span className={yearly ? 'text-accent-100' : 'text-accent-700'}>(2 months free)</span></button>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                {tiers.map((t) => {
                    const price = t.monthly === null ? 'Custom' : `$${yearly ? t.yearly : t.monthly}`;
                    const unit = t.monthly === null ? '' : yearly ? '/yr' : '/mo';
                    const paid = checkout && (t.name === 'Starter' || t.name === 'Growth');
                    const href = paid ? `/signin?callbackUrl=${encodeURIComponent(`/settings/billing?plan=${t.name.toLowerCase()}&period=${yearly ? 'yearly' : 'monthly'}`)}` : t.href;
                    const note = t.monthly === null ? 'Contact us' : t.monthly === 0 ? 'Free forever, no card' : yearly ? `About $${((t.yearly as number) / 12).toFixed(2)}/mo, billed yearly` : 'Billed monthly';
                    return (
                        <div key={t.name} className={`relative flex min-w-0 flex-col rounded-xl border bg-white p-6 shadow-xs ${t.popular ? 'border-navy-950 ring-1 ring-navy-950' : 'border-line'}`}>
                            {t.popular && <span className="absolute -top-3 left-6 rounded-full bg-navy-950 px-3 py-1 text-[12px] font-semibold text-white">Most popular</span>}
                            <h2 className="text-[18px] font-semibold text-navy-950">{t.name}</h2>
                            <p className="mt-1 min-h-[44px] text-[14px] leading-[1.55] text-muted-strong">{t.body}</p>
                            <p className="mt-4 text-[38px] font-semibold tracking-[-0.02em] text-navy-950">{price}<span className="text-[16px] font-medium text-muted">{unit}</span></p>
                            <p className="mt-1 text-[12px] text-muted">{note}</p>
                            <ul className="mt-5 flex-1 space-y-2 border-t border-line pt-5 text-[14px] leading-5 text-muted-strong" data-testid={`plan-${t.name.toLowerCase()}-limits`}>
                                {highlights[t.name].map((i) => <li key={i} className="flex gap-2"><span className="font-semibold text-accent-700" aria-hidden>✓</span>{i}</li>)}
                            </ul>
                            <a href="#compare" className="mt-5 text-[14px] font-medium text-accent-700 hover:underline">See all plan details</a>
                            <Link href={href} className={`mt-6 inline-flex h-11 items-center justify-center rounded-lg text-[15px] font-semibold ${t.popular ? 'bg-navy-950 text-white hover:bg-navy-800' : 'border border-line text-navy-950 hover:bg-surface'}`}>{t.cta}</Link>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
