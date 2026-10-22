'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardBody, Field, Input, Button, Alert } from '@/app/components/ui';

export default function SignupCapsForm({ caps }: { caps: { perIp: number; perRange: number } }) {
    const router = useRouter();
    const [perIp, setPerIp] = useState(String(caps.perIp));
    const [perRange, setPerRange] = useState(String(caps.perRange));
    const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
    const [busy, setBusy] = useState(false);
    return (
        <Card className="mb-6">
            <CardHeader title="Sign-up limits" description="New accounts allowed per day (UTC) from one IP address and from one network range (/24 for IPv4, /48 for IPv6). Shared by every server. Platform admins are not limited." />
            <CardBody>
                <form
                    className="space-y-4"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setBusy(true);
                        setMsg(null);
                        const res = await fetch('/api/admin/signup-limits', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ perIp: Number(perIp), perRange: Number(perRange) }) });
                        setBusy(false);
                        if (!res.ok) return setMsg({ tone: 'danger', text: (await res.json()).error || 'Save failed' });
                        setMsg({ tone: 'success', text: 'Sign-up limits saved.' });
                        router.refresh();
                    }}
                >
                    {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="New accounts per IP per day">{(id) => <Input id={id} type="number" min={1} required value={perIp} onChange={(e) => setPerIp(e.target.value)} />}</Field>
                        <Field label="New accounts per range per day">{(id) => <Input id={id} type="number" min={1} required value={perRange} onChange={(e) => setPerRange(e.target.value)} />}</Field>
                    </div>
                    <div className="flex justify-end"><Button type="submit" disabled={busy}>Save limits</Button></div>
                </form>
            </CardBody>
        </Card>
    );
}
