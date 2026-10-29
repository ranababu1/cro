import { z } from 'zod';
import type { Experiment, ExperimentStatus } from './types';

/**
 * Experiment management helpers (all plans): tags, archive rules, list search and the name of a copy.
 * Pure functions with no I/O, shared by the API routes and the experiments list.
 */
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;
export const MAX_NOTE_LENGTH = 2000;
/** Only finished or paused tests can be archived. Drafts can be deleted instead; running tests must be paused or stopped first. */
export const ARCHIVABLE_STATUSES: readonly ExperimentStatus[] = ['completed', 'paused'];

const TAG_RE = /^[\p{L}\p{N}][\p{L}\p{N} _.\-/]*$/u;

/** One tag: trimmed, inner spaces collapsed, lower case, letters, digits, spaces and - _ . / only. */
export const tagSchema = z.string()
    .transform((t) => t.trim().replace(/\s+/g, ' ').toLowerCase())
    .pipe(z.string().min(1, 'Tags cannot be empty').max(MAX_TAG_LENGTH, `Tags can be up to ${MAX_TAG_LENGTH} characters`)
        .regex(TAG_RE, 'Tags can use letters, numbers, spaces and - _ . /'));
export const tagsSchema = z.array(tagSchema).max(MAX_TAGS, `A test can have up to ${MAX_TAGS} tags`)
    .transform((ts) => [...new Set(ts)]);
export const noteSchema = z.string().trim().max(MAX_NOTE_LENGTH);

/** Stored JSON to a clean list. Bad or missing values give an empty list. */
export function parseTags(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
        const v: unknown = JSON.parse(raw);
        if (!Array.isArray(v)) return [];
        const r = tagsSchema.safeParse(v.filter((t) => typeof t === 'string').slice(0, MAX_TAGS));
        return r.success ? r.data : [];
    } catch {
        return [];
    }
}

/** A clean list to stored JSON, null when empty. */
export function serializeTags(tags: string[]): string | null {
    return tags.length ? JSON.stringify(tags) : null;
}

/** Empty notes are stored as null. */
export function noteOrNull(v: string | null | undefined): string | null {
    const t = (v ?? '').trim();
    return t ? t.slice(0, MAX_NOTE_LENGTH) : null;
}

export function canArchive(e: Pick<Experiment, 'status' | 'archived_at'>): boolean {
    return !e.archived_at && ARCHIVABLE_STATUSES.includes(e.status);
}

/** Why a test cannot be archived right now, or null when it can. */
export function archiveError(e: Pick<Experiment, 'status' | 'archived_at' | 'rollout_variation_id'>): string | null {
    if (e.archived_at) return 'This test is already archived';
    if (e.status === 'draft') return 'Drafts cannot be archived. Delete the draft instead';
    if (e.status === 'running') return 'Pause or stop the test before archiving it';
    if (e.rollout_variation_id) return 'Stop the rollout before archiving this test, so your site keeps working as you expect';
    return null;
}

/** "Copy of <name>", kept within the 200 character name limit. */
export function copyName(name: string): string {
    return `Copy of ${name}`.slice(0, 200);
}

export type ListView = 'active' | 'archived';

/**
 * The experiments list: archived tests only in the Archived view, then the status tab, the tag and a search over the
 * name, description, hypothesis and tags (case-insensitive, every word must match).
 */
export function filterExperiments<T extends Pick<Experiment, 'name' | 'description' | 'hypothesis' | 'tags' | 'status' | 'archived_at'>>(
    list: T[],
    f: { view?: ListView; status?: string | null; tag?: string | null; q?: string | null },
): T[] {
    const view = f.view ?? 'active';
    const tag = f.tag ? f.tag.trim().toLowerCase() : '';
    const words = (f.q ?? '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 10);
    return list.filter((e) => {
        if (view === 'archived' ? !e.archived_at : !!e.archived_at) return false;
        if (f.status && e.status !== f.status) return false;
        const tags = parseTags(e.tags);
        if (tag && !tags.includes(tag)) return false;
        if (words.length) {
            const hay = [e.name, e.description ?? '', e.hypothesis ?? '', ...tags].join(' ').toLowerCase();
            if (!words.every((w) => hay.includes(w))) return false;
        }
        return true;
    });
}

/** Every tag used in the list, sorted, for the tag filter. */
export function allTags(list: Pick<Experiment, 'tags'>[]): string[] {
    return [...new Set(list.flatMap((e) => parseTags(e.tags)))].sort();
}

const pct = (n: number) => `${Math.round(n * 100) / 100}%`;

/** The expected outcome carried over from a planner idea, such as "A 10% lift in the conversion rate, from 5% to 5.5%." */
export function ideaExpectedOutcome(i: { baseline_rate?: number | null; expected_lift?: number | null }): string {
    const lift = i.expected_lift;
    if (!lift || lift <= 0) return '';
    const base = i.baseline_rate;
    if (base && base > 0 && base < 100) {
        const target = base * (1 + lift / 100);
        if (target < 100) return `A ${pct(lift)} lift in the conversion rate, from ${pct(base)} to ${pct(target)}.`;
    }
    return `A ${pct(lift)} lift in the conversion rate.`;
}
