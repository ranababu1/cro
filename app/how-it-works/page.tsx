import Link from 'next/link';
import { pageMetadata } from '@/lib/site/meta';
import { FREE_LINE, LIFECYCLE } from '@/lib/site/product';
import { Breadcrumbs, Container, CtaBand, PageHero, ProductSubnav, Section, SectionHeading, SitePage } from '../components/site';

export const metadata = pageMetadata({
    path: '/how-it-works',
    title: 'How website experimentation works, step by step',
    description: 'The A/B testing lifecycle in FreeABTest: create a test, set variants and traffic, add the snippet, assign visitors, track conversions and read results.',
});

const Check = () => (
    <svg viewBox="0 0 20 20" className="mt-[3px] h-4 w-4 shrink-0 text-accent-600" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 10 3.5 3.5L15 7" /></svg>
);

/** What happens on one page view, left to right. Mirrors the SDK flow in /docs/javascript-sdk#automatic. */
const FLOW = [
    { title: 'Visitor arrives', body: 'The snippet loads in the head and reads the visitor ID, or creates a random one.' },
    { title: 'Test matches', body: 'The page address and the targeting rules decide whether the visitor can enter.' },
    { title: 'Version picked', body: 'The visitor ID hashed with the test ID gives the same version every time.' },
    { title: 'Version shown', body: 'Changes are applied, or the visitor is redirected, before the page shows.' },
    { title: 'Goals counted', body: 'Clicks, form submits, page visits or your own events are recorded for that version.' },
];

export default function HowItWorksPage() {
    return (
        <SitePage>
            <PageHero eyebrow="How it works" title="From hypothesis to decision in seven steps"
                lede="An experiment is a short loop: say what you expect, show versions to comparable visitors, count what they do, and act on a verdict you can trust. This is how each step works in FreeABTest."
                actions={[{ href: '/signin', label: 'Start experimenting' }, { href: '/docs/quick-start', label: 'Open the quick start' }]}>
                <Breadcrumbs items={[{ href: '/product', label: 'Product' }, { href: '/how-it-works', label: 'How it works' }]} />
            </PageHero>
            <ProductSubnav current="/how-it-works" />

            <Section>
                <SectionHeading eyebrow="The lifecycle" title="Seven steps, one loop" lede="Select a step to read how it works and see a worked example." />
                <ol className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                    {LIFECYCLE.map((s, i) => (
                        <li key={s.id} className="relative">
                            <a href={`#${s.id}`} className="flex h-full flex-col rounded-xl border border-line bg-white p-4 transition-colors hover:border-slate-300 hover:bg-surface">
                                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[14px] font-semibold ${i === LIFECYCLE.length - 1 ? 'bg-accent-700 text-white' : 'bg-navy-950 text-white'}`}>{i + 1}</span>
                                <span className="mt-3 text-[15px] font-semibold leading-[1.3] text-navy-950">{s.title}</span>
                            </a>
                        </li>
                    ))}
                </ol>
                <p className="mt-4 text-[14px] text-muted">After step 7 the loop starts again: the outcome of one test becomes the hypothesis of the next.</p>
            </Section>

            <div className="border-t border-line">
                {LIFECYCLE.map((s, i) => (
                    <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className={`scroll-mt-20 py-14 md:py-20 ${i % 2 ? 'bg-white' : 'bg-surface'}`}>
                        <Container className="grid gap-8 lg:grid-cols-[80px_minmax(0,1fr)_minmax(0,420px)] lg:gap-12">
                            <div className="text-[40px] font-semibold leading-none tracking-[-0.03em] text-muted" aria-hidden>{String(i + 1).padStart(2, '0')}</div>
                            <div>
                                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-700">Step {i + 1}</p>
                                <h2 id={`${s.id}-title`} className="mt-2 text-[26px] font-semibold leading-[1.2] tracking-[-0.02em] text-navy-950 md:text-[30px]">{s.title}</h2>
                                <p className="mt-3 text-[17px] leading-[1.6] text-muted-strong">{s.body}</p>
                                <ul className="mt-5 grid gap-2.5">
                                    {s.details.map((d) => <li key={d} className="flex gap-2.5 text-[15px] leading-[1.55] text-muted-strong"><Check />{d}</li>)}
                                </ul>
                                <Link href={s.href} className="mt-5 inline-block text-[14px] font-medium text-accent-700 hover:underline">Docs: {s.link}</Link>
                            </div>
                            <figure className="self-start rounded-xl border border-line bg-white p-5">
                                <figcaption className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Example</figcaption>
                                <p className="mt-2 text-[15px] leading-[1.6] text-navy-950">{s.example}</p>
                            </figure>
                        </Container>
                    </section>
                ))}
            </div>

            <Section tone="surface" className="border-t border-line" labelledBy="flow-title">
                <div className="max-w-[720px]">
                    <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-700">Under the hood</p>
                    <h2 id="flow-title" className="mt-3 text-[28px] font-semibold leading-[1.2] tracking-[-0.02em] text-navy-950 md:text-[32px]">What happens on one page view</h2>
                    <p className="mt-4 text-[17px] leading-[1.6] text-muted-strong">Steps 2 to 4 happen while the page loads, before the visitor sees it. With server-side testing, your backend asks for the version instead and sends the events itself.</p>
                </div>
                <ol className="mt-10 grid gap-3 md:grid-cols-5">
                    {FLOW.map((f, i) => (
                        <li key={f.title} className="relative rounded-xl border border-line bg-white p-5">
                            <span className="text-[13px] font-semibold text-accent-700">{i + 1}</span>
                            <h3 className="mt-2 text-[16px] font-semibold text-navy-950">{f.title}</h3>
                            <p className="mt-2 text-[14px] leading-[1.55] text-muted-strong">{f.body}</p>
                            {i < FLOW.length - 1 && <span aria-hidden className="absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-slate-300 md:block">&rsaquo;</span>}
                        </li>
                    ))}
                </ol>
                <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
                    <Link href="/docs/javascript-sdk" className="font-medium text-accent-700 hover:underline">JavaScript SDK</Link>
                    <Link href="/docs/server-side" className="font-medium text-accent-700 hover:underline">Server-side testing</Link>
                    <Link href="/experiment-analytics" className="font-medium text-accent-700 hover:underline">How results are read</Link>
                </div>
            </Section>

            <CtaBand title="Run your first experiment this week." body={FREE_LINE} href="/signin" label="Start experimenting" />
        </SitePage>
    );
}
