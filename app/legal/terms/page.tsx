import { pageMetadata } from '@/lib/site/meta';
import Link from 'next/link';
import { LegalDoc } from '../LegalDoc';
import { LEGAL, contactPhoneHref, operatorName } from '@/lib/legal';

export const metadata = pageMetadata({
    path: '/legal/terms',
    title: 'Terms of Service',
    description: 'The terms for using freeabtest.com: accounts, plans and billing, acceptable use, your data, availability, liability and governing law.',
});

export default function TermsPage() {
    const op = operatorName();
    return (
        <LegalDoc slug="terms" title="Terms of Service" intro={<p>These terms are an agreement between you and {op} (&quot;we&quot;, &quot;us&quot;) for the use of freeabtest.com, its dashboard, script, API and plugins (the &quot;Service&quot;). By creating an account or using the Service you accept them. If you accept for a company, you confirm you may bind it, and &quot;you&quot; means that company.</p>}>
            <h2>1. Your account</h2>
            <ul>
                <li>You sign in with a third-party account (such as Google). Keep it secure; you are responsible for what happens under your account and your API keys.</li>
                <li>Give accurate account details and keep them current.</li>
                <li>One person per login. Invite teammates instead of sharing a login.</li>
                <li>You must be at least 16 and able to enter a contract.</li>
            </ul>
            <h2>2. Plans, limits, billing and refunds</h2>
            <p>The features and limits of each plan are shown on the <Link href="/pricing">pricing page</Link>. When a limit is reached, the Service stops enrolling new visitors or collecting data until the next period, as described there.</p>
            <p>Paid plans are priced in US dollars, in advance, monthly or yearly as shown on the pricing page. Pay yearly and get 2 months free. Prices do not include any tax that may apply; if tax is due, it will be shown before you pay.</p>
            <p>When paid checkout is available, the price, billing period, payment method and these billing terms will be shown before you buy and form part of these terms. You authorise us and our payment partners to charge the payment method you choose at the start of each billing period until the subscription is cancelled.</p>
            <p>Upgrades take effect once payment is confirmed. Downgrades and cancellations take effect at the end of the current billing period. You keep access to the paid plan until then. We do not give mid-cycle refunds when you cancel or downgrade, or for time you do not use in a period you have already paid for. If we charge you by mistake, or charge you twice for the same period, we will refund that charge.</p>
            <p>We may change plans and features; we will give reasonable notice of changes that reduce what a paid plan includes. If we withdraw a paid plan you have already paid for, you keep access until the end of the period you paid for, or we refund the unused part.</p>
            <p>Refunds and cancellations are also described on the <Link href="/legal/refunds">Refunds and cancellation</Link> page. How access is provided is described on the <Link href="/legal/delivery">Service delivery</Link> page.</p>
            <h2>3. Acceptable use</h2>
            <p>You may only install the script on websites you own or are allowed to operate. You must not:</p>
            <ul>
                <li>break the law, infringe others&apos; rights, or use the Service to deceive or harm visitors (for example phishing, malware, or hiding prices or terms);</li>
                <li>collect sensitive data (health, financial, government ids, passwords or payment card data) through tests, goals, surveys or metadata;</li>
                <li>probe, overload or attack the Service, get around plan limits, or create accounts to avoid them;</li>
                <li>resell the Service or use it to build a competing product without our written permission.</li>
            </ul>
            <p>We may suspend accounts that break these rules or put the Service or other customers at risk. Where we can, we tell you first and give you a chance to fix the problem.</p>
            <h2>4. Your data and your visitors</h2>
            <p>You own your content and the data collected on your websites (&quot;Customer Data&quot;). You give us the rights we need to run, secure and support the Service for you. For data about your website visitors you are the controller and we are your processor under the <Link href="/legal/dpa">Data Processing Agreement</Link>, which forms part of these terms. You are responsible for telling your visitors about testing and for any consent your law requires; the script supports waiting for consent (see the SDK documentation). How we handle account data is described in the <Link href="/legal/privacy">Privacy Policy</Link>.</p>
            <h2>5. Third-party services</h2>
            <p>Some features connect to services you choose, such as an AI provider with your own key, analytics tools or webhook endpoints. Their terms apply to what they receive, and we are not responsible for them.</p>
            <h2>6. Availability and support</h2>
            <p>We work to keep the Service available and fast, but we do not promise it will be uninterrupted or error free. The script is built so that, if it cannot reach us, your visitors see your original page. Support is available through the in-app Support page or by email at <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.</p>
            <h2>7. Results are statistical estimates</h2>
            <p>Test results, significance figures, winners and AI suggestions are estimates. Decisions you make with them are your own.</p>
            <h2>8. Ending the agreement</h2>
            <p>You can stop using the Service and delete your account at any time from Settings, Privacy and data. We may end the agreement with 30 days&apos; notice, or right away for a serious breach of these terms. When an account is deleted, its data is deleted as described in the Privacy Policy. Sections 4, 7, 9, 10 and 12 survive.</p>
            <h2>9. Disclaimer</h2>
            <p>Except as stated in these terms, the Service is provided &quot;as is&quot; without warranties of any kind, to the extent the law allows.</p>
            <h2>10. Limitation of liability</h2>
            <p>To the extent the law allows, neither party is liable for indirect, incidental, special or consequential damages, or for lost profits, revenue or data. Our total liability for any claim is limited to the amount you paid us in the 12 months before the claim, or USD 100 if you paid nothing. These limits do not apply to liability that cannot be limited by law.</p>
            <h2>11. Changes to these terms</h2>
            <p>We may update these terms. We will post the new version here with a new date and, for material changes, tell account owners in the app or by email at least 14 days before they apply. Using the Service after that accepts them.</p>
            <h2>12. Law and disputes</h2>
            <p>{LEGAL.governingLaw ? `These terms are governed by the laws of ${LEGAL.governingLaw}${LEGAL.governingCourts ? `, and ${LEGAL.governingCourts} have jurisdiction` : ', and its courts have jurisdiction'}, unless your local consumer law gives you other rights.` : 'These terms are governed by the laws of the place where we are established, and its courts have jurisdiction, unless your local consumer law gives you other rights.'} Before going to court, contact us so we can try to resolve the issue.</p>
            <h2>13. Contact</h2>
            <p>{op}{LEGAL.address ? `, ${LEGAL.address}` : ''}. Email: <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.{LEGAL.contactPhone ? <> Phone: <a href={contactPhoneHref()}>{LEGAL.contactPhone}</a>.</> : null}</p>
        </LegalDoc>
    );
}
