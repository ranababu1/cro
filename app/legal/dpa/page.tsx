import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc } from '../LegalDoc';
import { LEGAL, operatorName } from '@/lib/legal';

export const metadata: Metadata = { title: 'Data Processing Agreement', description: 'How freeabtest.com processes personal data about your website visitors on your behalf.' };

export default function DpaPage() {
    const op = operatorName();
    const mail = <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>;
    return (
        <LegalDoc slug="dpa" title="Data Processing Agreement" intro={<p>This agreement forms part of the <Link href="/legal/terms">Terms of Service</Link> between the customer (&quot;Controller&quot;) and {op} (&quot;Processor&quot;). It applies when the Processor processes personal data about the Controller&apos;s website visitors, and meets Article 28 of the GDPR and the UK GDPR. If you need a countersigned copy, email {mail}.</p>}>
            <h2>1. Subject, duration and nature</h2>
            <p>The Processor processes visitor data to run A/B tests, measure goals, show popups and surveys, and produce heatmaps and error reports for the Controller&apos;s websites, for as long as the Controller uses the Service.</p>
            <h2>2. Data and data subjects</h2>
            <p>Data subjects: visitors of the Controller&apos;s websites. Data: pseudonymous visitor ids, pages viewed, referrer, browser and device class, country, test versions, goal completions and order values, click and scroll positions, JavaScript error messages, popup and survey interactions and answers. The Controller must not send special categories of data or payment card data.</p>
            <h2>3. Processor obligations</h2>
            <ul>
                <li>Process personal data only on the Controller&apos;s documented instructions, which are these terms and the Controller&apos;s settings in the Service, unless the law requires otherwise (in which case the Processor tells the Controller first where it may).</li>
                <li>Make sure people with access are bound by confidentiality.</li>
                <li>Keep appropriate technical and organizational measures (section 6).</li>
                <li>Help the Controller answer data subject requests. The Service lets the Controller erase a single visitor and delete tests and projects.</li>
                <li>Help the Controller with security, breach notification, impact assessments and consultations, taking into account what the Processor knows.</li>
                <li>Notify the Controller without undue delay, and within 72 hours where possible, after becoming aware of a personal data breach affecting its data.</li>
                <li>At the end of the Service, delete the Controller&apos;s data (deleting the account or project does this), except where the law requires keeping it. Backups roll over within 30 days.</li>
                <li>Make available the information needed to show compliance, and allow audits by the Controller or its auditor on reasonable notice, at most once a year, normally by written questionnaire.</li>
            </ul>
            <h2>4. Sub-processors</h2>
            <p>The Controller authorizes the Processor to use sub-processors for hosting, content delivery and database hosting. The current list is available on request at {mail}. The Processor binds each sub-processor to data protection terms no less protective than these and stays responsible for them. The Processor will give at least 14 days&apos; notice of a new sub-processor; the Controller may object on reasonable grounds and, if the parties cannot agree, end the affected Service.</p>
            <h2>5. International transfers</h2>
            <p>Where personal data leaves the European Economic Area, the UK or Switzerland for a country without an adequacy decision, the parties rely on the European Commission&apos;s standard contractual clauses (module two or three as applicable) and the UK addendum, which are incorporated by reference.</p>
            <h2>6. Security measures</h2>
            <ul>
                <li>Encryption in transit (HTTPS) for all traffic; API keys stored hashed; customer AI keys encrypted at rest.</li>
                <li>Tenant isolation: every query is scoped to the customer&apos;s organization and project.</li>
                <li>Role-based access for customer teams and an audit log of changes.</li>
                <li>Restricted, logged staff access; rate limiting and abuse controls.</li>
                <li>Data minimization: random visitor ids, no keystrokes, masked survey answers, retention limits on raw heatmap data and survey answers.</li>
                <li>Regular backups and a tested restore procedure.</li>
            </ul>
            <h2>7. Liability and order of precedence</h2>
            <p>Liability under this agreement follows the Terms of Service. If this agreement and the Terms conflict on data protection, this agreement wins.</p>
        </LegalDoc>
    );
}
