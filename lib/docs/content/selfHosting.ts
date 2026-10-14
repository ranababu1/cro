import type { DocPage } from '../types';

export const selfHosting: DocPage = {
    slug: 'self-hosting',
    title: 'Self-hosting',
    description: 'Run your own instance: requirements, environment variables, the database, Turso and Vercel.',
    group: 'Operations',
    blocks: [
        { type: 'p', text: 'freeabtest.com is a Next.js app with a SQLite-compatible database. You can run it on one server with a local file, or serverless with a hosted libSQL database such as Turso.' },
        { type: 'h2', text: 'Requirements' },
        { type: 'list', items: [
            'Node.js 20 or newer.',
            'A Google OAuth client for sign in.',
            'A database: a local SQLite file, or a libSQL database (Turso) for serverless hosting.',
        ] },
        { type: 'h2', text: 'Run locally' },
        { type: 'code', label: 'Terminal', code: `git clone https://github.com/ranababu1/cro.git freeabtest
cd freeabtest
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000` },
        { type: 'p', text: 'Migrations run automatically on the first request. The local database is created at `data/cro.db`.' },
        { type: 'h2', text: 'Environment variables', id: 'env-vars' },
        { type: 'table', head: ['Variable', 'Required', 'Description'], rows: [
            ['`NEXTAUTH_URL`', 'Yes', 'Public URL of the app, for example `https://ab.example.com`.'],
            ['`NEXTAUTH_SECRET`', 'Yes', 'Random string used to sign sessions. Generate one with `openssl rand -base64 32`.'],
            ['`GOOGLE_CLIENT_ID`', 'Yes', 'From your Google OAuth client.'],
            ['`GOOGLE_CLIENT_SECRET`', 'Yes', 'From your Google OAuth client.'],
            ['`DATABASE_URL`', 'No', 'Defaults to `file:./data/cro.db`. Use `libsql://...` for Turso.'],
            ['`DATABASE_AUTH_TOKEN`', 'For Turso', 'The database token.'],
            ['`DB_AUTO_MIGRATE`', 'No', 'Default `true`. Set `false` to skip automatic migrations and run `npm run db:migrate` yourself.'],
            ['`RATE_LIMIT_PER_MINUTE`', 'No', 'Requests per minute per SDK key and client IP on the SDK endpoints. Default 600.'],
            ['`PLATFORM_ADMIN_EMAILS`', 'No', 'Comma separated admin emails for `/admin`. Empty disables the console.'],
        ] },
        { type: 'h2', text: 'Google sign in' },
        { type: 'list', ordered: true, items: [
            'In Google Cloud Console, create an OAuth client of type **Web application**.',
            'Add the authorised redirect URI `https://YOUR-HOST/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google` for local work).',
            'Copy the client ID and secret into your environment.',
        ] },
        { type: 'h2', text: 'Database and migrations' },
        { type: 'p', text: 'The schema is managed with Drizzle. Migrations are SQL files in the `drizzle/` folder. By default each server process applies pending migrations once, on its first database call. Migrations are found relative to the working directory, so start the app from the project root.' },
        { type: 'code', label: 'Terminal', code: `DB_AUTO_MIGRATE=false npm start   # skip on boot
npm run db:migrate                 # apply manually, for example in a release step` },
        { type: 'h2', text: 'Turso' },
        { type: 'code', label: 'Terminal', code: `turso db create freeabtest
turso db show freeabtest --url        # libsql://freeabtest-<you>.turso.io
turso db tokens create freeabtest     # DATABASE_AUTH_TOKEN` },
        { type: 'h2', text: 'Deploying to Vercel' },
        { type: 'list', ordered: true, items: [
            'Import the repository into Vercel. The default Next.js settings work.',
            'Set all required environment variables, with `DATABASE_URL` pointing at Turso. A local SQLite file does not persist on Vercel.',
            'Set `NEXTAUTH_URL` to your production domain and add its callback URL to the Google client.',
            'Deploy, then sign in and check that `/api/assign` responds.',
        ] },
        { type: 'callout', tone: 'warning', title: 'Rate limits on serverless', text: 'The rate limiter keeps counts in each server process\'s memory. On Vercel each instance counts separately, so the effective limit is higher than `RATE_LIMIT_PER_MINUTE`. A shared limiter is planned.' },
        { type: 'h2', text: 'A single server' },
        { type: 'code', label: 'Terminal', code: `npm ci
npm run build
NODE_ENV=production npm start   # port 3000, put a reverse proxy with HTTPS in front` },
        { type: 'p', text: 'Back up the `data/` folder if you use a local file. Make sure your proxy forwards `X-Forwarded-For`, which the rate limiter uses to identify clients.' },
    ],
};
