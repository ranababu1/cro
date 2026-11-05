import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc } from '../LegalDoc';
import { LEGAL, operatorName } from '@/lib/legal';

export const metadata: Metadata = { title: 'Privacy Policy', description: 'What freeabtest.com collects, why, how long it is kept and your rights.' };

export default function PrivacyPage() {
    const op = operatorName();
    const mail = <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>;
    return (
        <LegalDoc slug="privacy" title="Privacy Policy" intro={<p>This policy explains what {op} (&quot;we&quot;) collects when you use freeabtest.com, and what happens to data about the visitors of websites that use our script. Questions: {mail}.</p>}>
            <h2>1. Two roles</h2>
            <ul>
                <li><strong>Our customers&apos; accounts.</strong> For the people who sign up and use the dashboard, we decide how data is used (we are the controller). Sections 2 to 4 cover this.</li>
                <li><strong>Visitors of our customers&apos; websites.</strong> When a customer installs our script, we process data about their visitors on the customer&apos;s instructions (we are the processor, the customer is the controller). Section 5 covers this, and the <Link href="/legal/dpa">Data Processing Agreement</Link> sets the rules. Visitors with a request should contact the website they visited; we help that website answer it.</li>
            </ul>
            <h2>2. Data about account holders</h2>
            <table>
                <thead><tr><th>What</th><th>Why</th></tr></thead>
                <tbody>
                    <tr><td>Name, email address and profile picture from the sign-in provider you choose</td><td>Create and secure your account, sign you in</td></tr>
                    <tr><td>Profile details you add: country, company, role, company size, phone, how you heard about us, your goal, marketing choice</td><td>Run the account, understand who uses the product, contact you if you opted in</td></tr>
                    <tr><td>What you create: organizations, projects, domains, tests, goals, popups, surveys, team members, API keys, webhooks, support tickets</td><td>Provide the Service</td></tr>
                    <tr><td>Activity in the dashboard (for example sign-ins, tests started) and an audit log of changes in your organization</td><td>Security, support, product improvement, your audit log</td></tr>
                    <tr><td>A one-way hash of the IP address used to sign up and to act in the dashboard; never the address itself</td><td>Prevent abuse and duplicate free accounts</td></tr>
                    <tr><td>A bot check result when you sign up</td><td>Block automated sign-ups</td></tr>
                    <tr><td>Your AI provider key, if you add one, stored encrypted</td><td>Call the AI provider you chose on your behalf</td></tr>
                </tbody>
            </table>
            <p>Our legal bases are performing our contract with you, our legitimate interests in securing and improving the Service, and your consent for marketing email. We do not sell personal data and we do not use it for advertising.</p>
            <h2>3. Our own website</h2>
            <p>Our marketing pages use privacy-friendly page view statistics that do not set cookies or identify you. The cookies and storage the dashboard uses are listed in <Link href="/legal/cookies">Cookies and storage</Link>.</p>
            <h2>4. Sharing, transfers and retention for account data</h2>
            <p>We use service providers to run the Service: hosting and content delivery, database hosting, bot protection and sign-in providers. They process data only on our instructions and under data protection terms. A current list of these sub-processors is available on request at {mail}. If you connect your own AI provider, webhook endpoint or analytics tool, that provider receives what the feature sends. Providers may process data outside your country; where the law requires, we rely on safeguards such as standard contractual clauses. We may disclose data when the law requires it.</p>
            <p>Account data is kept while the account exists. When you delete your account, your profile is deleted at once, and organizations where you were the only member are deleted with everything in them. Audit logs are kept for your plan&apos;s audit period (30 days on Free up to 2 years on Enterprise). Sign-up abuse counters are kept 30 days. Backups roll over within 30 days.</p>
            <h2>5. Data about website visitors (processor role)</h2>
            <p>On websites that install it, the script collects only what the customer turns on:</p>
            <ul>
                <li>A random visitor id stored in the browser, the test version shown, page views and goal completions (clicks, form submits, page visits, custom events and order values the website sends);</li>
                <li>The page address, referrer, browser type and device class, landing source, new or returning, and country (from the connection, kept as a country only);</li>
                <li>On paid features: click and scroll positions for heatmaps (never keystrokes or what is typed into fields), JavaScript error messages, popup and survey interactions and survey answers (common personal details such as email addresses and phone numbers are masked before they are stored).</li>
            </ul>
            <p>Visitor IP addresses are used to deliver and protect the Service and are not stored with this data. Raw heatmap points are deleted after 30 days and survey answers after the period of the customer&apos;s plan (6 months to 2 years). Other visitor data is kept until the customer deletes the test, project or account, or erases the visitor. Daily totals hold no visitor ids. Websites can make the script wait for consent and let visitors opt out; see the SDK documentation.</p>
            <h2>6. Security</h2>
            <p>Data is encrypted in transit; API keys are stored hashed; AI keys are stored encrypted. Access is limited to people who need it. See <Link href="/security">Security</Link>.</p>
            <h2>7. Your rights</h2>
            <p>Depending on where you live, you can ask to access, correct, export or delete your data, object to or restrict some uses, and withdraw consent. Signed-in users can download their data and delete their account in Settings, Privacy and data. For anything else email {mail}; we answer within 30 days. You can also complain to your data protection authority.</p>
            <h2>8. Children</h2>
            <p>The Service is for businesses and is not meant for anyone under 16.</p>
            <h2>9. Changes</h2>
            <p>We will post changes here with a new date, and tell account owners about material changes before they apply.</p>
            <h2>10. Contact</h2>
            <p>{op}{LEGAL.address ? `, ${LEGAL.address}` : ''}. Email: {mail}.</p>
        </LegalDoc>
    );
}
