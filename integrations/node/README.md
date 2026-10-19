# @freeabtest/node

Server-side SDK for FreeABTest. Node.js 18+, no dependencies. **Not published to npm**: the package is
`private` so `npm publish` refuses it. Use it from this repo (`npm install ./integrations/node`) or copy
`index.js` and `index.d.ts`.

```js
import { FreeABTest } from '@freeabtest/node';

const ab = new FreeABTest({ secretKey: process.env.FREEABTEST_SECRET_KEY });

// Decide locally from the cached config (one config request a minute, none per visitor).
const d = await ab.decide('exp_123', userId);
if (d.variationName === 'Shorter form') renderShortForm();

// Or ask the server, which always honours a stored assignment.
const s = await ab.getVariation('exp_123', userId);

// Conversions: once per visitor per goal. The variation comes from the last decision, then the hash.
await ab.trackConversion('exp_123', userId, { goalId: 'goal_1' });

// Events are queued and sent in batches of up to 50. Flush before exit.
process.on('beforeExit', () => ab.close());
```

Endpoints: `GET /api/server/config`, `POST /api/server/assign`, `POST /api/server/track`, all with
`Authorization: Bearer cro_sk_...`. Public docs: /docs/server-side.

The hash must stay identical to `lib/assignment.ts`; `tests/nodeSdk.test.ts` checks 2,000 visitors.
