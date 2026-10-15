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
};
module.exports = nextConfig;
