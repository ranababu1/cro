import { Field, Input, Select } from '@/app/components/ui';
import type { PopupConfig } from '@/lib/popups';

/** Trigger, frequency, devices and pages: the same for popups and surveys. */
export type Rules = Pick<PopupConfig, 'trigger' | 'trigger_value' | 'frequency' | 'device' | 'match' | 'match_value'>;

const FREQ: Record<Rules['frequency'], string> = { once: 'Once per visitor', session: 'Once per visit', every_page: 'On every page view' };
const MATCH: Record<Rules['match'], string> = { all: 'All pages', equals: 'Page address is', contains: 'Page address contains', starts_with: 'Page address starts with' };

function triggerText(c: Rules) {
    if (c.trigger === 'exit') return 'When leaving';
    if (c.trigger === 'scroll') return `After ${c.trigger_value}% scroll`;
    return c.trigger_value ? `After ${c.trigger_value}s` : 'Right away';
}

/** Short summary for lists, such as "Page address is /pricing, after 5s". */
export function rulesText(c: Rules) {
    return `${MATCH[c.match]}${c.match === 'all' ? '' : ` ${c.match_value}`}, ${triggerText(c).toLowerCase()}`;
}

export function DisplayRuleFields({ c, onChange }: { c: Rules; onChange: (patch: Partial<Rules>) => void }) {
    const set = <K extends keyof Rules>(k: K, v: Rules[K]) => onChange({ [k]: v } as Partial<Rules>);
    return (
        <>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="When it shows">{(id) => (
                            <Select id={id} value={c.trigger} onChange={(e) => set('trigger', e.target.value as Rules['trigger'])}>
                                <option value="delay">After some seconds</option>
                                <option value="scroll">After scrolling part of the page</option>
                                <option value="exit">When the visitor is about to leave</option>
                            </Select>
                        )}</Field>
                        {c.trigger !== 'exit' && (
                            <Field label={c.trigger === 'scroll' ? 'Scroll depth (%)' : 'Seconds'}>{(id) => <Input id={id} type="number" min={0} max={c.trigger === 'scroll' ? 100 : 600} value={c.trigger_value} onChange={(e) => set('trigger_value', Math.max(0, Math.round(Number(e.target.value) || 0)))} />}</Field>
                        )}
                    </div>
                    {c.trigger === 'exit' && <p className="text-sm text-zinc-500">Exit intent uses the mouse leaving the window, so it shows on computers only.</p>}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="How often">{(id) => <Select id={id} value={c.frequency} onChange={(e) => set('frequency', e.target.value as Rules['frequency'])}>{Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
                        <Field label="Devices">{(id) => (
                            <Select id={id} value={c.device} onChange={(e) => set('device', e.target.value as Rules['device'])}>
                                <option value="all">All devices</option><option value="desktop">Computers only</option><option value="mobile">Phones only</option>
                            </Select>
                        )}</Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Pages">{(id) => <Select id={id} value={c.match} onChange={(e) => set('match', e.target.value as Rules['match'])}>{Object.entries(MATCH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
                        {c.match !== 'all' && <Field label="Address" hint="A full address or a path such as /pricing">{(id) => <Input id={id} value={c.match_value} onChange={(e) => set('match_value', e.target.value)} placeholder="/pricing" />}</Field>}
                    </div>
        </>
    );
}
