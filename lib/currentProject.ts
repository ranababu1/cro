export const PROJECT_COOKIE = 'cro_project';

/** Picks the selected project from the cookie value, falling back to the first accessible one. */
export function pickProject<T extends { id: string }>(projects: T[], cookieValue: string | undefined): T | null {
    return projects.find((p) => p.id === cookieValue) ?? projects[0] ?? null;
}

/** Browser only: remember the selected project for a year. */
export function setProjectCookie(projectId: string): void {
    document.cookie = `${PROJECT_COOKIE}=${encodeURIComponent(projectId)}; path=/; max-age=31536000; samesite=lax`;
}
