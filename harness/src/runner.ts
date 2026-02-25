import type { Sandbox } from '@daytonaio/sdk';
import type { TestCase, TestResult, HookConfigId } from './types.js';
import {
	EARLY_EXIT_TIMEOUT_SEC,
	MONITOR_SCRIPT_PATH,
} from './config.js';

/**
 * Parse skill activations from claude stream-json stdout.
 * Looks for Skill tool_use events and extracts skill names.
 */
export function parseSkillActivations(stdout: string): string[] {
	const skills = new Set<string>();
	const lines = stdout.split('\n');

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		let parsed: unknown;
		try {
			parsed = JSON.parse(trimmed);
		} catch {
			continue;
		}

		if (!parsed || typeof parsed !== 'object') continue;
		const obj = parsed as Record<string, unknown>;

		// Pattern 1: content_block_start with tool_use type
		if (obj.type === 'content_block_start') {
			const block = obj.content_block as
				| Record<string, unknown>
				| undefined;
			if (block?.type === 'tool_use' && block?.name === 'Skill') {
				const input = block.input as
					| Record<string, unknown>
					| undefined;
				if (input) {
					const skillName = extractSkillName(input);
					if (skillName) skills.add(skillName);
				}
			}
		}

		// Pattern 2: assistant message with content array containing tool_use blocks
		if (obj.type === 'assistant' || obj.role === 'assistant') {
			const msg = obj.message as Record<string, unknown> | undefined;
			const content = msg?.content ?? obj.content;
			if (Array.isArray(content)) {
				for (const block of content) {
					if (
						block &&
						typeof block === 'object' &&
						block.type === 'tool_use' &&
						block.name === 'Skill'
					) {
						const input = block.input as
							| Record<string, unknown>
							| undefined;
						if (input) {
							const skillName = extractSkillName(input);
							if (skillName) skills.add(skillName);
						}
					}
				}
			}
		}

		// Pattern 3: direct tool_use object
		if (obj.type === 'tool_use' && obj.name === 'Skill') {
			const input = obj.input as Record<string, unknown> | undefined;
			if (input) {
				const skillName = extractSkillName(input);
				if (skillName) skills.add(skillName);
			}
		}

		// Pattern 4: tool_use in a message event
		if (obj.type === 'message' && obj.message) {
			const msg = obj.message as Record<string, unknown>;
			const content = msg.content;
			if (Array.isArray(content)) {
				for (const block of content) {
					if (
						block &&
						typeof block === 'object' &&
						block.type === 'tool_use' &&
						block.name === 'Skill'
					) {
						const input = block.input as
							| Record<string, unknown>
							| undefined;
						if (input) {
							const skillName = extractSkillName(input);
							if (skillName) skills.add(skillName);
						}
					}
				}
			}
		}
	}

	return [...skills];
}

/**
 * Extract skill name from tool_use input object.
 * Claude may put the skill name in input.skill or input.args.
 */
function extractSkillName(
	input: Record<string, unknown>,
): string | null {
	if (typeof input.skill === 'string' && input.skill) {
		return input.skill;
	}
	if (typeof input.args === 'string' && input.args) {
		return input.args;
	}
	return null;
}

/**
 * Upload the monitor script to the sandbox.
 * Call once after setupSandbox().
 */
export async function uploadMonitorScript(
	sandbox: Sandbox,
): Promise<void> {
	const { readFileSync } = await import('fs');
	const { resolve } = await import('path');
	const scriptPath = resolve(
		import.meta.dirname,
		'../scripts/monitor-claude.sh',
	);
	const content = readFileSync(scriptPath);
	await sandbox.fs.uploadFile(content, MONITOR_SCRIPT_PATH);
	await sandbox.process.executeCommand(
		`chmod +x ${MONITOR_SCRIPT_PATH}`,
	);
}

/**
 * Run a single test case in a Daytona sandbox.
 * Uses monitor script: runs claude with a fixed timeout, kills after N seconds,
 * parses whatever output was captured for Skill() calls.
 */
export async function runTest(
	sandbox: Sandbox,
	testCase: TestCase,
	hookConfigId: HookConfigId,
): Promise<TestResult> {
	const queryFile = `/tmp/query-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`;

	// Upload query as a file to avoid shell escaping issues
	await sandbox.fs.uploadFile(Buffer.from(testCase.query), queryFile);

	const cmd = `${MONITOR_SCRIPT_PATH} "${queryFile}" ${EARLY_EXIT_TIMEOUT_SEC}`;
	const startMs = Date.now();

	try {
		const response = await sandbox.process.executeCommand(
			cmd,
			undefined,
			undefined,
			EARLY_EXIT_TIMEOUT_SEC + 15, // buffer beyond script timeout
		);
		const latencyMs = Date.now() - startMs;

		const stdout = response.result ?? '';
		const activatedSkills = parseSkillActivations(stdout);

		const activated = activatedSkills.length > 0;
		const correct = activatedSkills.includes(testCase.expected_skill);

		return {
			test_id: testCase.id,
			hook_config: hookConfigId,
			query: testCase.query,
			expected_skill: testCase.expected_skill,
			activated_skills: activatedSkills,
			activated,
			correct,
			latency_ms: latencyMs,
		};
	} catch (err) {
		const latencyMs = Date.now() - startMs;
		const errorMsg = err instanceof Error ? err.message : String(err);

		return {
			test_id: testCase.id,
			hook_config: hookConfigId,
			query: testCase.query,
			expected_skill: testCase.expected_skill,
			activated_skills: [],
			activated: false,
			correct: false,
			latency_ms: latencyMs,
			error: errorMsg,
		};
	}
}
