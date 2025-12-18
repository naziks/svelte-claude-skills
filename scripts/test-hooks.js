#!/usr/bin/env node
/**
 * Hook Effectiveness Testing Script
 *
 * Runs multiple iterations of the same prompt to test if skills are activated
 * with the current .claude/settings.json hook configuration.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=your-key node run-hook-test.js \
 *     --prompt "Create a SvelteKit route..." \
 *     --iterations 10 \
 *     --hook-config forced \
 *     --expected-skills svelte5-runes,sveltekit-data-flow
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import Database from 'better-sqlite3';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

// ============================================================================
// CONFIGURATION - Edit these defaults as needed
// ============================================================================

const CONFIG = {
	// Test defaults (can be overridden by CLI args)
	DEFAULT_PROMPT:
		'Create a new route at /posts/new with a form to create a blog post (title and content fields). On successful submission, redirect to /posts. Show validation errors if title is empty.',
	DEFAULT_ITERATIONS: 10,
	DEFAULT_HOOK_CONFIG: 'llm-eval', // none, simple, llm-eval, forced
	DEFAULT_MODEL: 'claude-haiku-4-5-20251001',
	DEFAULT_DB_PATH: './data/evals.db',

	// Agent SDK options
	SDK_OPTIONS: {
		cwd: process.cwd(),
		settingSources: ['project'],
		allowedTools: ['Skill'],
		maxTurns: 2,
		verbose: true, // Enable verbose logging to see errors
	},

	// Pricing (per million tokens)
	PRICING: {
		INPUT_PER_MTOK: 3.0, // $3/MTok
		OUTPUT_PER_MTOK: 15.0, // $15/MTok
		CACHE_READ_PER_MTOK: 0.3, // $0.30/MTok
	},

	// Database settings
	TEST_TYPE: 'activation',
	TEST_CASE_SOURCE: 'real_session',
	RESPONSE_PREVIEW_LENGTH: 200,
	PREVIOUS_RUNS_LIMIT: 5,

	// Valid hook configurations
	VALID_HOOKS: ['none', 'simple', 'llm-eval', 'forced'],

	// Hook detection patterns
	EVAL_PATTERNS: ['Step 1', 'EVALUATE', 'Step 2', 'ACTIVATE'],
};

// ============================================================================
// Parse command line arguments
// ============================================================================

const args = process.argv.slice(2);
const getArg = (flag) => {
	const index = args.indexOf(flag);
	return index !== -1 ? args[index + 1] : null;
};

const PROMPT = getArg('--prompt') || CONFIG.DEFAULT_PROMPT;
const ITERATIONS = parseInt(
	getArg('--iterations') || String(CONFIG.DEFAULT_ITERATIONS),
);
const HOOK_CONFIG =
	getArg('--hook-config') || CONFIG.DEFAULT_HOOK_CONFIG;
const EXPECTED_SKILLS = getArg('--expected-skills')?.split(',') || [];
const MODEL = getArg('--model') || CONFIG.DEFAULT_MODEL;
const DB_PATH = getArg('--db') || CONFIG.DEFAULT_DB_PATH;

// Validate API key
if (!process.env.ANTHROPIC_API_KEY) {
	console.error(
		'❌ Error: ANTHROPIC_API_KEY environment variable not set',
	);
	console.error('   Set it with: export ANTHROPIC_API_KEY=your-key');
	process.exit(1);
}

// Validate hook_config
if (!CONFIG.VALID_HOOKS.includes(HOOK_CONFIG)) {
	console.error(
		`❌ Error: Invalid hook-config "${HOOK_CONFIG}". Must be one of: ${CONFIG.VALID_HOOKS.join(', ')}`,
	);
	process.exit(1);
}

// Get git commit hash
let gitCommitHash = null;
try {
	gitCommitHash = execSync('git rev-parse HEAD', {
		encoding: 'utf8',
	}).trim();
} catch (e) {
	console.warn('⚠️  Could not get git commit hash');
}

console.log('🧪 HOOK EFFECTIVENESS TEST');
console.log('='.repeat(70));
console.log('Prompt:', PROMPT);
console.log('Iterations:', ITERATIONS);
console.log('Hook Config (label):', HOOK_CONFIG);
console.log(
	'⚠️  Note: Actual hook from .claude/settings.json - run ./check-current-hook.sh to verify',
);
console.log(
	'Expected Skills:',
	EXPECTED_SKILLS.length > 0 ? EXPECTED_SKILLS.join(', ') : 'any',
);
console.log('Model:', MODEL);
console.log('Database:', DB_PATH);
console.log('Git Commit:', gitCommitHash || 'N/A');
console.log(
	'API Key:',
	process.env.ANTHROPIC_API_KEY ? 'Set ✓' : 'NOT SET ✗',
);
console.log('='.repeat(70));
console.log('');

// Open database
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// Create test run
const runId = randomUUID();
const runTimestamp = Date.now();

// Results tracking
const results = [];
let totalInputTokens = 0;
let totalOutputTokens = 0;
let totalCacheReadTokens = 0;
let totalLatencyMs = 0;
let totalCostUsd = 0;

// Run iterations
for (let i = 1; i <= ITERATIONS; i++) {
	process.stdout.write(`\r[${i}/${ITERATIONS}] Running test...`);

	const startTime = Date.now();

	try {
		const result = await query({
			prompt: PROMPT,
			options: {
				...CONFIG.SDK_OPTIONS,
				model: MODEL,
			},
		});

		let activatedSkills = [];
		let firstResponseText = '';
		let hasEvalPattern = false;
		let usage = null;

		// Consume the stream
		for await (const event of result) {
			if (event.type === 'assistant' && event.message?.content) {
				for (const content of event.message.content) {
					if (content.type === 'text' && !firstResponseText) {
						firstResponseText = content.text;
						hasEvalPattern = CONFIG.EVAL_PATTERNS.some((pattern) =>
							content.text.includes(pattern),
						);
					}
					if (
						content.type === 'tool_use' &&
						content.name === 'Skill'
					) {
						activatedSkills.push(content.input?.skill);
					}
				}

				// Capture usage stats
				if (event.message.usage) {
					usage = event.message.usage;
				}
			}

			// Also check for result event with usage
			if (event.type === 'result' && event.usage) {
				usage = event.usage;
			}
		}

		const latencyMs = Date.now() - startTime;

		// Calculate cost
		const inputTokens = usage?.input_tokens || 0;
		const outputTokens = usage?.output_tokens || 0;
		const cacheReadTokens = usage?.cache_read_input_tokens || 0;

		const costUsd =
			(inputTokens / 1_000_000) * CONFIG.PRICING.INPUT_PER_MTOK +
			(outputTokens / 1_000_000) * CONFIG.PRICING.OUTPUT_PER_MTOK +
			(cacheReadTokens / 1_000_000) *
				CONFIG.PRICING.CACHE_READ_PER_MTOK;

		totalInputTokens += inputTokens;
		totalOutputTokens += outputTokens;
		totalCacheReadTokens += cacheReadTokens;
		totalLatencyMs += latencyMs;
		totalCostUsd += costUsd;

		// Determine if test passed
		let passed = false;
		if (EXPECTED_SKILLS.length > 0) {
			// Check if all expected skills were activated
			passed = EXPECTED_SKILLS.every((skill) =>
				activatedSkills.includes(skill),
			);
		} else {
			// Just check if ANY skills were activated
			passed = activatedSkills.length > 0;
		}

		results.push({
			id: randomUUID(),
			activatedSkills,
			hasEvalPattern,
			passed,
			firstResponseText: firstResponseText.substring(
				0,
				CONFIG.RESPONSE_PREVIEW_LENGTH,
			),
			inputTokens,
			outputTokens,
			cacheReadTokens,
			latencyMs,
			costUsd,
		});
	} catch (error) {
		console.error(`\n❌ Error on iteration ${i}:`, error.message);
		console.error('Full error:', error);
		if (error.stack) {
			console.error('Stack trace:', error.stack);
		}
		results.push({
			id: randomUUID(),
			activatedSkills: [],
			hasEvalPattern: false,
			passed: false,
			error: error.message,
			firstResponseText: '',
			inputTokens: 0,
			outputTokens: 0,
			cacheReadTokens: 0,
			latencyMs: Date.now() - startTime,
			costUsd: 0,
		});
	}
}

console.log('\r✅ All tests completed' + ' '.repeat(30));
console.log('');

// Calculate stats
const passedTests = results.filter((r) => r.passed).length;
const failedTests = results.filter((r) => !r.passed).length;
const avgLatencyMs = totalLatencyMs / ITERATIONS;
const activationRate = ((passedTests / ITERATIONS) * 100).toFixed(1);

// Insert test run
db.prepare(
	`
  INSERT INTO test_runs (
    id, run_timestamp, model, hook_config, git_commit_hash,
    total_tests, passed_tests, failed_tests, test_type,
    total_input_tokens, total_output_tokens, total_cache_read_tokens,
    total_latency_ms, total_cost_usd, avg_latency_ms, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
).run(
	runId,
	runTimestamp,
	MODEL,
	HOOK_CONFIG,
	gitCommitHash,
	ITERATIONS,
	passedTests,
	failedTests,
	CONFIG.TEST_TYPE,
	totalInputTokens,
	totalOutputTokens,
	totalCacheReadTokens,
	totalLatencyMs,
	totalCostUsd,
	avgLatencyMs,
	Date.now(),
);

// Insert individual results
const insertResult = db.prepare(`
  INSERT INTO activation_results (
    id, run_id, test_id, query, expected_skill, activated_skill,
    should_activate, passed, error, test_case_source,
    input_tokens, output_tokens, cache_read_tokens,
    latency_ms, estimated_cost_usd, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

results.forEach((result, index) => {
	const expectedSkill =
		EXPECTED_SKILLS.length > 0 ? EXPECTED_SKILLS.join(',') : 'any';
	const activatedSkill =
		result.activatedSkills.length > 0
			? result.activatedSkills.join(',')
			: null;

	insertResult.run(
		result.id,
		runId,
		`hook-test-${index + 1}`,
		PROMPT,
		expectedSkill,
		activatedSkill,
		1, // should_activate
		result.passed ? 1 : 0,
		result.error || null,
		CONFIG.TEST_CASE_SOURCE,
		result.inputTokens,
		result.outputTokens,
		result.cacheReadTokens,
		result.latencyMs,
		result.costUsd,
		Date.now(),
	);
});

// Print summary
console.log('📊 RESULTS SUMMARY');
console.log('='.repeat(70));
console.log('');
console.log(
	`✅ Passed: ${passedTests}/${ITERATIONS} (${activationRate}%)`,
);
console.log(`❌ Failed: ${failedTests}/${ITERATIONS}`);
console.log('');
console.log('💰 Cost Analysis:');
console.log(`   Total cost: $${totalCostUsd.toFixed(4)}`);
console.log(
	`   Avg per test: $${(totalCostUsd / ITERATIONS).toFixed(4)}`,
);
console.log('');
console.log('⏱️  Performance:');
console.log(`   Total time: ${(totalLatencyMs / 1000).toFixed(1)}s`);
console.log(`   Avg per test: ${(avgLatencyMs / 1000).toFixed(2)}s`);
console.log('');
console.log('🎯 Skills Activation:');

// Count skill activations
const skillCounts = {};
results.forEach((r) => {
	r.activatedSkills.forEach((skill) => {
		skillCounts[skill] = (skillCounts[skill] || 0) + 1;
	});
});

if (Object.keys(skillCounts).length > 0) {
	Object.entries(skillCounts)
		.sort((a, b) => b[1] - a[1])
		.forEach(([skill, count]) => {
			const percentage = ((count / ITERATIONS) * 100).toFixed(0);
			console.log(
				`   ${skill}: ${count}/${ITERATIONS} (${percentage}%)`,
			);
		});
} else {
	console.log('   No skills activated in any test ❌');
}

console.log('');
console.log('💾 Results saved to database');
console.log(`   Run ID: ${runId}`);
console.log('');

// Compare to previous runs with same hook config
const previousRuns = db
	.prepare(
		`
  SELECT
    run_timestamp,
    passed_tests,
    total_tests,
    CAST(passed_tests AS REAL) / total_tests * 100 as pass_rate,
    total_cost_usd
  FROM test_runs
  WHERE hook_config = ? AND test_type = ? AND id != ?
  ORDER BY run_timestamp DESC
  LIMIT ?
`,
	)
	.all(
		HOOK_CONFIG,
		CONFIG.TEST_TYPE,
		runId,
		CONFIG.PREVIOUS_RUNS_LIMIT,
	);

if (previousRuns.length > 0) {
	console.log(`📈 Previous runs with hook_config="${HOOK_CONFIG}":`);
	console.log('   Date                | Pass Rate | Cost');
	console.log('   ' + '-'.repeat(50));
	previousRuns.forEach((run) => {
		const date = new Date(run.run_timestamp)
			.toISOString()
			.split('T')[0];
		const passRate = run.pass_rate.toFixed(1).padEnd(6);
		const cost = `$${run.total_cost_usd.toFixed(4)}`.padEnd(8);
		console.log(`   ${date}     | ${passRate}% | ${cost}`);
	});
	console.log('');
}

db.close();

console.log('✨ Done!');
