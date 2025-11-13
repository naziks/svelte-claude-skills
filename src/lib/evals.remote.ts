import { command } from '$app/server';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { query } from '@anthropic-ai/claude-agent-sdk';
import * as v from 'valibot';

if (ANTHROPIC_API_KEY) {
	process.env.ANTHROPIC_API_KEY = ANTHROPIC_API_KEY;
} else {
	throw new Error('ANTHROPIC_API_KEY not found.');
}

export interface ActivationTestResult {
	test_id: string;
	passed: boolean;
	expected_skill: string;
	activated_skill: string | null;
	error?: string;
	logs: string[];
}

export interface QualityTestResult {
	test_id: string;
	passed: boolean;
	missing_facts: string[];
	forbidden_content: string[];
	response_preview: string;
	error?: string;
	logs: string[];
}

// Validation schemas
const activation_test_schema = v.object({
	id: v.string(),
	query: v.string(),
	expected_skill: v.union([
		v.literal('svelte5-runes'),
		v.literal('sveltekit-data-flow'),
		v.literal('sveltekit-structure'),
	]),
	should_activate: v.boolean(),
	description: v.string(),
	model: v.optional(v.string()),
});

const quality_test_schema = v.object({
	id: v.string(),
	skill: v.union([
		v.literal('svelte5-runes'),
		v.literal('sveltekit-data-flow'),
		v.literal('sveltekit-structure'),
	]),
	query: v.string(),
	expected_facts: v.optional(v.array(v.string())),
	must_not_contain: v.optional(v.array(v.string())),
	description: v.string(),
	model: v.optional(v.string()),
});

/**
 * Test skill activation - verify correct skill triggers for query
 */
export const test_skill_activation = command(
	activation_test_schema,
	async (test_case): Promise<ActivationTestResult> => {
		const logs: string[] = [];
		const log = (msg: string) => {
			console.log(msg);
			logs.push(msg);
		};

		const model = test_case.model || 'claude-sonnet-4-5-20250929';
		log(`[ACTIVATION TEST] Starting: ${test_case.id}`);
		log(`[ACTIVATION TEST] Using model: ${model}`);
		log(`[ACTIVATION TEST] Query: "${test_case.query}"`);

		try {
			let activated_skill: string | null = null;

			// Run query using Claude Agent SDK
			log('[ACTIVATION TEST] Calling Claude Agent SDK...');
			const query_result = query({
				prompt: test_case.query,
				options: {
					cwd: process.cwd(),
					settingSources: ['project'],
					allowedTools: ['Skill', 'Read'],
					model,
				},
			});

			// Check messages for Skill tool invocation
			log('[ACTIVATION TEST] Processing messages...');
			for await (const message of query_result) {
				log(`[ACTIVATION TEST] Message type: ${message.type}`);
				if (message.type === 'assistant') {
					// Tool uses are in message.message.content array
					const content = message.message.content;
					if (Array.isArray(content)) {
						for (const block of content) {
							if (block.type === 'tool_use') {
								log(
									`[ACTIVATION TEST] Tool use detected: ${block.name}`,
								);
							}
							if (
								block.type === 'tool_use' &&
								block.name === 'Skill' &&
								typeof block.input === 'object' &&
								block.input !== null &&
								'skill' in block.input
							) {
								activated_skill = String(block.input.skill);
								log(
									`[ACTIVATION TEST] Skill activated: ${activated_skill}`,
								);
								break;
							}
						}
					}
					if (activated_skill) break;
				}
			}

			const passed =
				activated_skill === test_case.expected_skill &&
				test_case.should_activate;

			log(
				`[ACTIVATION TEST] ${test_case.id} - Expected: ${test_case.expected_skill}, Got: ${activated_skill}, Passed: ${passed}`,
			);

			return {
				test_id: test_case.id,
				passed,
				expected_skill: test_case.expected_skill,
				activated_skill,
				error: undefined,
				logs,
			};
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : 'Unknown error';
			log(`[ACTIVATION TEST] Error in ${test_case.id}: ${errorMsg}`);
			return {
				test_id: test_case.id,
				passed: false,
				expected_skill: test_case.expected_skill,
				activated_skill: null,
				error: errorMsg,
				logs,
			};
		}
	},
);

/**
 * Test response quality - verify responses contain expected facts
 */
