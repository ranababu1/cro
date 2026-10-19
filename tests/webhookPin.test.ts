import { describe, it, expect } from 'vitest';
import net from 'node:net';
import { checkHost, pinnedFetch, pinnedLookup } from '@/lib/webhooks';

describe('webhook connection pinning', () => {
    it('returns the checked address, and refuses when any answer is private', async () => {
        expect(await checkHost('https://hooks.example.com/x', async () => ['93.184.216.34', '93.184.216.35'])).toEqual({ pin: { address: '93.184.216.34', family: 4 } });
        expect(await checkHost('https://hooks.example.com/x', async () => ['2606:2800:220:1::1'])).toEqual({ pin: { address: '2606:2800:220:1::1', family: 6 } });
        expect(await checkHost('https://hooks.example.com/x', async () => ['93.184.216.34', '10.0.0.1'])).toMatchObject({ error: expect.stringMatching(/private/) });
        expect(await checkHost('https://hooks.example.com/x', async () => [])).toMatchObject({ error: expect.any(String) });
        expect(await checkHost('https://93.184.216.34/x', async () => { throw new Error('not called'); })).toEqual({ pin: { address: '93.184.216.34', family: 4 } });
    });

    it('the lookup ignores the host name and answers with the pin, in both forms', async () => {
        const look = pinnedLookup({ address: '93.184.216.34', family: 4 });
        const one = await new Promise((r) => (look as unknown as (h: string, o: object, cb: (...a: unknown[]) => void) => void)('evil.example', {}, (...a) => r(a)));
        expect(one).toEqual([null, '93.184.216.34', 4]);
        const all = await new Promise((r) => (look as unknown as (h: string, o: object, cb: (...a: unknown[]) => void) => void)('evil.example', { all: true }, (...a) => r(a)));
        expect(all).toEqual([null, [{ address: '93.184.216.34', family: 4 }]]);
    });

    it('connects to the pinned address, never to what the host name resolves to now', async () => {
        // A plain TCP server on loopback stands in for the checked address. The TLS handshake then fails, which is
        // fine: the point is that the socket reached the pinned address for a host name that does not resolve at all.
        let connected = 0;
        const server = net.createServer((sock) => { connected++; sock.destroy(); });
        await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
        const port = (server.address() as net.AddressInfo).port;
        await expect(pinnedFetch(`https://rebind.invalid:${port}/hook`, { method: 'POST', body: '{}', headers: {}, signal: AbortSignal.timeout(3000) }, { address: '127.0.0.1', family: 4 })).rejects.toBeTruthy();
        server.close();
        expect(connected).toBe(1);
    });
});
