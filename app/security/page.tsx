import type { Metadata } from 'next';
import { LegalDoc } from '../legal/LegalDoc';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Security', description: 'How freeabtest.com protects your data and how to report a vulnerability.' };

export default function SecurityPage() {
    const mail = <a href={`mailto:${LEGAL.securityEmail}`}>{LEGAL.securityEmail}</a>;
    return (
        <LegalDoc slug="security" title="Security" intro={<p>How we protect your account and your visitors&apos; data, and how to tell us about a problem.</p>}>
            <h2>How we protect data</h2>
            <ul>
                <li>All traffic uses HTTPS, with strict transport security.</li>
                <li>Every request is checked against your organization and project. Teams have owner and member roles, and changes are written to an audit log.</li>
                <li>API keys are stored hashed. Browser keys only work on the domains you register; secret keys never work in a browser.</li>
                <li>AI provider keys you add are encrypted and never shown again.</li>
                <li>Outgoing requests (webhooks, page reading for AI ideas) only go to public addresses and are signed where you need to verify them.</li>
                <li>Sign-up has a bot check and limits per network; abuse is rate limited.</li>
                <li>Visitor data is minimized: random ids, no keystrokes, masked survey answers, and limited retention.</li>
                <li>Data is backed up regularly and you can delete projects, visitors and your account yourself.</li>
            </ul>
            <h2>Report a vulnerability</h2>
            <p>Email {mail} with the details and steps to reproduce. We acknowledge reports within 3 business days and keep you updated until it is fixed. Please give us reasonable time to fix an issue before telling anyone else, do not access or change other customers&apos; data, and do not run tests that degrade the Service (such as denial of service or spam). We will not take legal action against research done in good faith under these rules.</p>
            <p>Machine-readable contact: <a href="/.well-known/security.txt">/.well-known/security.txt</a>.</p>
        </LegalDoc>
    );
}
