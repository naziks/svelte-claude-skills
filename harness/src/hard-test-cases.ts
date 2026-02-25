import type { TestCase } from './types.js';

/**
 * Harder test cases for head-to-head comparison.
 * Categories:
 *   - Ambiguous: could match multiple skills
 *   - Indirect: no explicit skill keywords
 *   - Multi-skill: needs 2+ skills to answer fully
 *   - Edge: barely related or unusual framing
 *   - Negative: should NOT activate any Svelte skill
 */
export const HARD_TEST_CASES: TestCase[] = [
	// --- Ambiguous (could match multiple skills) ---
	{
		id: 'hard-001',
		query: 'How do I manage state across pages in my SvelteKit app?',
		expected_skill: 'svelte-runes',
		description:
			'Ambiguous: state management could be runes or data-flow',
	},
	{
		id: 'hard-002',
		query:
			'I need to fetch data and make it reactive in my Svelte 5 component',
		expected_skill: 'sveltekit-data-flow',
		description: 'Ambiguous: fetch=data-flow, reactive=runes',
	},
	{
		id: 'hard-003',
		query:
			'How should I organize my SvelteKit routes that call server functions?',
		expected_skill: 'sveltekit-structure',
		description:
			'Ambiguous: routes=structure, server functions=remote-functions',
	},

	// --- Indirect (no direct skill keywords) ---
	{
		id: 'hard-004',
		query:
			'My component re-renders too much, how do I fix the reactivity?',
		expected_skill: 'svelte-runes',
		description:
			'Indirect: reactivity issues point to runes without naming them',
	},
	{
		id: 'hard-005',
		query: 'How do I get URL parameters from the current page?',
		expected_skill: 'sveltekit-data-flow',
		description: 'Indirect: URL params come through load functions',
	},
	{
		id: 'hard-006',
		query:
			'Where should I put my database queries in a SvelteKit project?',
		expected_skill: 'sveltekit-structure',
		description: 'Indirect: project organization question',
	},
	{
		id: 'hard-007',
		query:
			'I want to call a function on the backend without writing an API route',
		expected_skill: 'sveltekit-remote-functions',
		description:
			'Indirect: describes remote functions without naming them',
	},

	// --- Multi-skill (needs 2+ skills to fully answer) ---
	{
		id: 'hard-008',
		query:
			'Build me a SvelteKit page with a form that updates reactive state on submit',
		expected_skill: 'sveltekit-data-flow',
		description: 'Multi: form=data-flow + reactive state=runes',
	},
	{
		id: 'hard-009',
		query:
			'Set up a SvelteKit route with a layout and a remote function that returns user data',
		expected_skill: 'sveltekit-structure',
		description:
			'Multi: route+layout=structure, remote function=remote-functions',
	},
	{
		id: 'hard-010',
		query:
			'Create a dashboard page with server-loaded data using $state for client filtering',
		expected_skill: 'sveltekit-data-flow',
		description: 'Multi: server load=data-flow + $state=runes',
	},

	// --- Edge cases (unusual framing, typos, vague) ---
	{
		id: 'hard-011',
		query: 'svelte 5 runes help pls',
		expected_skill: 'svelte-runes',
		description: 'Edge: very terse, informal query',
	},
	{
		id: 'hard-012',
		query:
			'I saw a talk about signals in Svelte, how do I use them in my app?',
		expected_skill: 'svelte-runes',
		description: 'Edge: uses "signals" not "runes"',
	},
	{
		id: 'hard-013',
		query:
			'How does SvelteKit handle the request/response lifecycle?',
		expected_skill: 'sveltekit-data-flow',
		description: 'Edge: abstract/conceptual question about data flow',
	},
	{
		id: 'hard-014',
		query:
			'What is the Svelte equivalent of React Server Components?',
		expected_skill: 'sveltekit-remote-functions',
		description: 'Edge: cross-framework analogy',
	},
	{
		id: 'hard-015',
		query: 'Can I RPC from client to server in SvelteKit?',
		expected_skill: 'sveltekit-remote-functions',
		description:
			'Edge: uses RPC terminology instead of remote functions',
	},

	// --- Negative cases (should NOT activate any Svelte skill) ---
	{
		id: 'hard-016',
		query: 'How do I center a div in CSS?',
		expected_skill: 'none',
		description: 'Negative: generic CSS, no Svelte skill needed',
	},
	{
		id: 'hard-017',
		query: 'Write a Python script to sort a list of numbers',
		expected_skill: 'none',
		description: 'Negative: completely unrelated language',
	},
	{
		id: 'hard-018',
		query: 'How do I set up a REST API with Express.js?',
		expected_skill: 'none',
		description: 'Negative: different framework entirely',
	},
	{
		id: 'hard-019',
		query:
			'Explain the difference between let and const in JavaScript',
		expected_skill: 'none',
		description: 'Negative: vanilla JS question',
	},
	{
		id: 'hard-020',
		query: 'How do I deploy a Next.js app to Vercel?',
		expected_skill: 'none',
		description: 'Negative: Next.js not SvelteKit',
	},

	// --- More indirect/tricky ---
	{
		id: 'hard-021',
		query:
			'My SvelteKit app has a flicker on navigation, data loads twice',
		expected_skill: 'sveltekit-data-flow',
		description: 'Indirect: debugging a data loading issue',
	},
	{
		id: 'hard-022',
		query:
			'I need to share a counter between two Svelte components without props',
		expected_skill: 'svelte-runes',
		description:
			'Indirect: shared state pattern points to runes/stores',
	},
	{
		id: 'hard-023',
		query:
			'How do I make a SvelteKit app work offline with prerendering?',
		expected_skill: 'sveltekit-structure',
		description: 'Edge: prerendering is a structural/config concern',
	},
	{
		id: 'hard-024',
		query:
			'Whats the best way to handle authentication middleware in SvelteKit?',
		expected_skill: 'sveltekit-structure',
		description: 'Indirect: middleware/hooks is structural',
	},
];
