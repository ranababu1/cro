'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardBody, Button, Alert, Field, Input, Badge } from '@/app/components/ui';

type Ramp = { start: number; step: number; every_hours: number };
type Schedule = { start_at: string | null; stop_at: string | null; error: string | null; ramp: Ramp | null; traffic_now: number | null; ramp_full_at: string | null };

const pad = (n: number) => String(n).padStart(2, '0');
/** ISO to the value a datetime-local input expects, in the browser's time zone. */
const toLocal = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

/** Schedule a start and stop, and ramp traffic up over time. Available on every plan. */
export function ScheduleCard({ experimentId, status, traffic, onSaved }: { experimentId: string; status: string; traffic: number; onSaved: () => void }) {
    const [s, setS] = useState<Schedule | null>(null);
    const [start, setStart] = useState('');
    const [stop, setStop] = useState('');
    const [ramp, setRamp] = useState(false);
    const [rStart, setRStart] = useState('10');
    const [rStep, setRStep] = useState('10');
    const [rEvery, setREvery] = useState('24');
    const [error, setError] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    const apply = (x: Schedule) => {
        setS(x);
        setStart(toLocal(x.start_at));
        setStop(toLocal(x.stop_at));
        setRamp(!!x.ramp);
        if (x.ramp) { setRStart(String(x.ramp.start)); setRStep(String(x.ramp.step)); setREvery(String(x.ramp.every_hours)); }
    };
    useEffect(() => {
        let live = true;
        fetch(`/api/experiments/${experimentId}/schedule`).then(async (r) => { if (live && r.ok) apply((await r.json()).schedule); }).catch(() => undefined);
        return () => { live = false; };
    }, [experimentId]);

    async function send(method: 'PUT' | 'DELETE') {
        setBusy(true); setError(''); setNote('');
        const body = method === 'PUT' ? JSON.stringify({
            start_at: status === 'running' ? null : fromLocal(start),
            stop_at: fromLocal(stop),
            ramp: ramp ? { start: Number(rStart), step: Number(rStep), every_hours: Number(rEvery) } : null,
        }) : undefined;
        const res = await fetch(`/api/experiments/${experimentId}/schedule`, { method, headers: { 'Content-Type': 'application/json' }, body });
        const data = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) return setError(String(data.error || 'Could not save the schedule'));
        apply(data.schedule);
        setNote(data.warning || (method === 'PUT' ? 'Schedule saved.' : 'Schedule removed.'));
        onSaved();
    }

    if (!s) return null;
    if (status === 'completed') return null;
    const scheduled = !!(s.start_at || s.stop_at || s.ramp);
    return (
        <Card data-testid="schedule">
            <CardHeader
                title={<span className="flex items-center gap-2">Schedule and ramp {scheduled ? <Badge tone="info">Set</Badge> : <Badge>Off</Badge>}</span>}
                description="Start and stop the test at set times, and let traffic grow step by step. Times use your browser's time zone. A scheduled start checks your plan limits when it happens, the same as starting by hand."
            />
            <CardBody className="space-y-4">
                {error && <Alert tone="danger">{error}</Alert>}
                {note && <Alert tone={note.startsWith('If nothing changes') ? 'warning' : 'success'}>{note}</Alert>}
                {s.error && <Alert tone="warning" title="The scheduled start was cancelled">{s.error}</Alert>}
                {(s.start_at || s.stop_at) && (
                    <p className="text-sm text-zinc-700" data-testid="schedule-summary">
                        {s.start_at && <>Starts {when(s.start_at)}. </>}
                        {s.stop_at && <>Stops {when(s.stop_at)}. </>}
                    </p>
                )}
                {s.traffic_now !== null && s.ramp && (
                    <p className="text-sm text-zinc-700" data-testid="ramp-now">
                        New visitors entering the test now: <span className="font-medium">{s.traffic_now}%</span> of {traffic}%.
                        {s.ramp_full_at && s.traffic_now < traffic && <> Reaches {traffic}% around {when(s.ramp_full_at)}.</>}
                    </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                    {status !== 'running' && <Field label="Start at" hint="Leave blank to start by hand.">{(id) => <Input id={id} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>}
                    <Field label="Stop at" hint="The test completes at this time. Leave blank to stop by hand.">{(id) => <Input id={id} type="datetime-local" value={stop} onChange={(e) => setStop(e.target.value)} />}</Field>
                </div>
                <label className="flex items-center gap-2 text-sm text-zinc-800">
                    <input type="checkbox" checked={ramp} onChange={(e) => setRamp(e.target.checked)} /> Ramp traffic up gradually
                </label>
                {ramp && (
                    <>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <Field label="Start with (%)">{(id) => <Input id={id} type="number" min={1} max={100} value={rStart} onChange={(e) => setRStart(e.target.value)} />}</Field>
                            <Field label="Add (%)">{(id) => <Input id={id} type="number" min={1} max={100} value={rStep} onChange={(e) => setRStep(e.target.value)} />}</Field>
                            <Field label="Every (hours)">{(id) => <Input id={id} type="number" min={1} max={168} value={rEvery} onChange={(e) => setREvery(e.target.value)} />}</Field>
                        </div>
                        <p className="text-xs text-zinc-500">Counted from the test&apos;s first start, up to the traffic setting ({traffic}%). Only new visitors are affected; people already in the test keep their version.</p>
                    </>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                    {scheduled && <Button variant="secondary" disabled={busy} onClick={() => void send('DELETE')}>Remove schedule</Button>}
                    <Button disabled={busy} onClick={() => void send('PUT')}>Save schedule</Button>
                </div>
            </CardBody>
        </Card>
    );
}
