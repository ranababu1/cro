import Link from 'next/link';
import { Blobs } from './components/landing/Blobs';
import { DashboardMock } from './components/landing/DashboardMock';
import { TestIllustration } from './components/landing/TestIllustration';
import { Arrow, SiteFooter, SiteHeader } from './components/landing/SiteChrome';

// "Works with your stack": only JavaScript and HTML exist today, the rest are marked as coming soon.
const stack: { name: string; soon?: boolean; icon: React.ReactNode }[] = [
    { name: 'JavaScript', icon: <span className="flex h-5 w-5 items-end justify-end rounded-[3px] bg-zinc-500 pb-px pr-0.5 text-[8px] font-bold leading-none text-white">JS</span> },
    { name: 'HTML', icon: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d="M4 2h16l-1.5 17L12 22l-6.5-3zm3.6 5 .3 3h7.9l-.3 3.3-3.5 1-3.5-1-.2-2H5.4l.4 4.3L12 17l6.2-1.7.9-9.3z" /></svg> },
    { name: 'React', soon: true, icon: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden><ellipse cx="12" cy="12" rx="10" ry="4" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /></svg> },
    { name: 'Next.js', soon: true, icon: <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-600 text-[10px] font-bold text-white">N</span> },
    { name: 'WordPress', soon: true, icon: <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-zinc-500 text-[10px] font-bold">W</span> },
    { name: 'Node.js', soon: true, icon: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d="M12 2 3 7v10l9 5 9-5V7zm0 2.3L19 8v8l-7 3.8L5 16V8z" /></svg> },
    { name: 'GA4', soon: true, icon: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><rect x="16" y="3" width="5" height="18" rx="2.5" /><rect x="9.5" y="9" width="5" height="12" rx="2.5" /><circle cx="5.5" cy="18.5" r="2.5" /></svg> },
];

const steps = [
    { n: '01', title: 'Create your test', body: 'Set up an A/B test or split test in minutes with a few lines of code.', card: 'bg-[#eef4ff]', badge: 'bg-[#dbe7ff] text-blue-700', icon: 'text-blue-600', d: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z' },
    { n: '02', title: 'Measure what matters', body: 'Track real user behavior with clear, visual results.', card: 'bg-[#ecf8f3]', badge: 'bg-[#d5f0e5] text-teal-700', icon: 'text-teal-600', d: 'M5 20V14M10 20V9M15 20v-7M20 20V4M3 20h18' },
    { n: '03', title: 'Ship the winner', body: 'Choose the best variation and roll it out with confidence.', card: 'bg-[#fff8ea]', badge: 'bg-[#fdebc8] text-amber-700', icon: 'text-amber-500', d: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6v4H9z' },
];

const testList: { text: string; note?: string }[] = [
    { text: 'Website & landing pages' },
    { text: 'Product features' },
    { text: 'Pricing & plans' },
    { text: 'Split URL tests' },
    { text: 'Advanced targeting', note: '(device, location, referral source: coming soon)' },
];

// Verified against the built public/sdk.js (from sdk-src via npm run sdk:build): gzip is about 14504 bytes.
// Validation allows 26 variations, each project has dev/staging/prod, results use 95% Wilson intervals.
const stats = [
    { value: '~14 KB', label: ['gzipped SDK', 'snippet'] },
    { value: '26', label: ['variations per', 'experiment'] },
    { value: '3', label: ['environments', 'per project'] },
    { value: '95%', label: ['Wilson confidence', 'intervals'] },
];

const CheckDot = () => (
    <span className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
        <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 10 3.5 3.5L15 7" /></svg>
    </span>
);

const ticks = [
    { label: 'Free plan', d: 'M13 2 4 14h7l-1 8 9-12h-7z' },
    { label: 'No credit card required', d: 'M3 6h18v12H3zM3 10h18M7 15h3' },
    { label: 'Set up in minutes', d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6' },
];

export default function LandingPage() {
    return (
        <div className="min-h-screen overflow-x-hidden bg-[#f8faff] text-zinc-950">
            <div className="relative isolate">
                <Blobs variant="hero" />
                <SiteHeader />

                {/* Hero */}
                <section className="mx-auto grid max-w-[1360px] gap-14 px-5 pb-10 pt-6 sm:px-8 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:gap-6 lg:px-10 lg:pt-[52px]">
                    <div className="lg:pt-6">
                        <span className="inline-flex items-center gap-2 rounded-lg bg-blue-100/70 px-3.5 py-2 text-[13px] font-semibold tracking-[0.02em] text-blue-800">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-600"><span className="h-1.5 w-1.5 rounded-full bg-white" /></span>
                            A/B TESTING, MADE SIMPLE
                        </span>
                        <h1 className="mt-8 text-[60px] font-bold leading-[0.98] tracking-[-0.04em] text-[#0b1630] sm:text-[80px] xl:text-[96px]">
                            Build,<br />test and<br />
                            <span className="bg-gradient-to-r from-blue-600 from-15% via-sky-600 via-45% to-teal-500 to-85% bg-clip-text pb-2 text-transparent">grow faster.</span>
                        </h1>
                        <p className="mt-6 max-w-[500px] text-[19px] leading-[1.5] text-zinc-700 sm:text-[21px]">
                            Run A/B tests, split tests and experiments to understand what converts, improve your product and make data-driven decisions without the complexity.
                        </p>
                        <div className="mt-10 flex flex-wrap gap-5">
                            <Link href="/signin" className="inline-flex h-[66px] items-center gap-3 rounded-xl bg-[#0b1630] px-10 text-[18px] font-medium text-white shadow-[0_12px_24px_-12px_rgb(11_22_48/0.6)] hover:bg-[#13224a]">Start testing for free <Arrow /></Link>
                            <a href="/demo.html" className="inline-flex h-[66px] items-center gap-3 rounded-xl bg-white/90 px-6 pr-10 shadow-[0_10px_30px_-12px_rgb(30_64_175/0.25)] ring-1 ring-zinc-100 hover:bg-white">
                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white"><svg viewBox="0 0 20 20" className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden><path d="M6 4v12l10-6z" /></svg></span>
                                <span className="text-left"><span className="block text-[18px] font-medium leading-tight text-zinc-900">See the demo</span><span className="block text-[14px] text-zinc-500">Sample page</span></span>
                            </a>
                        </div>
                        <ul className="mt-14 flex flex-wrap gap-x-9 gap-y-3 text-[14px] text-zinc-800">
                            {ticks.map((t) => (
                                <li key={t.label} className="flex items-center gap-2.5">
                                    <svg viewBox="0 0 24 24" className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={t.d} /></svg>
                                    {t.label}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="relative min-w-0 lg:-mr-12">
                        <DashboardMock />
                        <div className="pointer-events-none absolute -bottom-[86px] right-2 hidden items-end font-hand text-[26px] leading-[0.9] text-blue-600 sm:flex" aria-hidden>
                            <span className="-rotate-[14deg] text-right">Turn more<br />visitors into<br />customers</span>
                            <svg viewBox="0 0 40 60" className="mb-6 ml-1 h-14 w-9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 56C26 46 32 28 28 6" /><path d="M20 12l8-8 6 10" /></svg>
                        </div>
                    </div>
                </section>

                {/* Works with your stack */}
                <section className="mx-auto max-w-[1360px] px-5 pb-10 pt-10 sm:px-8 lg:px-10 lg:pt-6">
                    <p className="text-center text-[12px] font-semibold tracking-[0.2em] text-zinc-500">WORKS WITH YOUR STACK</p>
                    <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-14 gap-y-5 text-zinc-600">
                        {stack.map((s) => (
                            <li key={s.name} className="flex items-center gap-2 text-[19px] font-semibold tracking-tight">
                                {s.icon}{s.name}
                                {s.soon && <span className="self-start text-[10px] font-medium uppercase tracking-wide text-zinc-400">soon</span>}
                            </li>
                        ))}
                    </ul>
                </section>
            </div>

            {/* How it works */}
            <section id="how-it-works" className="scroll-mt-6 bg-white/60 pb-10 pt-10">
                <div className="mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-10">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="lg:pl-2">
                            <p className="text-[13px] font-semibold tracking-[0.2em] text-blue-600">HOW IT WORKS</p>
                            <h2 className="mt-5 text-[34px] font-bold leading-[1.12] tracking-[-0.025em] text-[#0b1630] sm:text-[42px]">Go from idea to impact<br className="hidden sm:block" /> in three simple steps.</h2>
                        </div>
                        <p className="max-w-[400px] pb-2 text-[18px] leading-[1.5] text-zinc-600 lg:mr-14">No complex setup. A few lines of code. Just create, measure and ship what works.</p>
                    </div>
                    <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-center lg:gap-5">
                        {steps.map((s, i) => (
                            <div key={s.n} className="contents">
                                <div className={`flex gap-7 rounded-2xl p-5 pb-8 lg:min-h-[196px] ${s.card}`}>
                                    <span className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-xl text-[17px] font-semibold ${s.badge}`}>{s.n}</span>
                                    <div className="pt-2">
                                        <svg viewBox="0 0 24 24" className={`h-10 w-10 ${s.icon}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={s.d} /></svg>
                                        <h3 className="mt-4 text-[20px] font-semibold tracking-tight text-zinc-950">{s.title}</h3>
                                        <p className="mt-2 max-w-[290px] text-[16px] leading-[1.6] text-zinc-600">{s.body}</p>
                                    </div>
                                </div>
                                {i < steps.length - 1 && <span className="hidden text-zinc-500 lg:block" aria-hidden><Arrow /></span>}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Test anything */}
            <section id="test-anything" className="relative isolate scroll-mt-6 overflow-hidden pb-6 pt-4">
                <Blobs variant="band" />
                <div className="mx-auto grid max-w-[1360px] items-center gap-12 px-5 sm:px-8 lg:grid-cols-[minmax(0,740px)_minmax(0,1fr)] lg:gap-6 lg:px-10">
                    <div className="lg:-ml-14"><TestIllustration /></div>
                    <div>
                        <span className="inline-block rounded-md bg-blue-100/70 px-3 py-1.5 text-[11px] font-semibold tracking-[0.18em] text-blue-700">BUILT FOR REAL GROWTH</span>
                        <h2 className="mt-5 text-[36px] font-bold leading-[1.1] tracking-[-0.03em] text-[#0b1630] sm:text-[46px]">
                            Test anything.<br />
                            <span className="bg-gradient-to-r from-blue-600 via-sky-600 to-teal-500 bg-clip-text text-transparent">Improve everything.</span>
                        </h2>
                        <p className="mt-4 max-w-[540px] text-[19px] leading-[1.5] text-zinc-600">From headlines and layouts to pricing and product flows, run experiments across your entire website and product to drive real results.</p>
                        <ul className="mt-5 space-y-2.5 text-[17px] text-zinc-800">
                            {testList.map((t) => (
                                <li key={t.text} className="flex items-start gap-3"><span className="mt-[3px]"><CheckDot /></span><span>{t.text}{t.note && <span className="text-zinc-500"> {t.note}</span>}</span></li>
                            ))}
                        </ul>
                        <Link href="/roadmap" className="mt-8 inline-flex h-[54px] items-center gap-3 rounded-xl bg-[#0b1630] px-8 text-[16px] font-medium text-white hover:bg-[#13224a]">Explore the platform <Arrow /></Link>
                    </div>
                </div>
            </section>

            {/* Stats strip */}
            <section className="bg-white" aria-label="Product facts">
                <dl className="mx-auto grid max-w-[1360px] grid-cols-2 px-5 py-8 sm:px-8 lg:grid-cols-4 lg:px-10 lg:py-9">
                    {stats.map((s) => (
                        <div key={s.value} className="flex flex-col-reverse border-l border-zinc-200 py-3 pl-6 lg:pl-10">
                            <dt className="mt-2 text-[17px] leading-[1.4] text-zinc-500">{s.label[0]}<br />{s.label[1]}</dt>
                            <dd className="text-[34px] font-bold leading-none tracking-tight text-[#0f5f5a]">{s.value}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            <SiteFooter />
        </div>
    );
}
