import { z } from 'zod';
import { checkDisplayRules, displayRules, POPUP_STATUSES } from './popups';

/**
 * Simple surveys (paid). One question per survey: multiple choice, a 1 to 5 rating, a 0 to 10 NPS question or a short text answer, with an
 * optional comment box. Display rules (trigger, frequency, devices, pages) are the same as for popups.
 * The SDK only loads surveys.js on pages where an active survey matches.
 */
export const MAX_SURVEYS_PER_PROJECT = 20;
/** Individual answers kept per survey per UTC day. Answers past this still count in the response total. */
export const SURVEY_MAX_RESPONSES_PER_DAY = 500;
export const SURVEY_TYPES = ['choice', 'rating', 'nps', 'text'] as const;
export const SURVEY_POSITIONS = ['bottom-right', 'bottom-left', 'center'] as const;
export const SURVEY_METRICS = ['view', 'close', 'response'] as const;
export const RATING_SCALE = 5;
/** Net Promoter Score: 0 to 10, promoters answer 9 or 10, detractors 0 to 6. */
export const NPS_MAX = 10;
export const MAX_ANSWER = 1000;

export const surveyConfigSchema = z.object({
    question: z.string().trim().min(1, 'Add a question').max(200),
    type: z.enum(SURVEY_TYPES).default('choice'),
    options: z.array(z.string().trim().min(1, 'Answers cannot be empty').max(60)).max(6).default([]),
    /** Adds an optional text box under a choice or rating question. */
    comment: z.boolean().default(false),
    comment_label: z.string().trim().max(80).default('Anything else you want to tell us?'),
    button_text: z.string().trim().min(1).max(30).default('Send'),
    thanks: z.string().trim().min(1).max(120).default('Thanks for your answer!'),
    position: z.enum(SURVEY_POSITIONS).default('bottom-right'),
    ...displayRules,
}).superRefine((c, ctx) => {
    checkDisplayRules(c, ctx);
    if (c.type === 'choice' && c.options.length < 2) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Add at least 2 answers to choose from' });
    if (c.type === 'choice' && new Set(c.options.map((o) => o.toLowerCase())).size !== c.options.length) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Each answer must be different' });
});
export type SurveyConfig = z.infer<typeof surveyConfigSchema>;

/** Starting points in the editor. Each only fills the question fields; display rules stay as they are. */
export const SURVEY_TEMPLATES: Array<{ id: string; label: string; fields: Pick<SurveyConfig, 'question' | 'type' | 'options' | 'comment' | 'comment_label'> }> = [
    { id: 'nps', label: 'Net Promoter Score (0 to 10)', fields: { question: 'How likely are you to recommend us to a friend or colleague?', type: 'nps', options: [], comment: true, comment_label: 'What is the main reason for your score?' } },
    { id: 'blocker', label: 'What almost stopped you', fields: { question: 'What almost stopped you from signing up today?', type: 'choice', options: ['The price', 'Not sure it fits my needs', 'Missing a feature', 'Nothing, it was easy'], comment: true, comment_label: 'Anything else you want to tell us?' } },
    { id: 'source', label: 'How did you hear about us', fields: { question: 'How did you hear about us?', type: 'choice', options: ['Search engine', 'Friend or colleague', 'Social media', 'Ad', 'Other'], comment: false, comment_label: 'Anything else you want to tell us?' } },
    { id: 'page', label: 'Was this page helpful', fields: { question: 'How useful was this page?', type: 'rating', options: [], comment: true, comment_label: 'What could make it better?' } },
    { id: 'missing', label: 'Open question', fields: { question: 'What is missing on this page?', type: 'text', options: [], comment: false, comment_label: 'Anything else you want to tell us?' } },
];

export const createSurveySchema = z.object({
    name: z.string().trim().min(1).max(120),
    status: z.enum(POPUP_STATUSES).default('draft'),
    config: surveyConfigSchema,
});
export const updateSurveySchema = z.object({
    name: z.string().trim().min(1).max(120),
    status: z.enum(POPUP_STATUSES),
    config: surveyConfigSchema,
}).partial().strict();

export const surveyEventSchema = z.object({
    survey_id: z.string().min(1).max(64),
    event: z.enum(SURVEY_METRICS),
    answer: z.union([z.string(), z.number()]).optional(),
    comment: z.string().max(MAX_ANSWER * 2).optional(),
    url: z.string().max(2000).optional(),
});

export function parseSurveyConfig(raw: string): SurveyConfig | null {
    try {
        const r = surveyConfigSchema.safeParse(JSON.parse(raw));
        return r.success ? r.data : null;
    } catch {
        return null;
    }
}

const clean = (t: string, max = MAX_ANSWER) => t.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);

