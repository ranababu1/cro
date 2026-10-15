import { z } from 'zod';
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/** Select options. Values are stored; labels are shown. */
export const JOB_ROLES = ['Founder or owner', 'Marketing', 'Growth', 'Product', 'Engineering', 'Design', 'Agency or consultant', 'Other'] as const;
export const COMPANY_SIZES = ['Just me', '2-10', '11-50', '51-200', '201-1000', '1000+'] as const;
export const HEARD_FROM = ['Search engine', 'Social media', 'Friend or colleague', 'Blog or article', 'WordPress directory', 'Community or forum', 'Other'] as const;
export const PRIMARY_GOALS = ['Increase conversions', 'Test landing pages', 'Improve signups', 'Grow revenue', 'Learn A/B testing', 'Other'] as const;

const names = new Intl.DisplayNames(['en'], { type: 'region' });
/** ISO 3166 alpha-2 countries with their calling codes, sorted by name. */
export const COUNTRIES: { code: CountryCode; name: string; dial: string }[] = getCountries()
    .map((code) => ({ code, name: names.of(code) ?? code, dial: `+${getCountryCallingCode(code)}` }))
    .sort((a, b) => a.name.localeCompare(b.name));
const COUNTRY_CODES = new Set<string>(COUNTRIES.map((c) => c.code));

/** Strips control characters and angle brackets, collapses whitespace. React escapes on render too. */
export function cleanText(v: string): string {
     
    return v.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
}
const text = (max: number) => z.string().max(max * 2).transform(cleanText).pipe(z.string().max(max));
const optionalText = (max: number) => z.union([text(max), z.null(), z.undefined()]).transform((v) => (v ? v : null));
const optionalChoice = <T extends readonly [string, ...string[]]>(values: T) =>
    z.union([z.enum(values), z.literal(''), z.null(), z.undefined()]).transform((v) => (v ? v : null));

export const profileSchema = z.object({
    first_name: text(60).pipe(z.string().min(1, 'First name is required')),
    last_name: text(60).pipe(z.string().min(1, 'Last name is required')),
    country: z.string().refine((c) => COUNTRY_CODES.has(c), 'Choose your country'),
    phone: z.union([z.string().max(40), z.null(), z.undefined()]).transform((v) => (v ? v.trim() : '')),
    company: optionalText(120),
    job_role: optionalChoice(JOB_ROLES as unknown as [string, ...string[]]),
    company_size: optionalChoice(COMPANY_SIZES as unknown as [string, ...string[]]),
    heard_from: optionalChoice(HEARD_FROM as unknown as [string, ...string[]]),
    primary_goal: optionalChoice(PRIMARY_GOALS as unknown as [string, ...string[]]),
    marketing_opt_in: z.boolean().optional().default(false),
}).transform((v, ctx) => {
    let phone: string | null = null;
    if (v.phone) {
        const parsed = parsePhoneNumberFromString(v.phone, v.country as CountryCode);
        if (!parsed || !parsed.isValid()) {
            ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Enter a valid phone number with country code, for example +14155550123' });
            return z.NEVER;
        }
        phone = parsed.number; // E.164
    }
    return { ...v, phone };
});
export type ProfileInput = z.infer<typeof profileSchema>;

type ProfileFields = { first_name?: string | null; last_name?: string | null; country?: string | null };
export function isProfileComplete(u: ProfileFields | null | undefined): boolean {
    return !!(u?.first_name && u.last_name && u.country);
}

export const PROFILE_REQUIRED_MESSAGE = 'Complete your profile to create experiments.';

/** Only same-site relative paths are allowed as a return target. */
export function safeNext(next: string | null | undefined, fallback = '/dashboard'): string {
    if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
    return next;
}

/** Splits a Google display name when given/family names are missing. */
export function splitName(name: string | null | undefined): { first: string; last: string } {
    const parts = cleanText(name ?? '').split(' ').filter(Boolean);
    if (parts.length === 0) return { first: '', last: '' };
    return { first: parts[0], last: parts.slice(1).join(' ') };
}

/** CSV cell: quoted, with spreadsheet formula injection neutralised. */
export function csvCell(v: unknown): string {
    let s = v === null || v === undefined ? '' : String(v);
    // E.164 phone numbers are plain digits and safe; anything else starting with a formula character is prefixed.
    if (/^[=+\-@\t\r]/.test(s) && !/^\+\d{6,15}$/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
}

export type ProfileValues = {
    first_name: string; last_name: string; country: string; phone: string; company: string;
    job_role: string; company_size: string; heard_from: string; primary_goal: string; marketing_opt_in: boolean;
};

export function toValues(u: { first_name?: string | null; last_name?: string | null; country?: string | null; phone?: string | null; company?: string | null; job_role?: string | null; company_size?: string | null; heard_from?: string | null; primary_goal?: string | null; marketing_opt_in?: boolean | null; name?: string | null }): ProfileValues {
    return {
        first_name: u.first_name ?? '', last_name: u.last_name ?? '', country: u.country ?? '', phone: u.phone ?? '', company: u.company ?? '',
        job_role: u.job_role ?? '', company_size: u.company_size ?? '', heard_from: u.heard_from ?? '', primary_goal: u.primary_goal ?? '',
        marketing_opt_in: !!u.marketing_opt_in,
    };
}
