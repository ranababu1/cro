/** Patterns for personal details removed from free text we store (error messages, written survey answers). */
export const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
export const TOKEN_RE = /\b[A-Za-z0-9_-]{32,}\b/g;
/** Six or more digits, optionally split by single spaces, dots, dashes or brackets: phone, card, order and ID numbers. Years and prices stay. */
export const LONG_NUMBER_RE = /\+?\d(?:[\s().-]?\d){5,}/g;

/** Written survey answers and comments: emails, long numbers and tokens are replaced; line breaks stay. */
export function redactText(text: string): string {
    return text.replace(EMAIL_RE, '[email]').replace(TOKEN_RE, '[token]').replace(LONG_NUMBER_RE, '[number]');
}
