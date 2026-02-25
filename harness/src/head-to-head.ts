import { Daytona } from '@daytonaio/sdk';
import { getHookConfig } from './config.js';
import { HARD_TEST_CASES } from './hard-test-cases.js';
import { aggregateResults, generateReport } from './report.js';
import { runTest, uploadMonitorScript } from './runner.js';
import {
	createSandbox,
	setupSandbox,
	teardownSandbox,
} from './sandbox.js';
import type {
	ConfigResult,
	HookConfigId,
	TestResult,
} from './types.js';

const CONFIGS_TO_TEST: HookConfigId[] = ['forced-eval', 'llm-eval'];

function timestamp(): string {
	return new Date().toISOString().slice(11, 19);
}

function log(msg: string): void {
	console.log(`[${timestamp()}] ${msg}`);
}

function resultIcon(r: TestResult): string {
	if (r.expected_skill === 'none') {
		// Negative case: correct if NO skill activated
		return r.activated ? 'FP' : 'TN';
	}
	if (r.correct) return 'Y';
	if (r.activated) return '~';
	return 'N';
}

function validateEnv(): void {
	const required = ['ANTHROPIC_API_KEY', 'DAYTONA_API_KEY'];
	const missing = required.filter((k) => !process.env[k]);
	if (missing.length > 0) {
		throw new Error(
			`Missing required env vars: ${missing.join(', ')}`,
		);
	}
}

async function runConfig(
	daytona: Daytona,
	configId: HookConfigId,
): Promise<ConfigResult> {
	const config = getHookConfig(configId);
	log(`=== Config: ${config.label} (${config.id}) ===`);

	const sandbox = await createSandbox(daytona, config);
	try {
		await setupSandbox(sandbox, config);
		await uploadMonitorScript(sandbox);

		const results: TestResult[] = [];
		const total = HARD_TEST_CASES.length;

		for (let i = 0; i < total; i++) {
			const tc = HARD_TEST_CASES[i];
			log(`  [${i + 1}/${total}] ${tc.id}: ${tc.description}`);

			const result = await runTest(sandbox, tc, configId);
			results.push(result);

			const icon = resultIcon(result);
			const skills =
				result.activated_skills.length > 0
					? result.activated_skills.join(', ')
					: '(none)';
			log(
				`  [${i + 1}/${total}] ${tc.id} ${icon} => ${skills} (${result.latency_ms}ms)`,
			);
		}

		const configResult = aggregateResults(config, results);

		log(
			`  Summary: ${configResult.correct_count}/${configResult.total_tests} correct, ` +
				`${configResult.activated_count} activated, ` +
				`avg ${Math.round(configResult.avg_latency_ms)}ms`,
		);

		return configResult;
	} finally {
		await teardownSandbox(daytona, sandbox);
	}
}

function printNegativeAnalysis(allResults: ConfigResult[]): void {
	console.log('');
	console.log('=== Negative Case Analysis ===');
	console.log('(expected_skill=none: correct if NO skill activated)');
	console.log('');

	for (const cr of allResults) {
		console.log(`  ${cr.hook_config}:`);
		const negatives = cr.results.filter(
			(r) => r.expected_skill === 'none',
		);
		const trueNeg = negatives.filter((r) => !r.activated).length;
		const falsePos = negatives.filter((r) => r.activated).length;
		console.log(`    True negatives: ${trueNeg}/${negatives.length}`);
		console.log(
			`    False positives: ${falsePos}/${negatives.length}`,
		);

		for (const r of negatives) {
			const icon = r.activated ? 'FP' : 'TN';
			const skills =
				r.activated_skills.length > 0
					? r.activated_skills.join(', ')
					: '(none)';
			console.log(`      ${icon} ${r.test_id}: ${skills}`);
		}
	}
}

function printDiffTable(allResults: ConfigResult[]): void {
	if (allResults.length < 2) return;

	const [a, b] = allResults;
	console.log('');
	console.log(`=== Diff: ${a.hook_config} vs ${b.hook_config} ===`);
	console.log('');

	const positives = HARD_TEST_CASES.filter(
		(tc) => tc.expected_skill !== 'none',
	);

	let aWins = 0;
	let bWins = 0;
	let ties = 0;

	for (const tc of positives) {
		const aResult = a.results.find((r) => r.test_id === tc.id);
		const bResult = b.results.find((r) => r.test_id === tc.id);
		if (!aResult || !bResult) continue;

		const aOk = aResult.correct;
		const bOk = bResult.correct;

		if (aOk === bOk) {
			ties++;
		} else if (aOk && !bOk) {
			aWins++;
			console.log(
				`  ${a.hook_config} wins: ${tc.id} "${tc.query.slice(0, 60)}"`,
			);
		} else {
			bWins++;
			console.log(
				`  ${b.hook_config} wins: ${tc.id} "${tc.query.slice(0, 60)}"`,
			);
		}
	}

	console.log('');
	console.log(`  ${a.hook_config} wins: ${aWins}`);
	console.log(`  ${b.hook_config} wins: ${bWins}`);
	console.log(`  Ties: ${ties}`);
}

async function main(): Promise<void> {
	log('Head-to-head comparison: forced-eval vs llm-eval');
	log(`Test cases: ${HARD_TEST_CASES.length} (harder prompts)`);

	validateEnv();

	const daytona = new Daytona();
	const allResults: ConfigResult[] = [];

	for (const configId of CONFIGS_TO_TEST) {
		try {
			const result = await runConfig(daytona, configId);
			allResults.push(result);
		} catch (err) {
			log(
				`ERROR running config ${configId}: ${err instanceof Error ? err.message : err}`,
			);
		}
	}

	if (allResults.length > 0) {
		await generateReport(allResults);
		printNegativeAnalysis(allResults);
		printDiffTable(allResults);
		log('Head-to-head complete');
	} else {
		log('No results to report');
	}
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
