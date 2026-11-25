import { pageMetadata } from '@/lib/site/meta';
import { getDocPage } from '@/lib/docs';
import { DocArticle } from './_components/DocArticle';

export const metadata = pageMetadata({
    path: '/docs',
    title: 'Documentation',
    description: 'FreeABTest documentation: install the snippet, create A/B and split URL tests, set goals, read results, and use the JavaScript SDK, REST API and webhooks.',
});

export default function DocsHome() {
    return <DocArticle page={getDocPage('introduction')!} />;
}
