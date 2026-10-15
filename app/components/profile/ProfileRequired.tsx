import Link from 'next/link';
import { PROFILE_REQUIRED_MESSAGE } from '@/lib/profile';

/** Shown where experiments are created or started while the profile is incomplete. */
export function ProfileRequired({ next, className = '' }: { next: string; className?: string }) {
    return (
        <div className={`rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 ${className}`} data-testid="profile-required">
            <p className="font-medium">{PROFILE_REQUIRED_MESSAGE}</p>
            <p className="mt-1">Add your name and country. It takes a minute, and we bring you right back here.</p>
            <Link href={`/settings/profile?next=${encodeURIComponent(next)}`} className="mt-2 inline-block font-medium text-blue-700 hover:underline">Complete your profile</Link>
        </div>
    );
}
