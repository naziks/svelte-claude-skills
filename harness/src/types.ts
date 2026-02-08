export type HookConfigId =
	| 'none'
	| 'simple'
	| 'forced-eval'
	| 'llm-eval'
	| 'type-prompt';

export interface TestCase {
	id: string;
	query: string;
	expected_skill: string; // Actual skill dir name (e.g. "svelte-runes")
	description: string;
}

export interface TestResult {
	test_id: string;
	hook_config: HookConfigId;
	query: string;
	expected_skill: string;
	activated_skills: string[];
	activated: boolean;
	correct: boolean;
	latency_ms: number;
	error?: string;
}

export interface ConfigResult {
	hook_config: HookConfigId;
	total_tests: number;
	activated_count: number;
	correct_count: number;
	activation_rate: number;
	accuracy_rate: number;
	avg_latency_ms: number;
	results: TestResult[];
}

export interface HookConfig {
	id: HookConfigId;
	label: string;
	settings_json: Record<string, unknown>;
	extra_files?: Array<{
		local_path: string;
		remote_path: string;
	}>;
}
