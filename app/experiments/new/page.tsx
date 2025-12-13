'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Variation {
    name: string;
    description: string;
    url: string;
    weight: number;
    is_control: boolean;
}

export default function NewExperiment() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [trafficAllocation, setTrafficAllocation] = useState(100);
    const [variations, setVariations] = useState<Variation[]>([
        { name: 'Control', description: '', url: '', weight: 50, is_control: true },
        { name: 'Variation A', description: '', url: '', weight: 50, is_control: false },
    ]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const addVariation = () => {
        const currentCount = variations.length;
        const newWeight = Math.floor(100 / (currentCount + 1));

        // Redistribute weights
        const updatedVariations = variations.map(v => ({
            ...v,
            weight: newWeight,
        }));

        updatedVariations.push({
            name: `Variation ${String.fromCharCode(65 + currentCount - 1)}`,
            description: '',
            url: '',
            weight: newWeight,
            is_control: false,
        });

        setVariations(updatedVariations);
    };

    const removeVariation = (index: number) => {
        if (variations.length <= 2) {
            setError('Must have at least 2 variations');
            return;
        }

        const newVariations = variations.filter((_, i) => i !== index);

        // Redistribute weights
        const newWeight = Math.floor(100 / newVariations.length);
        const redistributed = newVariations.map(v => ({
            ...v,
            weight: newWeight,
        }));

        setVariations(redistributed);
    };

    const updateVariation = (index: number, field: keyof Variation, value: any) => {
        const updated = [...variations];
        updated[index] = { ...updated[index], [field]: value };

        // Ensure only one control
        if (field === 'is_control' && value === true) {
            updated.forEach((v, i) => {
                if (i !== index) {
                    v.is_control = false;
                }
            });
        }

        setVariations(updated);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            // Validate weights sum to 100
            const totalWeight = variations.reduce((sum, v) => sum + v.weight, 0);
            if (Math.abs(totalWeight - 100) > 0.01) {
                setError('Variation weights must sum to 100');
                setIsSubmitting(false);
                return;
            }

            // Ensure one control
            const controlCount = variations.filter(v => v.is_control).length;
            if (controlCount !== 1) {
                setError('Exactly one variation must be marked as control');
                setIsSubmitting(false);
                return;
            }

            const response = await fetch('/api/experiments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    description,
                    traffic_allocation: trafficAllocation,
                    variations,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create experiment');
            }

            const data = await response.json();
            router.push(`/experiments/${data.experiment.id}`);
        } catch (err: any) {
            setError(err.message);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <Link href="/" className="text-blue-600 hover:text-blue-700 dark:text-blue-400">
                        ← Back to Experiments
                    </Link>
                </div>

                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-8">
                    Create New Experiment
                </h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                            Basic Information
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    Experiment Name *
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g., Homepage Hero Test"
                                />
                            </div>

                            <div>
                                <label htmlFor="description" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    Description
                                </label>
                                <textarea
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="What are you testing?"
                                />
                            </div>

                            <div>
                                <label htmlFor="traffic" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    Traffic Allocation: {trafficAllocation}%
                                </label>
                                <input
                                    type="range"
                                    id="traffic"
                                    min="0"
                                    max="100"
                                    value={trafficAllocation}
                                    onChange={(e) => setTrafficAllocation(parseInt(e.target.value))}
                                    className="w-full"
                                />
                                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                    Percentage of users to include in the experiment
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Variations */}
                    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                                Variations
                            </h2>
                            <button
                                type="button"
                                onClick={addVariation}
                                className="px-4 py-2 text-sm bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                            >
                                Add Variation
                            </button>
                        </div>

                        <div className="space-y-4">
                            {variations.map((variation, index) => (
                                <div
                                    key={index}
                                    className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={variation.is_control}
                                                onChange={(e) => updateVariation(index, 'is_control', e.target.checked)}
                                                className="rounded"
                                            />
                                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                                Control
                                            </label>
                                        </div>
                                        {variations.length > 2 && (
                                            <button
                                                type="button"
                                                onClick={() => removeVariation(index)}
                                                className="text-red-600 hover:text-red-700 text-sm"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                                Name *
                                            </label>
                                            <input
                                                type="text"
                                                value={variation.name}
                                                onChange={(e) => updateVariation(index, 'name', e.target.value)}
                                                required
                                                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                                Weight: {variation.weight}%
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={variation.weight}
                                                onChange={(e) => updateVariation(index, 'weight', parseInt(e.target.value) || 0)}
                                                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                            URL
                                        </label>
                                        <input
                                            type="url"
                                            value={variation.url}
                                            onChange={(e) => updateVariation(index, 'url', e.target.value)}
                                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="https://example.com/page-a"
                                        />
                                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                            The URL to show for this variation
                                        </p>
                                    </div>

                                    <div className="mt-3">
                                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                            Description
                                        </label>
                                        <input
                                            type="text"
                                            value={variation.description}
                                            onChange={(e) => updateVariation(index, 'description', e.target.value)}
                                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="What's different in this variation?"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                            <p className="text-red-800 dark:text-red-200">{error}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-4">
                        <Link
                            href="/"
                            className="px-6 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Creating...' : 'Create Experiment'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
