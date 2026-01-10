import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Experiment } from '@/lib/types';
import Navbar from '../components/Navbar';

async function getExperiments(userId: string): Promise<Experiment[]> {
    try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        const res = await fetch(`${baseUrl}/api/experiments?userId=${userId}`, {
            cache: 'no-store',
        });

        if (!res.ok) {
            return [];
        }

        const data = await res.json();
        return data.experiments || [];
    } catch (error) {
        console.error('Failed to fetch experiments:', error);
        return [];
    }
}

export default async function Dashboard() {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return (
            <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center gap-4">
                <h1 className="text-2xl font-bold">Authentication Required</h1>
                <p className="text-base-content/70">Please sign in to access your dashboard</p>
                <a href="/api/auth/signin" className="btn btn-primary">
                    Sign In with Google
                </a>
            </div>
        );
    }

    const experiments = await getExperiments(session.user.id || '');

    return (
        <div className="min-h-screen bg-base-100">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-4xl font-bold">
                            Experiment Dashboard
                        </h1>
                        <p className="mt-2 text-base-content/70">
                            Welcome back, {session.user.name || session.user.email}
                        </p>
                    </div>
                    <Link href="/experiments/new" className="btn btn-primary">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Experiment
                    </Link>
                </div>

                {/* Stats Cards */}
                <div className="stats stats-vertical lg:stats-horizontal shadow w-full mb-8">
                    <div className="stat">
                        <div className="stat-title">Total Experiments</div>
                        <div className="stat-value text-primary">{experiments.length}</div>
                        <div className="stat-desc">All time</div>
                    </div>
                    <div className="stat">
                        <div className="stat-title">Running</div>
                        <div className="stat-value text-success">
                            {experiments.filter(e => e.status === 'running').length}
                        </div>
                        <div className="stat-desc">Active tests</div>
                    </div>
                    <div className="stat">
                        <div className="stat-title">Draft</div>
                        <div className="stat-value text-warning">
                            {experiments.filter(e => e.status === 'draft').length}
                        </div>
                        <div className="stat-desc">Not started</div>
                    </div>
                    <div className="stat">
                        <div className="stat-title">Completed</div>
                        <div className="stat-value text-info">
                            {experiments.filter(e => e.status === 'completed').length}
                        </div>
                        <div className="stat-desc">Finished</div>
                    </div>
                </div>

                {/* Experiments List */}
                {experiments.length === 0 ? (
                    <div className="card bg-base-200 shadow-xl">
                        <div className="card-body items-center text-center py-16">
                            <svg className="w-24 h-24 text-base-content/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <h2 className="card-title text-2xl mb-2">No experiments yet</h2>
                            <p className="text-base-content/70 mb-6">
                                Get started by creating your first A/B test experiment
                            </p>
                            <Link href="/experiments/new" className="btn btn-primary">
                                Create Your First Experiment
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {experiments.map((experiment) => (
                            <Link
                                key={experiment.id}
                                href={`/experiments/${experiment.id}`}
                                className="card bg-base-200 shadow-xl hover:shadow-2xl transition-shadow cursor-pointer"
                            >
                                <div className="card-body">
                                    <div className="flex justify-between items-start mb-2">
                                        <h2 className="card-title">{experiment.name}</h2>
                                        <span className={`badge ${experiment.status === 'running' ? 'badge-success' :
                                            experiment.status === 'draft' ? 'badge-warning' :
                                                experiment.status === 'paused' ? 'badge-info' :
                                                    'badge-neutral'
                                            }`}>
                                            {experiment.status}
                                        </span>
                                    </div>
                                    {experiment.description && (
                                        <p className="text-sm text-base-content/70 line-clamp-2">
                                            {experiment.description}
                                        </p>
                                    )}
                                    <div className="card-actions justify-between items-center mt-4">
                                        <div className="text-xs text-base-content/60">
                                            {new Date(experiment.created_at).toLocaleDateString()}
                                        </div>
                                        <span className="text-sm">
                                            Traffic: {experiment.traffic_allocation}%
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
