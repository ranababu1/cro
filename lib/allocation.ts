/** Validation for editing weights and paused flags on an existing test. Pure so it can be unit tested. */
export interface AllocationRow { id: string; weight: number; paused: boolean }

export function checkAllocation(
    current: Array<{ id: string; is_control: boolean }>,
    next: AllocationRow[],
): { ok: true; rows: AllocationRow[] } | { ok: false; error: string } {
    const ids = new Set(current.map((v) => v.id));
    if (next.length !== current.length || new Set(next.map((r) => r.id)).size !== next.length || next.some((r) => !ids.has(r.id))) {
        return { ok: false, error: 'Send every variation of this test exactly once. Variations cannot be added or removed after creation.' };
    }
    const control = current.find((v) => v.is_control);
    const rows = next.map((r) => ({ id: r.id, paused: r.paused, weight: r.paused ? 0 : r.weight }));
    if (control && rows.find((r) => r.id === control.id)?.paused) return { ok: false, error: 'The control cannot be paused' };
    if (!rows.some((r) => !r.paused && r.id !== control?.id && r.weight > 0)) return { ok: false, error: 'Keep at least one variation running beside the control' };
    const total = rows.reduce((a, r) => a + r.weight, 0);
    if (total !== 100) return { ok: false, error: `Weights of active variations must total 100. Currently ${total}.` };
    return { ok: true, rows };
}
