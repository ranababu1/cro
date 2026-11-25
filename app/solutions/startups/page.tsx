import { SolutionPage, solutionMetadata } from '../SolutionPage';

export const metadata = solutionMetadata('startups');

export default function Page() {
    return <SolutionPage slug="startups" />;
}
