import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPlatformAdmin } from '@/lib/platformAdmin';

export const dynamic = 'force-dynamic';

// Server-side guard for every /admin page. Non-admins get a 404.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const admin = await getPlatformAdmin();
    if (!admin) notFound();
    return (
        <div className="min-h-screen bg-base-100">
            <div className="navbar bg-base-200 px-4">
                <Link href="/admin" className="btn btn-ghost text-xl">Platform admin</Link>
                <span className="ml-auto text-sm opacity-70">{admin.email}</span>
                <Link href="/dashboard" className="btn btn-ghost btn-sm ml-2">Dashboard</Link>
            </div>
            <div className="max-w-7xl mx-auto px-4 py-8">{children}</div>
        </div>
    );
}
