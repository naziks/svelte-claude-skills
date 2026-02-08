import { mkdir, writeFile } from 'fs/promises';
import type {
	ConfigResult,
	HookConfig,
	HookConfigId,
	TestResult,
} from './types.js';
import { RESULTS_DIR } from './config.js';

export function aggregateResults(
	hookConfig: HookConfig,
	results: TestResult[],
): ConfigResult {
	const activated_count = results.filter((r) => r.activated).length;
	const correct_count = results.filter((r) => r.correct).length;
	const total = results.length;
	const avg_latency_ms =
		total > 0
			? results.reduce((sum, r) => sum + r.latency_ms, 0) / total
			: 0;

	return {
		hook_config: hookConfig.id,
		total_tests: total,
		activated_count,
		correct_count,
		activation_rate: total > 0 ? activated_count / total : 0,
		accuracy_rate: total > 0 ? correct_count / total : 0,
		avg_latency_ms,
		results,
	};
}

function pct(rate: number, count: number, total: number): string {
	return `${(rate * 100).toFixed(0)}% (${count}/${total})`;
}

function pad(str: string, len: number): string {
	return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
	return str.length >= len ? str : ' '.repeat(len - str.length) + str;
}

export async function generateReport(
	allResults: ConfigResult[],
): Promise<void> {
	// -- Comparison table --
	const colConfig = 16;
	const colAct = 14;
	const colCorr = 14;
	const colLat = 12;

	const header = [
		pad('Config', colConfig),
		pad('Activation', colAct),
		pad('Correct', colCorr),
		pad('Avg Latency', colLat),
	].join(' | ');

	const separator = [
		'-'.repeat(colConfig),
		'-'.repeat(colAct),
		'-'.repeat(colCorr),
		'-'.repeat(colLat),
	].join('-+-');

	console.log('');
	console.log('=== Comparison Report ===');
	console.log('');
	console.log(header);
	console.log(separator);

	for (const cr of allResults) {
		const row = [
			pad(cr.hook_config, colConfig),
			pad(
				pct(cr.activation_rate, cr.activated_count, cr.total_tests),
				colAct,
			),
			pad(
				pct(cr.accuracy_rate, cr.correct_count, cr.total_tests),
				colCorr,
			),
			padLeft(`${cr.avg_latency_ms.toFixed(0)}ms`, colLat),
		].join(' | ');
		console.log(row);
	}

	// -- Per-category breakdown --
	const categories = new Map<string, TestResult[]>();
	for (const cr of allResults) {
		for (const r of cr.results) {
			const cat = r.expected_skill;
			if (!categories.has(cat)) categories.set(cat, []);
			categories.get(cat)!.push(r);
		}
	}

	console.log('');
	console.log('=== Per-Category Breakdown ===');

	const configIds = allResults.map((cr) => cr.hook_config);

	for (const [category, tests] of Array.from(categories.entries())) {
		console.log('');
		console.log(`  ${category}:`);

		for (const configId of configIds) {
			const configTests = tests.filter(
				(t) => t.hook_config === configId,
			);
			if (configTests.length === 0) continue;
			const correctCount = configTests.filter(
				(t) => t.correct,
			).length;
			const total = configTests.length;
			const rate = total > 0 ? correctCount / total : 0;
			console.log(
				`    ${pad(configId, 16)} ${pct(rate, correctCount, total)}`,
			);
		}
	}

	console.log('');

	// -- Write JSON report --
	await ensureResultsDir();
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const jsonPath = `${RESULTS_DIR}/${timestamp}-comparison.json`;
	await writeFile(jsonPath, JSON.stringify(allResults, null, 2));
	console.log(`Full report written to ${jsonPath}`);
}

export async function saveConfigResult(
	configResult: ConfigResult,
): Promise<void> {
	await ensureResultsDir();
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const jsonPath = `${RESULTS_DIR}/${timestamp}-${configResult.hook_config}.json`;
	await writeFile(jsonPath, JSON.stringify(configResult, null, 2));
	console.log(`Config result saved to ${jsonPath}`);
}

async function ensureResultsDir(): Promise<void> {
	await mkdir(RESULTS_DIR, { recursive: true });
}
