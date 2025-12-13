'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Experiment, Variation, ExperimentResults } from '@/lib/types';

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
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
                <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
            </div>
        );
    }

    if (error || !experiment) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <p className="text-red-800 dark:text-red-200">{error || 'Experiment not found'}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <Link href="/" className="text-blue-600 hover:text-blue-700 dark:text-blue-400">
                        ← Back to Experiments
                    </Link>
                </div>

                {/* Header */}
                <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 mb-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                                {experiment.name}
                            </h1>
                            {experiment.description && (
                                <p className="text-zinc-600 dark:text-zinc-400">{experiment.description}</p>
                            )}
                        </div>
                        <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${experiment.status === 'running'
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

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="text-zinc-500 dark:text-zinc-400">Traffic Allocation</span>
                            <p className="font-medium text-zinc-900 dark:text-white">{experiment.traffic_allocation}%</p>
                        </div>
                        <div>
                            <span className="text-zinc-500 dark:text-zinc-400">Created</span>
                            <p className="font-medium text-zinc-900 dark:text-white">
                                {new Date(experiment.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        {experiment.started_at && (
                            <div>
                                <span className="text-zinc-500 dark:text-zinc-400">Started</span>
                                <p className="font-medium text-zinc-900 dark:text-white">
                                    {new Date(experiment.started_at).toLocaleDateString()}
                                </p>
                            </div>
                        )}
                        {experiment.ended_at && (
                            <div>
                                <span className="text-zinc-500 dark:text-zinc-400">Ended</span>
                                <p className="font-medium text-zinc-900 dark:text-white">
                                    {new Date(experiment.ended_at).toLocaleDateString()}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex gap-3">
                        {experiment.status === 'draft' && (
                            <>
                                <button
                                    onClick={() => updateStatus('running')}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    Start Experiment
                                </button>
                                <button
                                    onClick={deleteExperiment}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    Delete
                                </button>
                            </>
                        )}
                        {experiment.status === 'running' && (
                            <>
                                <button
                                    onClick={() => updateStatus('paused')}
                                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                                >
                                    Pause
                                </button>
                                <button
                                    onClick={() => updateStatus('completed')}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Complete
                                </button>
                            </>
                        )}
                        {experiment.status === 'paused' && (
                            <>
                                <button
                                    onClick={() => updateStatus('running')}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    Resume
                                </button>
                                <button
                                    onClick={() => updateStatus('completed')}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Complete
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Integration Code */}
                <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 mb-6">
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                        Integration Code
                    </h2>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                        Add this code to your website to start running the experiment:
                    </p>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                            💡 <strong>Quick Test:</strong> Visit{' '}
                            <a
                                href="/demo.html"
                                target="_blank"
                                className="underline hover:text-blue-900 dark:hover:text-blue-100"
                            >
                                /demo.html
                            </a>
                            {' '}for a working example. Update the EXPERIMENT_ID in the page source with: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{experimentId}</code>
                        </p>
                    </div>

                    <div className="bg-zinc-900 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-sm text-zinc-100">
                            {`<!-- Add to your website's <head> or before </body> -->
<script src="${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/sdk.js"></script>

<script>
  // Initialize the SDK
  ABTest.init({
    apiUrl: '${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}'
  });

  ${variations.some(v => v.url) ? `// URL-based redirect test (will automatically redirect to variation URLs)
  ABTest.runUrlTest('${experimentId}');
  
  // OR if you want custom logic with URLs:` : '// Run the experiment with custom logic:'}
  ABTest.run('${experimentId}', function(variation) {
    if (variation.assigned) {
      console.log('Assigned to:', variation.variation_name);
      ${variations.some(v => v.url) ? `console.log('Variation URL:', variation.variation_url);` : ''}
      
      // Apply your variation logic here
      ${variations.map((v, i) =>
                                `${i > 0 ? '} else ' : ''}if (variation.variation_name === '${v.name}') {
        // Code for ${v.name}${v.url ? `\n        // URL: ${v.url}` : ''}
        // e.g., document.querySelector('.cta-button').style.backgroundColor = 'blue';`
                            ).join('\n      ')}
      }
    }
  }${variations.some(v => v.url) ? `, { autoRedirect: false } // Set to true to auto-redirect` : ''});

  // Track conversions (add to your conversion button/event)
  document.querySelector('#your-conversion-button').addEventListener('click', function() {
    ABTest.trackConversion('${experimentId}', 'button_click');
  });
</script>`}
                        </pre>
                    </div>

                    <button
                        onClick={() => {
                            const code = `<!-- Add to your website's <head> or before </body> -->
<script src="${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/sdk.js"></script>

<script>
  ABTest.init({
    apiUrl: '${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}'
  });

  ABTest.run('${experimentId}', function(variation) {
    if (variation.assigned) {
      console.log('Assigned to:', variation.variation_name);
      ${variations.map((v, i) =>
                                `${i > 0 ? '} else ' : ''}if (variation.variation_name === '${v.name}') {
        // Code for ${v.name}`
                            ).join('\n      ')}
      }
    }
  });

  document.querySelector('#your-conversion-button').addEventListener('click', function() {
    ABTest.trackConversion('${experimentId}', 'button_click');
  });
</script>`;
                            navigator.clipboard.writeText(code);
                            alert('Code copied to clipboard!');
                        }}
                        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                        Copy Code
                    </button>
                </div>

                {/* Variations */}
                <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 mb-6">
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                        Variations
                    </h2>
                    <div className="space-y-3">
                        {variations.map((variation) => (
                            <div
                                key={variation.id}
                                className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                        <h3 className="font-medium text-zinc-900 dark:text-white">
                                            {variation.name}
                                            {variation.is_control && (
                                                <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                                                    Control
                                                </span>
                                            )}
                                        </h3>
                                        {variation.url && (
                                            <div className="mt-2">
                                                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">URL:</span>
                                                <a
                                                    href={variation.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="ml-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                                >
                                                    {variation.url}
                                                </a>
                                            </div>
                                        )}
                                        {variation.description && (
                                            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                                                {variation.description}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400 ml-4">
                                        {variation.weight}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Results */}
                {results && (
                    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                            Results
                        </h2>

                        {results.sample_size < 100 ? (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                                <p className="text-yellow-800 dark:text-yellow-200">
                                    Insufficient data for statistical analysis. Minimum 100 users per variation recommended.
                                </p>
                            </div>
                        ) : results.statistical_significance?.is_significant && results.winner ? (
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                                <p className="text-green-800 dark:text-green-200 font-medium">
                                    Statistical significance detected! p-value: {results.statistical_significance.p_value.toFixed(4)}
                                </p>
                            </div>
                        ) : null}

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                                        <th className="text-left py-3 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                            Variation
                                        </th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                            Users
                                        </th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                            Conversions
                                        </th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                            Conv. Rate
                                        </th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                            95% CI
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.variations.map((variation) => (
                                        <tr
                                            key={variation.variation_id}
                                            className={`border-b border-zinc-100 dark:border-zinc-800 ${variation.variation_id === results.winner
                                                ? 'bg-green-50 dark:bg-green-900/10'
                                                : ''
                                                }`}
                                        >
                                            <td className="py-3 px-4">
                                                <span className="font-medium text-zinc-900 dark:text-white">
                                                    {variation.variation_name}
                                                </span>
                                                {variation.is_control && (
                                                    <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                                                        (Control)
                                                    </span>
                                                )}
                                                {variation.variation_id === results.winner && (
                                                    <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-medium">
                                                        Winner
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right text-zinc-900 dark:text-white">
                                                {variation.total_users.toLocaleString()}
                                            </td>
                                            <td className="py-3 px-4 text-right text-zinc-900 dark:text-white">
                                                {variation.conversions.toLocaleString()}
                                            </td>
                                            <td className="py-3 px-4 text-right text-zinc-900 dark:text-white font-medium">
                                                {(variation.conversion_rate * 100).toFixed(2)}%
                                            </td>
                                            <td className="py-3 px-4 text-right text-sm text-zinc-600 dark:text-zinc-400">
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
                )}
            </div>
        </div>
    );
}
