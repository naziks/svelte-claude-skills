import { Daytona } from '@daytonaio/sdk';
import { setupSandbox } from './sandbox.js';
import {
	runTest,
	uploadMonitorScript,
	parseSkillActivations,
} from './runner.js';
import { getHookConfig, EARLY_EXIT_TIMEOUT_SEC } from './config.js';

const configId = (process.argv[2] ?? 'none') as
	| 'forced-eval'
	| 'type-prompt'
	| 'simple'
	| 'none';
const config = getHookConfig(configId);

console.log(
	`Debug: config=${config.id} (${config.label}), timeout=${EARLY_EXIT_TIMEOUT_SEC}s`,
);

const daytona = new Daytona();

console.log('Creating sandbox...');
const sandbox = await daytona.create({
	language: 'typescript',
	envVars: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY! },
	autoStopInterval: 10,
});

try {
	console.log('Setting up sandbox...');
	await setupSandbox(sandbox, config);
	await uploadMonitorScript(sandbox);

	// Verify setup
	const lsResult = await sandbox.process.executeCommand(
		'ls -la /home/daytona/.claude/skills/ && cat /home/daytona/.claude/settings.json',
	);
	console.log('--- SANDBOX STATE ---');
	console.log(lsResult.result);
	console.log('--- END ---\n');

	// Run 2 test cases
	const tests = [
		{
			id: 'act-001',
			query: 'How do I use $state in Svelte 5?',
			expected_skill: 'svelte-runes',
			description: 'test runes',
		},
		{
			id: 'act-002',
			query: 'How do I set up SvelteKit routing with nested layouts?',
			expected_skill: 'sveltekit-structure',
			description: 'test structure',
		},
	];

	for (const tc of tests) {
		console.log(
			`\n--- Running: ${tc.id} (${tc.query.slice(0, 50)}...) ---`,
		);
		const result = await runTest(sandbox, tc, configId);
		console.log(`  activated: ${result.activated}`);
		console.log(`  correct: ${result.correct}`);
		console.log(
			`  skills: ${result.activated_skills.join(', ') || '(none)'}`,
		);
		console.log(`  latency: ${result.latency_ms}ms`);
		if (result.error) console.log(`  error: ${result.error}`);
	}
} finally {
	console.log('\nTearing down...');
	await daytona.delete(sandbox);
	console.log('Done');
}
