import { getDocPage } from '@/lib/docs';
import { DocArticle } from './_components/DocArticle';

export default function DocsHome() {
    return <DocArticle page={getDocPage('introduction')!} />;
}
