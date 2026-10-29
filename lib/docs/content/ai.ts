import type { DocPage } from '../types';

export const ai: DocPage = {
    slug: 'ai',
    title: 'AI suggestions',
    description: 'Test ideas, hypotheses, copy and result summaries from the AI provider you choose, with your own API key. Growth and Enterprise.',
    group: 'Analysis',
    blocks: [
        { type: 'p', text: 'AI suggestions help you plan tests and read results. They are part of the Growth and Enterprise plans. You bring your own API key from OpenAI, Google Gemini, DeepSeek or Claude (Anthropic), so you choose the provider and model, and you pay the provider directly for what you use. FreeABTest does not charge extra for AI.' },
        { type: 'h2', text: 'What you get', id: 'features' },
        { type: 'list', items: [
            '**Test ideas from a page.** In the **Test planner**, enter a public page address and a business objective, such as more trial sign-ups. FreeABTest reads the page and your provider suggests up to 5 test ideas with a hypothesis, the change to make and a priority. Add the ones you like to the planner with one click.',
            '**Hypothesis and expected outcome.** In the new test wizard, **Suggest a hypothesis** writes 3 options from the test name, page and goals. Pick one to fill both fields, then edit it.',
            '**Copy in the visual editor.** Select a headline, button or other text and click **Suggest text** to get up to 5 other versions. Click one to put it in the text box, then **Apply** as usual.',
            '**Plain-words summary of results.** On a test\'s results, **Explain these results** describes what the numbers mean for your business and suggests next steps.',
            '**Follow-up tests.** Once a test is stopped, **Suggest follow-up tests** proposes up to 3 next tests based on what it showed, ready to add to the planner.',
        ] },
        { type: 'callout', tone: 'info', title: 'The verdict comes from the statistics', text: 'The summary always starts from the verdict the results page shows (collecting data, a winner, the control ahead, or no significant difference yet). The AI only explains it. If an answer claims a winner the statistics did not find, or the other way round, it is not shown and you can try again.' },
        { type: 'h2', text: 'Set up', id: 'setup' },
        { type: 'steps', items: [
            { title: 'Create a key with your provider', text: 'OpenAI, Google AI Studio (Gemini), DeepSeek or the Claude Console (Anthropic). A key with access to text models is enough.' },
            { title: 'Add it in Settings, AI', text: 'Only organization owners can add or remove keys. Each key is checked with the provider when you save it.' },
            { title: 'Pick the model', text: 'Choose the provider and model used for text. Suggested models are listed, or type any model name your key can use. Faster, smaller models are usually enough.' },
        ] },
        { type: 'h2', text: 'How your key is kept', id: 'keys' },
        { type: 'list', items: [
            'Keys are encrypted before they are stored, and are only decrypted on our servers to call your provider.',
            'A saved key is never shown again or sent to your browser. The settings page shows its last 4 characters only.',
            'Adding, replacing and removing a key is recorded in the **Audit log** with the provider name. The key itself is never recorded.',
            'Remove a key at any time under **Settings, AI**. Keys can be removed on every plan, also after a downgrade.',
        ] },
        { type: 'h2', text: 'What is sent to your provider', id: 'data' },
        { type: 'p', text: 'Only what a feature needs: the readable text of the page you entered, the test name, hypothesis, goals and result numbers, or the text you selected in the visual editor. Visitor data, such as IDs or sessions, is never sent. Your provider\'s own terms apply to what it receives.' },
        { type: 'h2', text: 'Limits and errors', id: 'limits' },
        { type: 'p', text: 'Each organization can make up to 60 AI requests an hour and 300 a day. If the provider rejects your key, is out of credit or is busy, you see a short message saying so; check your account with the provider and try again. Pages that only show content after scripts run, or that need a login, cannot be read for ideas.' },
        { type: 'table', head: ['Plan', 'AI suggestions'], rows: [['Free', 'Not included'], ['Starter', 'Not included'], ['Growth', 'Included, with your own key'], ['Enterprise', 'Included, with your own key']] },
    ],
};
