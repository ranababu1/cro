/** @type {import('next').NextConfig} */
const nextConfig = {
    // libSQL ships native bindings, so keep it out of the server bundle.
    serverExternalPackages: ['@libsql/client', 'libsql'],
    // Migrations are read from disk at startup.
    outputFileTracingIncludes: {
        '/**': ['./drizzle/**/*'],
        // The WordPress plugin is zipped on request by the signed-in download route.
        '/api/downloads/wordpress': ['./integrations/wordpress/freeabtest/**/*'],
    },
    async headers() {
        const base = [
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            // The app is never framed; the SDK runs on customer pages as a script, not in a frame.
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
            { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ];
        return [
            { source: '/:path*', headers: base },
            // Share links carry their token in the address, so it is never sent to other sites.
            { source: '/share/:path*', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] },
            { source: '/invite/:path*', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'X-Robots-Tag', value: 'noindex' }] },
            // Site scripts: browsers reuse them for 5 minutes instead of asking again on every page view, then refresh in the background.
            { source: '/:file(sdk|heatmap|popups|surveys|errors|visual).js', headers: [{ key: 'Cache-Control', value: 'public, max-age=300, stale-while-revalidate=86400' }] },
        ];
    },
};
module.exports = nextConfig;
