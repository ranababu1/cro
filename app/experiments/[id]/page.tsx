'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Experiment, Variation, ExperimentResults } from '@/lib/types';
import Navbar from '@/app/components/Navbar';

export default function ExperimentDetail() {
    const params = useParams();
    const router = useRouter();
    const experimentId = params.id as string;

    const [experiment, setExperiment] = useState<Experiment | null>(null);
    const [variations, setVariations] = useState<Variation[]>([]);
    const [results, setResults] = useState<ExperimentResults | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchData();
    }, [experimentId]);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch experiment details
            const expRes = await fetch(`/api/experiments/${experimentId}`);
            if (!expRes.ok) throw new Error('Failed to fetch experiment');
            const expData = await expRes.json();

            setExperiment(expData.experiment);
            setVariations(expData.variations);

            // Fetch results if experiment is not draft
            if (expData.experiment.status !== 'draft') {
                const resultsRes = await fetch(`/api/experiments/${experimentId}/results`);
                if (resultsRes.ok) {
                    const resultsData = await resultsRes.json();
                    setResults(resultsData);
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (newStatus: string) => {
        try {
            const res = await fetch(`/api/experiments/${experimentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }

            await fetchData();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const deleteExperiment = async () => {
        if (!confirm('Are you sure you want to delete this experiment?')) {
            return;
        }

        try {
            const res = await fetch(`/api/experiments/${experimentId}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }

            router.push('/');
        } catch (err: any) {
            setError(err.message);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-base-100">
                <Navbar />
                <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                </div>
            </div>
        );
    }

    if (error || !experiment) {
        return (
            <div className="min-h-screen bg-base-100">
                <Navbar />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="alert alert-error">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{error || 'Experiment not found'}</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-base-100">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="text-sm breadcrumbs mb-6">
                    <ul>
                        <li><Link href="/">Dashboard</Link></li>
                        <li>{experiment.name}</li>
                    </ul>
                </div>

                {/* Header */}
                <div className="card bg-base-200 shadow-xl mb-6">
                    <div className="card-body">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h1 className="text-4xl font-bold mb-2">
                                    {experiment.name}
                                </h1>
                                {experiment.description && (
                                    <p className="text-base-content/70">{experiment.description}</p>
                                )}
                            </div>
                            <div className="badge badge-lg"
                                style={{
                                    backgroundColor:
                                        experiment.status === 'running'
                                            ? 'hsl(var(--su))'
                                            : experiment.status === 'draft'
                                                ? 'hsl(var(--b3))'
                                                : experiment.status === 'paused'
                                                    ? 'hsl(var(--wa))'
                                                    : 'hsl(var(--in))',
                                }}
                            >
                                {experiment.status}
                            </div>
                        </div>

                        <div className="stats stats-vertical lg:stats-horizontal shadow bg-base-300 mt-4">
                            <div className="stat">
                                <div className="stat-title">Traffic Allocation</div>
                                <div className="stat-value text-2xl">{experiment.traffic_allocation}%</div>
                            </div>
                            <div className="stat">
                                <div className="stat-title">Created</div>
                                <div className="stat-value text-2xl">
                                    {new Date(experiment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </div>
                            </div>
                            {experiment.started_at && (
                                <div className="stat">
                                    <div className="stat-title">Started</div>
                                    <div className="stat-value text-2xl">
                                        {new Date(experiment.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </div>
                                </div>
                            )}
                            {experiment.ended_at && (
                                <div className="stat">
                                    <div className="stat-title">Ended</div>
                                    <div className="stat-value text-2xl">
                                        {new Date(experiment.ended_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="mt-6 flex gap-3">
                            {experiment.status === 'draft' && (
                                <>
                                    <button
                                        onClick={() => updateStatus('running')}
                                        className="btn btn-success"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                        </svg>
                                        Start Experiment
                                    </button>
                                    <button
                                        onClick={deleteExperiment}
                                        className="btn btn-error btn-outline"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        Delete
                                    </button>
                                </>
                            )}
                            {experiment.status === 'running' && (
                                <>
                                    <button
                                        onClick={() => updateStatus('paused')}
                                        className="btn btn-warning"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        Pause
                                    </button>
                                    <button
                                        onClick={() => updateStatus('completed')}
                                        className="btn btn-info"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        Complete
                                    </button>
                                </>
                            )}
                            {experiment.status === 'paused' && (
                                <>
                                    <button
                                        onClick={() => updateStatus('running')}
                                        className="btn btn-success"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                        </svg>
                                        Resume
                                    </button>
                                    <button
                                        onClick={() => updateStatus('completed')}
                                        className="btn btn-info"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        Complete
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Integration Code */}
                <div className="card bg-base-200 shadow-xl mb-6">
                    <div className="card-body">
                        <h2 className="card-title text-2xl mb-4">
                            Integration Code
                        </h2>
                        <p className="text-sm text-base-content/70 mb-2">
                            Add this code to your website to start running the experiment:
                        </p>
                        <div className="alert alert-info mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <div className="text-sm">
                                <strong>Quick Test:</strong> Visit{' '}
                                <a
                                    href="/demo.html"
                                    target="_blank"
                                    className="underline font-semibold"
                                >
                                    /demo.html
                                </a>
                                {' '}for a working example. Update the EXPERIMENT_ID with: <kbd className="kbd kbd-sm">{experimentId}</kbd>
                            </div>
                        </div>

                        <div className="mockup-code bg-neutral text-neutral-content">
                            <pre className="px-5"><code className="text-xs">{`<!-- Add to your website's <head> or before </body> -->
<script src="${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/sdk.js"></script>

<script>
  ABTest.init({
    apiUrl: '${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}'
  });

  ABTest.run('${experimentId}', function(variation) {
    if (variation.assigned) {
      console.log('Assigned to:', variation.variation_name);
      // Apply your variation logic here
    }
  });

  document.querySelector('#your-conversion-button').addEventListener('click', function() {
    ABTest.trackConversion('${experimentId}', 'button_click');
  });
</script>`}</code></pre>
                        </div>

                        <button
                            onClick={() => {
                                const code = `<script src="${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/sdk.js"></script>
<script>
  ABTest.init({ apiUrl: '${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}' });
  ABTest.run('${experimentId}', function(variation) {
    if (variation.assigned) {
      console.log('Assigned to:', variation.variation_name);
    }
  });
</script>`;
                                navigator.clipboard.writeText(code);
                                alert('Code copied to clipboard!');
                            }}
                            className="btn btn-primary mt-3"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                            </svg>
                            Copy Code
                        </button>
                    </div>
                </div>

                {/* Variations */}
                <div className="card bg-base-200 shadow-xl mb-6">
                    <div className="card-body">
                        <h2 className="card-title text-2xl mb-4">
                            Variations
                        </h2>
                        <div className="space-y-3">
                            {variations.map((variation) => (
                                <div
                                    key={variation.id}
                                    className="card bg-base-300 border-2 border-base-content/10"
                                >
                                    <div className="card-body p-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-lg">
                                                    {variation.name}
                                                    {variation.is_control && (
                                                        <span className="ml-2 badge badge-primary badge-sm">
                                                            Control
                                                        </span>
                                                    )}
                                                </h3>
                                                {variation.url && (
                                                    <div className="mt-2">
                                                        <span className="text-xs font-medium text-base-content/70">URL:</span>
                                                        <a
                                                            href={variation.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="ml-2 text-sm link link-primary"
                                                        >
                                                            {variation.url}
                                                        </a>
                                                    </div>
                                                )}
                                                {variation.description && (
                                                    <p className="mt-1 text-sm text-base-content/70">
                                                        {variation.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="badge badge-lg badge-outline">
                                                {variation.weight}%
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Results */}
                {results && (
                    <div className="card bg-base-200 shadow-xl">
                        <div className="card-body">
                            <h2 className="card-title text-2xl mb-4">
                                Results
                            </h2>

                            {results.sample_size < 100 ? (
                                <div className="alert alert-warning mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <span>Insufficient data for statistical analysis. Minimum 100 users per variation recommended.</span>
                                </div>
                            ) : results.statistical_significance?.is_significant && results.winner ? (
                                <div className="alert alert-success mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                        <strong>Statistical significance detected!</strong>
                                        <div className="text-sm">p-value: {results.statistical_significance.p_value.toFixed(4)}</div>
                                    </div>
                                </div>
                            ) : null}

                            <div className="overflow-x-auto">
                                <table className="table table-zebra">
                                    <thead>
                                        <tr>
                                            <th>Variation</th>
                                            <th className="text-right">Users</th>
                                            <th className="text-right">Conversions</th>
                                            <th className="text-right">Conv. Rate</th>
                                            <th className="text-right">95% CI</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.variations.map((variation) => (
                                            <tr
                                                key={variation.variation_id}
                                                className={variation.variation_id === results.winner ? 'bg-success/20' : ''}
                                            >
                                                <td>
                                                    <div className="font-semibold">
                                                        {variation.variation_name}
                                                        {variation.is_control && (
                                                            <span className="ml-2 text-xs text-base-content/70">
                                                                (Control)
                                                            </span>
                                                        )}
                                                        {variation.variation_id === results.winner && (
                                                            <span className="ml-2 badge badge-success badge-sm">
                                                                Winner
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-right font-mono">
                                                    {variation.total_users.toLocaleString()}
                                                </td>
                                                <td className="text-right font-mono">
                                                    {variation.conversions.toLocaleString()}
                                                </td>
                                                <td className="text-right font-mono font-semibold">
                                                    {(variation.conversion_rate * 100).toFixed(2)}%
                                                </td>
                                                <td className="text-right text-sm font-mono">
                                                    {variation.confidence_interval
                                                        ? `${(variation.confidence_interval.lower * 100).toFixed(2)}% - ${(
                                                            variation.confidence_interval.upper * 100
                                                        ).toFixed(2)}%`
                                                        : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
