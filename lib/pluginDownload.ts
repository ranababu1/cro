import { db } from './db';
import { getOrgEntitlements, isSuperAdminEmail } from './entitlements';

/** Download caps per user and per org. Enough for real use, low enough to stop scripted scraping. */
export const PLUGIN_DOWNLOAD_LIMITS = { userPerHour: 10, orgPerDay: 30 } as const;

/**
 * The org a plugin download is logged against: the first of the user's active orgs that may use the
 * plugin (paid plan, special friend grant, or a platform admin member). Platform admins always qualify
 * and are logged against their first org. Null means the user may not download it.
 */
export async function pluginDownloadOrg(userId: string, email: string | null): Promise<string | null> {
    const projects = (await db.getProjectsForUser(userId)).filter((p) => p.org_status === 'active');
    const orgIds = [...new Set(projects.map((p) => p.org_id))];
    for (const orgId of orgIds) {
        if ((await getOrgEntitlements(orgId)).features.wordpress_plugin) return orgId;
    }
    if (isSuperAdminEmail(email) && orgIds[0]) return orgIds[0];
    return null;
}

/** Whether a signed-in user may download the plugin (used by pages to pick download or upgrade). */
export async function canDownloadPlugin(userId: string, email: string | null): Promise<boolean> {
    return (await pluginDownloadOrg(userId, email)) !== null;
}
