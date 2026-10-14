/** @type {import('next').NextConfig} */
const nextConfig = {
    // libSQL ships native bindings, so keep it out of the server bundle.
    serverExternalPackages: ['@libsql/client', 'libsql'],
    // Migrations are read from disk at startup.
    outputFileTracingIncludes: {
        '/**': ['./drizzle/**/*'],
    },
};
module.exports = nextConfig;