/** Checks an answer against the question. Returns the stored answer and comment, or null when it does not fit. */
export function normalizeAnswer(c: SurveyConfig, answer: unknown, comment?: string): { answer: string; comment: string | null } | null {
    let a: string | null = null;
    if (c.type === 'choice') a = typeof answer === 'string' && c.options.includes(answer) ? answer : null;
    else if (c.type === 'rating' || c.type === 'nps') {
        const n = typeof answer === 'number' || (typeof answer === 'string' && answer.trim() !== '') ? Number(answer) : NaN;
        const [lo, hi] = c.type === 'rating' ? [1, RATING_SCALE] : [0, NPS_MAX];
        a = Number.isInteger(n) && n >= lo && n <= hi ? String(n) : null;
    } else a = typeof answer === 'string' && clean(answer) ? clean(answer) : null;
    if (a === null) return null;
    const extra = c.type !== 'text' && c.comment && comment ? clean(comment) : '';
    return { answer: a, comment: extra || null };
}

/** The page path an answer came from, without the query string or fragment. */
export function answerPath(url: string | undefined): string {
    if (!url) return '';
    try { return new URL(url).pathname.slice(0, 300); } catch { return ''; }
}

/** The part of a survey the browser needs. */
export function sdkSurvey(id: string, c: SurveyConfig) {
    return {
        id, question: c.question, type: c.type, options: c.options, comment: c.comment, comment_label: c.comment_label, button_text: c.button_text,
        thanks: c.thanks, position: c.position, color: c.color, trigger: c.trigger, trigger_value: c.trigger_value, frequency: c.frequency, device: c.device,
    };
}
export type SdkSurvey = ReturnType<typeof sdkSurvey>;

export interface SurveyStats { views: number; closes: number; responses: number; rate: number | null }

export function surveyStats(rows: Array<{ survey_id: string; metric: string; count: number }>): Map<string, SurveyStats> {
    const out = new Map<string, SurveyStats>();
    for (const r of rows) {
        const s = out.get(r.survey_id) ?? { views: 0, closes: 0, responses: 0, rate: null };
        if (r.metric === 'view') s.views += r.count;
        if (r.metric === 'close') s.closes += r.count;
        if (r.metric === 'response') s.responses += r.count;
        out.set(r.survey_id, s);
    }
    for (const s of out.values()) s.rate = s.views ? Math.min(1, s.responses / s.views) : null;
    return out;
}

export interface NpsSummary { score: number; promoters: number; passives: number; detractors: number }

/** NPS from 0 to 10 answers: percent promoters (9, 10) minus percent detractors (0 to 6), from -100 to 100. */
export function npsScore(rows: Array<{ answer: string; count: number }>): NpsSummary | null {
    let promoters = 0, passives = 0, detractors = 0;
    for (const r of rows) {
        const n = Number(r.answer);
        if (n >= 9) promoters += r.count; else if (n >= 7) passives += r.count; else detractors += r.count;
    }
    const total = promoters + passives + detractors;
    return total ? { score: Math.round(((promoters - detractors) / total) * 100), promoters, passives, detractors } : null;
}

/** Answer breakdown for the results view: counts per option (or per score), with the rating average or the NPS. */
export function summarizeAnswers(c: SurveyConfig, rows: Array<{ answer: string; count: number }>) {
    const total = rows.reduce((n, r) => n + r.count, 0);
    if (c.type === 'text') return { total, breakdown: [] as Array<{ answer: string; count: number; share: number }>, average: null as number | null, nps: null as NpsSummary | null };
    const keys = c.type === 'choice' ? c.options
        : c.type === 'nps' ? Array.from({ length: NPS_MAX + 1 }, (_, i) => String(i))
            : Array.from({ length: RATING_SCALE }, (_, i) => String(i + 1));
    const m = new Map(rows.map((r) => [r.answer, r.count]));
    const breakdown = keys.map((k) => ({ answer: k, count: m.get(k) ?? 0, share: total ? (m.get(k) ?? 0) / total : 0 }));
    const average = c.type === 'rating' && total ? breakdown.reduce((n, b) => n + Number(b.answer) * b.count, 0) / total : null;
    return { total, breakdown, average, nps: c.type === 'nps' ? npsScore(rows) : null };
}

/** CSV with a header row. Cells starting with = + - @ are prefixed so spreadsheets do not run them as formulas. */
export function responsesCsv(rows: Array<{ created_at: string; answer: string; comment: string | null; path: string }>): string {
    const cell = (v: string | null) => {
        let t = v ?? '';
        if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
        return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    return ['time_utc,answer,comment,page', ...rows.map((r) => [r.created_at, r.answer, r.comment, r.path].map(cell).join(','))].join('\n') + '\n';
}
