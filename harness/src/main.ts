import { Daytona } from '@daytonaio/sdk';
import {
	createSandbox,
	setupSandbox,
	teardownSandbox,
} from './sandbox.js';
import { runTest, uploadMonitorScript } from './runner.js';
import {
	aggregateResults,
	generateReport,
	saveConfigResult,
} from './report.js';
import { TEST_CASES } from './test-cases.js';
import { HOOK_CONFIGS, getHookConfig } from './config.js';
import type {
	HookConfigId,
	TestResult,
	ConfigResult,
} from './types.js';

function timestamp(): string {
	return new Date().toISOString().slice(11, 19);
}

function log(msg: string): void {
	console.log(`[${timestamp()}] ${msg}`);
}

function parseArgs(): { configIds: HookConfigId[] } {
	const args = process.argv.slice(2);
	const configIdx = args.indexOf('--config');
	if (configIdx !== -1 && args[configIdx + 1]) {
		const id = args[configIdx + 1] as HookConfigId;
		// Validate the config id
		getHookConfig(id);
		return { configIds: [id] };
	}
	return { configIds: HOOK_CONFIGS.map((c) => c.id) };
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

function resultIcon(result: TestResult): string {
	if (result.correct) return 'Y';
	if (result.activated) return '~';
	return 'N';
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
		const total = TEST_CASES.length;

		for (let i = 0; i < total; i++) {
			const tc = TEST_CASES[i];
			log(`  [${i + 1}/${total}] ${tc.id}...`);

			const result = await runTest(sandbox, tc, config.id);
			results.push(result);

			const icon = resultIcon(result);
			log(
				`  [${i + 1}/${total}] ${tc.id} ${icon} (${result.latency_ms}ms)`,
			);
		}

		const configResult = aggregateResults(config, results);
		await saveConfigResult(configResult);

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

async function main(): Promise<void> {
	log('Skill activation harness starting');

	validateEnv();
	const { configIds } = parseArgs();

	log(`Configs to test: ${configIds.join(', ')}`);
	log(`Test cases: ${TEST_CASES.length}`);

	const daytona = new Daytona();
	const allResults: ConfigResult[] = [];

	for (const configId of configIds) {
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
		log('Report generated');
	} else {
		log('No results to report');
	}

	log('Done');
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
