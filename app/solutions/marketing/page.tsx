import { SolutionPage, solutionMetadata } from '../SolutionPage';

export const metadata = solutionMetadata('marketing');

export default function Page() {
    return <SolutionPage slug="marketing" />;
}
