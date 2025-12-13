import Link from 'next/link';
import { Experiment } from '@/lib/types';

async function getExperiments(): Promise<Experiment[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/experiments`, {
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

export default async function Home() {
  const experiments = await getExperiments();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
            A/B Testing Platform
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Manage and analyze your experiments
          </p>
        </div>

        {/* Actions */}
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
            Experiments
          </h2>
          <Link
            href="/experiments/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Experiment
          </Link>
        </div>

        {/* Experiments List */}
        {experiments.length === 0 ? (
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-12 text-center">
            <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
              No experiments yet
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Get started by creating your first experiment
            </p>
            <Link
              href="/experiments/new"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Your First Experiment
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {experiments.map((experiment) => (
              <Link
                key={experiment.id}
                href={`/experiments/${experiment.id}`}
                className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                      {experiment.name}
                    </h3>
                    {experiment.description && (
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {experiment.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${experiment.status === 'running'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : experiment.status === 'draft'
                          ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                          : experiment.status === 'paused'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      }`}
                  >
                    {experiment.status}
                  </span>
                </div>
                <div className="flex gap-6 text-sm text-zinc-600 dark:text-zinc-400">
                  <div>
                    <span className="font-medium">Traffic:</span> {experiment.traffic_allocation}%
                  </div>
                  <div>
                    <span className="font-medium">Created:</span>{' '}
                    {new Date(experiment.created_at).toLocaleDateString()}
                  </div>
                  {experiment.started_at && (
                    <div>
                      <span className="font-medium">Started:</span>{' '}
                      {new Date(experiment.started_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
