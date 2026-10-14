/** Integer clamp for traffic weights. */
export function clampWeight(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, Math.round(n)));
}

/** Even split across n variations that always sums to exactly 100. */
export function evenWeights(n: number): number[] {
    if (n <= 0) return [];
    if (n === 1) return [100];
    const base = Math.floor(100 / n);
    const weights = Array.from({ length: n }, () => base);
    weights[0] += 100 - weights.reduce((a, b) => a + b, 0);
    return weights;
}

/**
 * After the user edits one variation weight, redistribute so the total is exactly 100.
 * Prefers putting the remainder on the last non-edited variation (keeping other
 * non-edited weights). If that is impossible (remainder outside 0-100), splits the
 * remainder proportionally across all non-edited variations.
 */
export function redistributeWeights(weights: number[], editedIndex: number, rawValue: number): number[] {
    const n = weights.length;
    if (n <= 0) return [];
    if (n === 1) return [100];
    if (editedIndex < 0 || editedIndex >= n) return evenWeights(n);

    const edited = clampWeight(rawValue);
    const others = Array.from({ length: n }, (_, i) => i).filter((i) => i !== editedIndex);

    // Prefer: keep earlier non-edited weights, last non-edited absorbs the remainder.
    const last = others[others.length - 1];
    const kept = others.slice(0, -1);
    const current = weights.map((w) => clampWeight(w));
    let keptSum = 0;
    for (const i of kept) keptSum += current[i];

    if (edited + keptSum <= 100) {
        const remainder = 100 - edited - keptSum;
        if (remainder >= 0 && remainder <= 100) {
            const next = current.slice();
            next[editedIndex] = edited;
            for (const i of kept) next[i] = current[i];
            next[last] = remainder;
            return ensureSum100(next, editedIndex);
        }
    }

    return proportionalRemainder(current, editedIndex, edited);
}

function proportionalRemainder(current: number[], editedIndex: number, edited: number): number[] {
    const others = Array.from({ length: current.length }, (_, i) => i).filter((i) => i !== editedIndex);
    const remainder = 100 - edited;
    const mass = others.reduce((s, i) => s + Math.max(current[i], 0), 0);
    const next = current.slice();
    next[editedIndex] = edited;

    if (others.length === 1) {
        next[others[0]] = remainder;
        return ensureSum100(next, editedIndex);
    }

    let allocated = 0;
    for (let k = 0; k < others.length - 1; k++) {
        const i = others[k];
        const share = mass > 0 ? remainder * (Math.max(current[i], 0) / mass) : remainder / others.length;
        const w = clampWeight(share);
        next[i] = w;
        allocated += w;
    }
    const last = others[others.length - 1];
    next[last] = clampWeight(remainder - allocated);
    // If rounding left us off, fix using the last non-edited slot.
    return ensureSum100(next, editedIndex);
}

/** Force exact sum of 100 by adjusting the preferred index (fallback: last slot). Never changes if already 100. */
export function ensureSum100(weights: number[], preferIndex?: number): number[] {
    const next = weights.map(clampWeight);
    if (next.length === 0) return next;
    if (next.length === 1) return [100];
    const sum = next.reduce((a, b) => a + b, 0);
    const delta = 100 - sum;
    if (delta === 0) return next;
    let idx = preferIndex != null && preferIndex >= 0 && preferIndex < next.length ? preferIndex : next.length - 1;
    // Prefer adjusting a different index than the one the user just set when possible.
    if (preferIndex != null && next.length > 1) {
        idx = preferIndex === next.length - 1 ? next.length - 2 : next.length - 1;
        // Actually: adjust last index that isn't preferIndex
        idx = next.length - 1 === preferIndex ? next.length - 2 : next.length - 1;
    }
    next[idx] = clampWeight(next[idx] + delta);
    // If clamp ate the delta, dump remainder onto any slot that can take it.
    let again = 100 - next.reduce((a, b) => a + b, 0);
    if (again !== 0) {
        for (let i = next.length - 1; i >= 0 && again !== 0; i--) {
            const before = next[i];
            next[i] = clampWeight(next[i] + again);
            again -= next[i] - before;
        }
    }
    return next;
}
