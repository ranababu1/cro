/**
 * Customer audit log (paid plans, read-only). Entries are kept per plan, matching the pricing table:
 * Starter 90 days, Growth 1 year, Enterprise 2 years. Free orgs keep 30 days (not shown, so an upgrade
 * shows recent history). The retention job deletes older rows; the view never shows them either.
 */
export const AUDIT_RETENTION_DAYS = { free: 30, starter: 90, growth: 365, enterprise: 730 } as const;
export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_ENTITIES = ['experiment', 'survey', 'popup', 'domain', 'api_key', 'organization', 'member', 'project'] as const;

/** Unknown paid plan names get the Starter period, a missing plan is Free. */
export function auditRetentionDays(plan: string | null | undefined): number {
    const p = (plan ?? 'free').toLowerCase();
    return p in AUDIT_RETENTION_DAYS ? AUDIT_RETENTION_DAYS[p as keyof typeof AUDIT_RETENTION_DAYS] : AUDIT_RETENTION_DAYS.starter;
}

export interface AuditRow {
    id: string; entity: string; entity_id: string; action: string; diff: string | null; created_at: string;
    actor_id: string | null; actor_name: string | null; actor_email: string | null; actor_member: number | null;
}
export interface AuditEntry {
    id: string; at: string; entity: string; entity_id: string; action: string; label: string;
    actor: { kind: 'member' | 'team' | 'system' | 'former'; name: string };
    details: string | null;
}

/** Internal entries never shown to customers (anti-abuse records and support-only settings). */
export function isCustomerVisible(entity: string, action: string): boolean {
    if (entity === 'abuse' || action.startsWith('abuse:')) return false;
    if (action === 'admin:special_friend') return false;
    return true;
}

const ENTITY_NAMES: Record<string, string> = { experiment: 'Test', survey: 'Survey', popup: 'Popup', domain: 'Domain', api_key: 'API key', organization: 'Organization', member: 'Member', project: 'Project' };
const ACTION_NAMES: Record<string, string> = {
    create: 'created', update: 'updated', delete: 'deleted', revoke: 'revoked', rename: 'renamed',
    'invite:create': 'invite link created', 'invite:revoke': 'invite cancelled', join: 'joined', role: 'role changed', remove: 'removed', leave: 'left',
    'goal:remove': 'goal removed', 'goal:reorder': 'goals reordered', 'goal:primary': 'primary goal changed',
    'funnel:add': 'funnel added', 'funnel:remove': 'funnel removed',
    'share:create': 'share link created', 'share:revoke': 'share link revoked',
    'auto_shift:on': 'auto-shift turned on', 'auto_shift:off': 'auto-shift turned off',
    'heatmap:export': 'heatmap data downloaded', 'heatmaps:settings': 'heatmap sampling or stop rules changed', 'heatmaps:restart': 'new heatmap collection period started',
    allocation: 'traffic split changed', 'allocation:auto': 'traffic split changed by auto-shift', 'variation:changes': 'visual changes saved',
    'status:running': 'started', 'status:paused': 'paused', 'status:completed': 'stopped', 'status:draft': 'moved back to draft',
    'admin:suspend': 'suspended', 'admin:reactivate': 'reactivated', 'admin:update': 'plan or limits changed',
};

export function auditLabel(entity: string, action: string): string {
    const what = ENTITY_NAMES[entity] ?? entity.replace(/_/g, ' ');
    const did = ACTION_NAMES[action] ?? action.replace(/[:_]/g, ' ');
    return `${what} ${did}`;
}

/** Short one-line summary of a change, without long values. */
export function summarizeDiff(raw: string | null): string | null {
    if (!raw) return null;
    let v: unknown;
    try { v = JSON.parse(raw); } catch { return null; }
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    const parts: string[] = [];
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (val === null || val === undefined) continue;
        let s: string;
        if (typeof val === 'string') s = val.length > 60 ? `${val.slice(0, 57)}...` : val;
        else if (typeof val === 'number' || typeof val === 'boolean') s = String(val);
        else if (Array.isArray(val)) s = `${val.length} item${val.length === 1 ? '' : 's'}`;
        else s = 'changed';
        parts.push(`${k.replace(/_/g, ' ')}: ${s}`);
        if (parts.length >= 6) break;
    }
    const out = parts.join(', ');
    return out ? (out.length > 300 ? `${out.slice(0, 297)}...` : out) : null;
}

export function presentAudit(r: AuditRow): AuditEntry {
    const byTeam = r.action.startsWith('admin:') || (r.actor_id !== null && !r.actor_member && r.entity === 'organization');
    const actor: AuditEntry['actor'] = byTeam ? { kind: 'team', name: 'freeabtest.com' }
        : !r.actor_id ? { kind: 'system', name: r.action === 'allocation:auto' ? 'Automatic' : 'API key' }
            : r.actor_member ? { kind: 'member', name: r.actor_name || r.actor_email || 'Team member' }
                : { kind: 'former', name: 'Former member' };
    return {
        id: r.id, at: r.created_at, entity: r.entity, entity_id: r.entity_id, action: r.action,
        label: auditLabel(r.entity, r.action), actor,
        // Support entries carry internal notes, so their details stay hidden.
        details: byTeam ? null : summarizeDiff(r.diff),
    };
}

export function encodeCursor(r: { created_at: string; id: string }): string {
    return Buffer.from(`${r.created_at}|${r.id}`).toString('base64url');
}
export function decodeCursor(c: string | null): { t: string; id: string } | null {
    if (!c) return null;
    try {
        const [t, id] = Buffer.from(c, 'base64url').toString('utf8').split('|');
        return t && id && /^\d{4}-\d{2}-\d{2}T/.test(t) && /^[A-Za-z0-9_-]{1,64}$/.test(id) ? { t, id } : null;
    } catch {
        return null;
    }
}
