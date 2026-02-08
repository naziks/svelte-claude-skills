import type { TestCase } from './types.js';

/**
 * Maps test case skill names to actual skill directory names.
 * Test cases use "svelte5-runes" but the skill dir is "svelte-runes".
 */
const SKILL_NAME_MAP: Record<string, string> = {
	'svelte5-runes': 'svelte-runes',
	'sveltekit-data-flow': 'sveltekit-data-flow',
	'sveltekit-structure': 'sveltekit-structure',
	'sveltekit-remote-functions': 'sveltekit-remote-functions',
};

export function mapSkillName(name: string): string {
	return SKILL_NAME_MAP[name] ?? name;
}

/**
 * 22 activation test cases adapted from src/lib/evals/test-cases.ts.
 * expected_skill is mapped to actual skill directory names.
 */
export const TEST_CASES: TestCase[] = [
	// svelte-runes (5)
	{
		id: 'act-001',
		query: 'How do I use $state in Svelte 5?',
		expected_skill: 'svelte-runes',
		description: '$state query should activate svelte-runes',
	},
	{
		id: 'act-002',
		query: 'How do I create reactive state with $derived?',
		expected_skill: 'svelte-runes',
		description: '$derived query should activate svelte-runes',
	},
	{
		id: 'act-003',
		query: 'How do I use $effect for side effects?',
		expected_skill: 'svelte-runes',
		description: '$effect query should activate svelte-runes',
	},
	{
		id: 'act-004',
		query: 'How do I create bindable props in Svelte 5?',
		expected_skill: 'svelte-runes',
		description: 'Bindable props should activate svelte-runes',
	},
	{
		id: 'act-005',
		query: 'How do I migrate from Svelte 4 to Svelte 5?',
		expected_skill: 'svelte-runes',
		description: 'Migration questions should activate svelte-runes',
	},

	// sveltekit-data-flow (5)
	{
		id: 'act-006',
		query: 'How do I create a load function in SvelteKit?',
		expected_skill: 'sveltekit-data-flow',
		description:
			'Load function query should activate sveltekit-data-flow',
	},
	{
		id: 'act-007',
		query: 'How do form actions work in SvelteKit?',
		expected_skill: 'sveltekit-data-flow',
		description: 'Form actions should activate sveltekit-data-flow',
	},
	{
		id: 'act-008',
		query: 'What can I return from a server load function?',
		expected_skill: 'sveltekit-data-flow',
		description:
			'Serialization query should activate sveltekit-data-flow',
	},
	{
		id: 'act-009',
		query: 'How do I use fail() in a form action?',
		expected_skill: 'sveltekit-data-flow',
		description: 'fail() query should activate sveltekit-data-flow',
	},
	{
		id: 'act-010',
		query: 'When should I use +page.server.ts vs +page.ts?',
		expected_skill: 'sveltekit-data-flow',
		description:
			'Server vs universal load should activate sveltekit-data-flow',
	},

	// sveltekit-structure (5)
	{
		id: 'act-011',
		query: 'How does file-based routing work in SvelteKit?',
		expected_skill: 'sveltekit-structure',
		description: 'Routing query should activate sveltekit-structure',
	},
	{
		id: 'act-012',
		query: 'How do I create nested layouts in SvelteKit?',
		expected_skill: 'sveltekit-structure',
		description: 'Layout query should activate sveltekit-structure',
	},
	{
		id: 'act-013',
		query: 'Where do I put error boundaries in SvelteKit?',
		expected_skill: 'sveltekit-structure',
		description:
			'Error boundaries should activate sveltekit-structure',
	},
	{
		id: 'act-014',
		query: 'How do I handle SSR in SvelteKit?',
		expected_skill: 'sveltekit-structure',
		description: 'SSR query should activate sveltekit-structure',
	},
	{
		id: 'act-015',
		query:
			'What is the difference between +page.svelte and +layout.svelte?',
		expected_skill: 'sveltekit-structure',
		description: 'File naming should activate sveltekit-structure',
	},

	// sveltekit-remote-functions (5)
	{
		id: 'act-016',
		query: 'How do I use command() in SvelteKit?',
		expected_skill: 'sveltekit-remote-functions',
		description:
			'command() query should activate sveltekit-remote-functions',
	},
	{
		id: 'act-017',
		query: 'How do I create a remote function with query()?',
		expected_skill: 'sveltekit-remote-functions',
		description: 'query() should activate sveltekit-remote-functions',
	},
	{
		id: 'act-018',
		query: 'What are .remote.ts files in SvelteKit?',
		expected_skill: 'sveltekit-remote-functions',
		description:
			'.remote.ts should activate sveltekit-remote-functions',
	},
	{
		id: 'act-019',
		query: 'How do I call server functions from a Svelte component?',
		expected_skill: 'sveltekit-remote-functions',
		description:
			'Server functions should activate sveltekit-remote-functions',
	},
	{
		id: 'act-020',
		query: 'How do I validate input in remote functions?',
		expected_skill: 'sveltekit-remote-functions',
		description:
			'Remote function validation should activate sveltekit-remote-functions',
	},

	// Cross-skill (2)
	{
		id: 'act-021',
		query: 'How do I use $state in a form action?',
		expected_skill: 'svelte-runes',
		description:
			'$state is primary topic, should activate svelte-runes',
	},
	{
		id: 'act-022',
		query: 'How do I load data for my Svelte 5 component?',
		expected_skill: 'sveltekit-data-flow',
		description:
			'Loading data is primary topic, should activate sveltekit-data-flow',
	},
];
