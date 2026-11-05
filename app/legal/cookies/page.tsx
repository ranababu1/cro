import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc } from '../LegalDoc';

export const metadata: Metadata = { title: 'Cookies and storage', description: 'The cookies and browser storage freeabtest.com and its script use.' };

export default function CookiesPage() {
    return (
        <LegalDoc slug="cookies" title="Cookies and storage" intro={<p>We use no advertising or cross-site tracking cookies. This page lists what is stored in the browser by our dashboard and by the script our customers install.</p>}>
            <h2>On freeabtest.com</h2>
            <table>
                <thead><tr><th>Name</th><th>Purpose</th><th>Kept</th></tr></thead>
                <tbody>
                    <tr><td>Session and sign-in cookies</td><td>Keep you signed in, protect forms against cross-site requests, return you to the right page after sign-in</td><td>Session, up to 30 days for the sign-in</td></tr>
                    <tr><td>fat_bot_pass</td><td>Shows the sign-up bot check was passed</td><td>10 minutes</td></tr>
                    <tr><td>cro_project</td><td>Remembers the project you selected</td><td>1 year</td></tr>
                    <tr><td>Theme (local storage)</td><td>Light or dark mode</td><td>Until cleared</td></tr>
                </tbody>
            </table>
            <p>These are strictly necessary for the Service or remember a choice you made, so they do not need consent. Our page view statistics set no cookies.</p>
            <h2>On websites that use our script</h2>
            <p>The website you visited decides whether to use these. It is responsible for asking for consent where its law requires; the script can wait for that consent.</p>
            <table>
                <thead><tr><th>Name</th><th>Where</th><th>Purpose</th><th>Kept</th></tr></thead>
                <tbody>
                    <tr><td>ab_user_id</td><td>Local storage, or a first-party cookie if local storage is blocked</td><td>Random visitor id, so you see the same version each visit</td><td>Until cleared; cookie 1 year</td></tr>
                    <tr><td>ab_first_seen</td><td>Local storage</td><td>New or returning visitor</td><td>Until cleared</td></tr>
                    <tr><td>ab_visitor, fabt_land</td><td>Session storage</td><td>New or returning for this visit, landing source</td><td>This browser session</td></tr>
                    <tr><td>ab_opt_out</td><td>Local storage</td><td>Remembers that you opted out</td><td>Until cleared</td></tr>
                    <tr><td>fabt_preview, fabt_editor</td><td>Session storage</td><td>Only for the website&apos;s own staff previewing or editing a test</td><td>This browser session</td></tr>
                </tbody>
            </table>
            <p>Clearing site data in your browser removes all of them. See the <Link href="/legal/privacy">Privacy Policy</Link> for what is collected.</p>
        </LegalDoc>
    );
}
