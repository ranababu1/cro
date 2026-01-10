'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Navbar from '@/app/components/Navbar';

interface Variation {
    name: string;
    description: string;
    url: string;
    weight: number;
    is_control: boolean;
}

export default function NewExperiment() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [trafficAllocation, setTrafficAllocation] = useState(100);
    const [variations, setVariations] = useState<Variation[]>([
        { name: 'Control', description: '', url: '', weight: 50, is_control: true },
        { name: 'Variation A', description: '', url: '', weight: 50, is_control: false },
    ]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/api/auth/signin');
        }
    }, [status, router]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-base-100 flex items-center justify-center">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    if (!session) {
        return null;
    }

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
        <div className="min-h-screen bg-base-100">
            <Navbar />
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="text-sm breadcrumbs mb-6">
                    <ul>
                        <li><Link href="/">Dashboard</Link></li>
                        <li>New Experiment</li>
                    </ul>
                </div>

                <h1 className="text-4xl font-bold mb-8">
                    Create New Experiment
                </h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="card bg-base-200 shadow-xl">
                        <div className="card-body">
                            <h2 className="card-title text-2xl mb-4">
                                Basic Information
                            </h2>

                            <div className="space-y-4">
                                <div className="form-control">
                                    <label className="label" htmlFor="name">
                                        <span className="label-text font-medium">Experiment Name *</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        className="input input-bordered w-full"
                                        placeholder="e.g., Homepage Hero Test"
                                    />
                                </div>

                                <div className="form-control">
                                    <label className="label" htmlFor="description">
                                        <span className="label-text font-medium">Description</span>
                                    </label>
                                    <textarea
                                        id="description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={3}
                                        className="textarea textarea-bordered w-full"
                                        placeholder="What are you testing?"
                                    />
                                </div>

                                <div className="form-control">
                                    <label className="label" htmlFor="traffic">
                                        <span className="label-text font-medium">
                                            Traffic Allocation: {trafficAllocation}%
                                        </span>
                                    </label>
                                    <input
                                        type="range"
                                        id="traffic"
                                        min="0"
                                        max="100"
                                        value={trafficAllocation}
                                        onChange={(e) => setTrafficAllocation(parseInt(e.target.value))}
                                        className="range range-primary"
                                    />
                                    <div className="w-full flex justify-between text-xs px-2 mt-2">
                                        <span>0%</span>
                                        <span>25%</span>
                                        <span>50%</span>
                                        <span>75%</span>
                                        <span>100%</span>
                                    </div>
                                    <label className="label">
                                        <span className="label-text-alt text-base-content/70">
                                            Percentage of users to include in the experiment
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Variations */}
                    <div className="card bg-base-200 shadow-xl">
                        <div className="card-body">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="card-title text-2xl">
                                    Variations
                                </h2>
                                <button
                                    type="button"
                                    onClick={addVariation}
                                    className="btn btn-sm btn-outline"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                    </svg>
                                    Add Variation
                                </button>
                            </div>

                            <div className="space-y-4">
                                {variations.map((variation, index) => (
                                    <div
                                        key={index}
                                        className="card bg-base-300 border-2 border-base-content/10"
                                    >
                                        <div className="card-body p-4">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="form-control">
                                                    <label className="label cursor-pointer gap-2 p-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={variation.is_control}
                                                            onChange={(e) => updateVariation(index, 'is_control', e.target.checked)}
                                                            className="checkbox checkbox-primary checkbox-sm"
                                                        />
                                                        <span className="label-text font-medium">
                                                            Control
                                                        </span>
                                                    </label>
                                                </div>
                                                {variations.length > 2 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeVariation(index)}
                                                        className="btn btn-ghost btn-xs text-error"
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="form-control">
                                                    <label className="label">
                                                        <span className="label-text font-medium">Name *</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={variation.name}
                                                        onChange={(e) => updateVariation(index, 'name', e.target.value)}
                                                        required
                                                        className="input input-bordered input-sm w-full"
                                                    />
                                                </div>

                                                <div className="form-control">
                                                    <label className="label">
                                                        <span className="label-text font-medium">Weight: {variation.weight}%</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={variation.weight}
                                                        onChange={(e) => updateVariation(index, 'weight', parseInt(e.target.value) || 0)}
                                                        className="input input-bordered input-sm w-full"
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-control mt-3">
                                                <label className="label">
                                                    <span className="label-text font-medium">URL</span>
                                                </label>
                                                <input
                                                    type="url"
                                                    value={variation.url}
                                                    onChange={(e) => updateVariation(index, 'url', e.target.value)}
                                                    className="input input-bordered input-sm w-full"
                                                    placeholder="https://example.com/page-a"
                                                />
                                                <label className="label">
                                                    <span className="label-text-alt text-base-content/70">
                                                        The URL to show for this variation
                                                    </span>
                                                </label>
                                            </div>

                                            <div className="form-control mt-3">
                                                <label className="label">
                                                    <span className="label-text font-medium">Description</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={variation.description}
                                                    onChange={(e) => updateVariation(index, 'description', e.target.value)}
                                                    className="input input-bordered input-sm w-full"
                                                    placeholder="What's different in this variation?"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="alert alert-error">
                            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-4">
                        <Link href="/" className="btn btn-ghost">
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="btn btn-primary"
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="loading loading-spinner"></span>
                                    Creating...
                                </>
                            ) : (
                                'Create Experiment'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
