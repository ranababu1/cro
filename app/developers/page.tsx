import Link from 'next/link';
import { pageMetadata } from '@/lib/site/meta';
import { FREE_LINE } from '@/lib/site/product';
import { DOC_LINKS, ENDPOINTS, ERRORS, INTEGRATIONS, KEY_TYPES, ONBOARDING, SDK_METHODS, SNIPPETS, WEBHOOK_EVENTS } from '@/lib/site/developers';
import { ArrowIcon, Breadcrumbs, CodeBlock, CtaBand, PageHero, PlanBadge, Section, SectionHeading, SitePage } from '../components/site';
import { breadcrumbListNode } from '@/lib/site/jsonLd';

export const metadata = pageMetadata({
    path: '/developers',
    title: 'Developers: A/B testing SDK and REST API',
    description: 'Add A/B testing with one script tag, a small JavaScript API and a REST API: sticky assignment, server-side tests, environments, signed webhooks and results.',
});


export default function DevelopersPage() {
    const [browser, ...rest] = SNIPPETS;
    return (
        <SitePage schema={[breadcrumbListNode([{ href: '/developers', label: 'Developers' }])]}>
            <PageHero eyebrow="Developers" title="Build experimentation into your product"
                lede="One script tag for the browser, a secret key for your backend, and a REST API for results. Assignment is deterministic, so the browser and your server always agree on a visitor's version."
                actions={[{ href: '/docs/quick-start', label: 'Open the quick start' }, { href: '/docs/rest-api', label: 'REST API reference' }]}>
                <Breadcrumbs items={[{ href: '/developers', label: 'Developers' }]} />
            </PageHero>

            <Section labelledBy="start-title">
                <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:items-start">
                    <div>
                        <SectionHeading id="start-title" eyebrow="Get started" title="Four steps to a running test" />
                        <ol className="mt-8 grid gap-4">
                            {ONBOARDING.map((s, i) => (
                                <li key={s.title} className="flex gap-4">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-950 text-[14px] font-semibold text-white">{i + 1}</span>
                                    <div>
                                        <h3 className="text-[16px] font-semibold text-navy-950">{s.title}</h3>
                                        <p className="mt-1 text-[15px] leading-[1.6] text-muted-strong">{s.body}</p>
                                        <Link href={s.href} className="mt-1 inline-block text-[14px] font-medium text-accent-700 hover:underline">{s.link}</Link>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>
                    <div className="lg:pt-12">
                        <CodeBlock label={`${browser.label}: ${browser.title.toLowerCase()}`} code={browser.code} />
                        <p className="mt-3 text-[14px] leading-[1.55] text-muted-strong">{browser.body} The browser SDK is this script tag; there is no package to install.</p>
                    </div>
                </div>
            </Section>

            <Section id="examples" tone="surface" className="border-t border-line" labelledBy="examples-title">
                <SectionHeading id="examples-title" eyebrow="Integration examples" title="From the page to your backend" lede="Copied from the docs. Replace the keys with your own from API keys in the dashboard." />
                <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {rest.map((s) => (
                        <article key={s.id} className="flex flex-col">
                            <h3 className="text-[17px] font-semibold text-navy-950">{s.title}</h3>
                            <p className="mt-1 text-[15px] leading-[1.6] text-muted-strong">{s.body}</p>
                            <CodeBlock label={s.label} code={s.code} className="mt-4" />
                            <Link href={s.href} className="mt-3 text-[14px] font-medium text-accent-700 hover:underline">{s.link}</Link>
                        </article>
                    ))}
                </div>
            </Section>

            <Section id="sdk" labelledBy="sdk-title">
                <SectionHeading id="sdk-title" eyebrow="JavaScript SDK" title="A small API on window.ABTest" lede="For a standard test you call nothing: the snippet matches the page, assigns the visitor, applies the version and counts goals. These methods are for everything else." />
                <dl className="mt-10 divide-y divide-line rounded-xl border border-line">
                    {SDK_METHODS.map((m) => (
                        <div key={m.name} className="grid gap-2 p-5 md:grid-cols-[300px_minmax(0,1fr)_auto] md:items-start md:gap-6">
                            <dt><Link href={m.href} className="font-mono text-[14px] font-medium text-navy-950 hover:underline">{m.name}</Link></dt>
                            <dd className="text-[15px] leading-[1.55] text-muted-strong">{m.body}</dd>
                            <dd><PlanBadge plan={m.plan} /></dd>
                        </div>
                    ))}
                </dl>
                <p className="mt-4 text-[14px] text-muted">SDK calls catch their own errors and log them to the console, so a failure never breaks your page.</p>
            </Section>

            <Section id="api" tone="surface" className="border-t border-line" labelledBy="api-title">
                <SectionHeading id="api-title" eyebrow="REST API" title="Endpoints by key type" lede="SDK keys call the browser endpoints. Secret keys call the server and management endpoints, and only see their own project. Experiments are created in the dashboard." />
                <ul className="mt-10 divide-y divide-line rounded-xl border border-line bg-white md:hidden">
                    {ENDPOINTS.map((e) => (
                        <li key={`${e.method} ${e.path}`} className="p-4">
                            <Link href={e.href} className="block break-all font-mono text-[13px] text-navy-950 hover:underline"><span className="mr-2 font-semibold text-accent-700">{e.method}</span>{e.path}</Link>
                            <p className="mt-1 text-[14px] text-muted-strong">{e.body}</p>
                            <p className="mt-1 text-[12px] font-medium text-muted">{e.auth}</p>
                        </li>
                    ))}
                </ul>
                <div className="mt-10 hidden overflow-x-auto rounded-xl border border-line bg-white md:block">
                    <table className="w-full min-w-[640px] text-left text-[14px]">
                        <thead className="border-b border-line bg-surface text-[12px] uppercase tracking-[0.06em] text-muted">
                            <tr><th className="px-4 py-3 font-semibold">Endpoint</th><th className="px-4 py-3 font-semibold">Key</th><th className="px-4 py-3 font-semibold">What it does</th></tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {ENDPOINTS.map((e) => (
                                <tr key={`${e.method} ${e.path}`}>
                                    <td className="px-4 py-3"><Link href={e.href} className="font-mono text-[13px] text-navy-950 hover:underline"><span className="mr-2 font-semibold text-accent-700">{e.method}</span>{e.path}</Link></td>
                                    <td className="whitespace-nowrap px-4 py-3 text-muted-strong">{e.auth}</td>
                                    <td className="px-4 py-3 text-muted-strong">{e.body}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
                    <div>
                        <h3 className="text-[17px] font-semibold text-navy-950">Errors</h3>
                        <dl className="mt-3 grid gap-2 text-[14px]">
                            {ERRORS.map(([code, meaning]) => (
                                <div key={code} className="flex gap-3"><dt className="w-10 shrink-0 font-mono font-semibold text-navy-950">{code}</dt><dd className="text-muted-strong">{meaning}</dd></div>
                            ))}
                        </dl>
                    </div>
                    <CodeBlock label="curl: send a conversion from your server" code={`curl -X POST https://www.freeabtest.com/api/server/track \\\n  -H 'Authorization: Bearer cro_sk_prod_...' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"events": [{"experiment_id": "exp_123", "variation_id": "var_b",\n    "user_id": "user_42", "event_type": "conversion", "goal_id": "goal_1"}]}'`} />
                </div>
            </Section>

            <Section id="keys" labelledBy="keys-title">
                <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
                    <div>
                        <SectionHeading id="keys-title" eyebrow="Keys and environments" title="Dev, staging and production in every project" lede="Use a dev key locally, a staging key on staging and a production key on the live site. Events carry the environment of the key, so test traffic stays out of real results." />
                        <Link href="/docs/environments-and-keys" className="mt-5 inline-block text-[14px] font-medium text-accent-700 hover:underline">Creating, rotating and revoking keys</Link>
                    </div>
                    <div className="grid gap-4">
                        {KEY_TYPES.map((k) => (
                            <div key={k.name} className="rounded-xl border border-line p-5">
                                <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-[17px] font-semibold text-navy-950">{k.name}</h3><code className="font-mono text-[13px] text-muted-strong">{k.format}</code></div>
                                <dl className="mt-3 grid gap-1.5 text-[14px] sm:grid-cols-[110px_minmax(0,1fr)]">
                                    <dt className="text-muted">Where</dt><dd className="text-navy-950">{k.where}</dd>
                                    <dt className="text-muted">Can call</dt><dd className="text-navy-950">{k.calls}</dd>
                                    <dt className="text-muted">Safe to expose</dt><dd className="text-navy-950">{k.expose}</dd>
                                </dl>
                            </div>
                        ))}
                        <p className="text-[14px] text-muted">Keys are shown once when you create them and stored hashed.</p>
                    </div>
                </div>
            </Section>

            <Section id="webhooks" tone="surface" className="border-t border-line" labelledBy="webhooks-title">
                <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
                    <div>
                        <div className="flex flex-wrap items-center gap-3"><p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-700">Webhooks</p><PlanBadge plan="Paid plans" /></div>
                        <h2 id="webhooks-title" className="mt-3 text-[28px] font-semibold leading-[1.2] tracking-[-0.02em] text-navy-950 md:text-[32px]">Signed events when a test changes</h2>
                        <p className="mt-4 text-[17px] leading-[1.6] text-muted-strong">A JSON POST to your https endpoint, with retries if it fails. Each delivery has a signature header so you can check it came from us.</p>
                        <ul className="mt-6 grid gap-3">
                            {WEBHOOK_EVENTS.map((w) => <li key={w.name} className="text-[15px]"><code className="font-mono text-[14px] font-medium text-navy-950">{w.name}</code><span className="text-muted-strong">: {w.body}</span></li>)}
                        </ul>
                        <Link href="/docs/webhooks#verify" className="mt-5 inline-block text-[14px] font-medium text-accent-700 hover:underline">Verify a delivery</Link>
                    </div>
                    <CodeBlock label="Delivery body" code={`{\n  "id": "whd_8k2j...",\n  "event": "test.winner",\n  "created_at": "2026-10-19T08:30:00.000Z",\n  "data": {\n    "experiment": { "id": "exp_123", "name": "Homepage CTA", "status": "running" },\n    "winner": { "variation_id": "var_456", "name": "Variation 1" },\n    "visitors": 4210\n  }\n}`} />
                </div>
            </Section>

            <Section id="integrations" labelledBy="integrations-title">
                <SectionHeading id="integrations-title" eyebrow="Integrations" title="Works with the tools you already use" />
                <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {INTEGRATIONS.map((i) => (
                        <li key={i.title} className="flex flex-col rounded-xl border border-line p-5">
                            <h3 className="text-[16px] font-semibold text-navy-950">{i.title}</h3>
                            <p className="mt-2 flex-1 text-[14px] leading-[1.55] text-muted-strong">{i.body}</p>
                            <Link href={i.href} className="mt-4 text-[14px] font-medium text-accent-700 hover:underline">Read the guide</Link>
                        </li>
                    ))}
                </ul>
                <p className="mt-6 text-[14px] text-muted-strong"><Link href="/docs/integrations" className="font-medium text-accent-700 hover:underline">All integrations and the plan each needs</Link></p>
            </Section>

            <Section tone="surface" className="border-t border-line" labelledBy="docs-title">
                <SectionHeading id="docs-title" eyebrow="Documentation" title="Reference and guides" />
                <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {DOC_LINKS.map((d) => (
                        <li key={d.href}>
                            <Link href={d.href} className="flex h-full flex-col rounded-xl border border-line bg-white p-5 transition-colors hover:border-slate-300">
                                <span className="text-[16px] font-semibold text-navy-950">{d.title}</span>
                                <span className="mt-1 flex-1 text-[14px] text-muted-strong">{d.body}</span>
                                <span className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-medium text-accent-700">Open <ArrowIcon /></span>
                            </Link>
                        </li>
                    ))}
                </ul>
                <p className="mt-6 text-[14px] text-muted">How results are calculated: <Link href="/experiment-analytics" className="font-medium text-accent-700 hover:underline">experiment analytics</Link> and <Link href="/statistical-methodology" className="font-medium text-accent-700 hover:underline">statistical methodology</Link>.</p>
            </Section>

            <CtaBand title="Ship your first experiment." body={FREE_LINE} href="/signin" label="Get your keys" />
        </SitePage>
    );
}