export const test_response_quality = command(
	quality_test_schema,
	async (test_case): Promise<QualityTestResult> => {
		const logs: string[] = [];
		const log = (msg: string) => {
			console.log(msg);
			logs.push(msg);
		};

		const model = test_case.model || 'claude-sonnet-4-5-20250929';
		log(`[QUALITY TEST] Starting: ${test_case.id}`);
		log(`[QUALITY TEST] Using model: ${model}`);
		log(`[QUALITY TEST] Query: "${test_case.query}"`);

		try {
			// Get response from Claude with skill activated
			log('[QUALITY TEST] Calling Claude Agent SDK...');
			const query_result = query({
				prompt: test_case.query,
				options: {
					cwd: process.cwd(),
					settingSources: ['project'],
					allowedTools: ['Skill', 'Read'],
					model,
				},
			});

			// Extract text response from assistant messages
			let response_text = '';
			log('[QUALITY TEST] Processing messages...');
			for await (const message of query_result) {
				log(`[QUALITY TEST] Message type: ${message.type}`);
				if (message.type === 'assistant') {
					const content = message.message.content;
					if (Array.isArray(content)) {
						for (const block of content) {
							if (block.type === 'text') {
								response_text += block.text;
								log(
									`[QUALITY TEST] Got text response (${block.text.length} chars)`,
								);
							}
						}
					}
				}
			}

			// Check for expected facts
			const missing_facts: string[] = [];
			if (test_case.expected_facts) {
				for (const fact of test_case.expected_facts) {
					if (
						!response_text.toLowerCase().includes(fact.toLowerCase())
					) {
						missing_facts.push(fact);
					}
				}
			}

			// Check for forbidden content
			const forbidden_content: string[] = [];
			if (test_case.must_not_contain) {
				for (const forbidden of test_case.must_not_contain) {
					if (
						response_text
							.toLowerCase()
							.includes(forbidden.toLowerCase())
					) {
						forbidden_content.push(forbidden);
					}
				}
			}

			const passed =
				missing_facts.length === 0 && forbidden_content.length === 0;

			log(`[QUALITY TEST] ${test_case.id} - Passed: ${passed}`);
			if (missing_facts.length > 0) {
				log(
					`[QUALITY TEST] Missing facts: ${missing_facts.join(', ')}`,
				);
			}
			if (forbidden_content.length > 0) {
				log(
					`[QUALITY TEST] Forbidden content found: ${forbidden_content.join(', ')}`,
				);
			}

			return {
				test_id: test_case.id,
				passed,
				missing_facts,
				forbidden_content,
				response_preview: response_text.substring(0, 200),
				error: undefined,
				logs,
			};
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : 'Unknown error';
			log(`[QUALITY TEST] Error in ${test_case.id}: ${errorMsg}`);
			return {
				test_id: test_case.id,
				passed: false,
				missing_facts: [],
				forbidden_content: [],
				response_preview: '',
				error: errorMsg,
				logs,
			};
		}
	},
);

/**
 * Run multiple activation tests in sequence
 */
export const run_activation_tests = command(
	v.array(activation_test_schema),
	async (test_cases): Promise<ActivationTestResult[]> => {
		console.log(
			`\n[RUN TESTS] Starting ${test_cases.length} activation tests`,
		);
		const results: ActivationTestResult[] = [];
		for (let i = 0; i < test_cases.length; i++) {
			console.log(`\n[RUN TESTS] Test ${i + 1}/${test_cases.length}`);
			const result = await test_skill_activation(test_cases[i]);
			results.push(result);
		}
		console.log(
			`\n[RUN TESTS] Completed. Passed: ${results.filter((r) => r.passed).length}/${results.length}`,
		);
		return results;
	},
);

/**
 * Run multiple quality tests in sequence
 */
export const run_quality_tests = command(
	v.array(quality_test_schema),
	async (test_cases): Promise<QualityTestResult[]> => {
		console.log(
			`\n[RUN TESTS] Starting ${test_cases.length} quality tests`,
		);
		const results: QualityTestResult[] = [];
		for (let i = 0; i < test_cases.length; i++) {
			console.log(`\n[RUN TESTS] Test ${i + 1}/${test_cases.length}`);
			const result = await test_response_quality(test_cases[i]);
			results.push(result);
		}
		console.log(
			`\n[RUN TESTS] Completed. Passed: ${results.filter((r) => r.passed).length}/${results.length}`,
		);
		return results;
	},
);
