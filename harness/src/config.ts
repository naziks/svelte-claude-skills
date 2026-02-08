import { resolve } from 'path';
import type { HookConfig, HookConfigId } from './types.js';

const PROJECT_ROOT = resolve(import.meta.dirname, '../../');
const HOOKS_DIR = resolve(PROJECT_ROOT, '.claude/hooks');

export const SKILLS_DIR = resolve(PROJECT_ROOT, '.claude/skills');
export const HOOKS_LOCAL_DIR = HOOKS_DIR;
export const RESULTS_DIR = resolve(import.meta.dirname, '../results');

export const CLAUDE_TIMEOUT_SEC = 120;
export const EARLY_EXIT_TIMEOUT_SEC = 20;
export const SANDBOX_AUTO_STOP_MIN = 30;
export const MONITOR_SCRIPT_PATH = '/home/daytona/monitor-claude.sh';

export const HOOK_CONFIGS: HookConfig[] = [
	{
		id: 'none',
		label: 'No hook (control)',
		settings_json: {},
	},
	{
		id: 'simple',
		label: 'Simple instruction (shell echo)',
		settings_json: {
			hooks: {
				UserPromptSubmit: [
					{
						hooks: [
							{
								type: 'command',
								command:
									'.claude/hooks/skill-simple-instruction-hook.sh',
							},
						],
					},
				],
			},
		},
		extra_files: [
			{
				local_path: resolve(
					HOOKS_DIR,
					'skill-simple-instruction-hook.sh',
				),
				remote_path: '.claude/hooks/skill-simple-instruction-hook.sh',
			},
		],
	},
	{
		id: 'forced-eval',
		label: 'Forced eval (shell multi-step)',
		settings_json: {
			hooks: {
				UserPromptSubmit: [
					{
						hooks: [
							{
								type: 'command',
								command: '.claude/hooks/skill-forced-eval-hook.sh',
							},
						],
					},
				],
			},
		},
		extra_files: [
			{
				local_path: resolve(HOOKS_DIR, 'skill-forced-eval-hook.sh'),
				remote_path: '.claude/hooks/skill-forced-eval-hook.sh',
			},
		],
	},
	{
		id: 'llm-eval',
		label: 'LLM eval (Haiku pre-eval)',
		settings_json: {
			hooks: {
				UserPromptSubmit: [
					{
						hooks: [
							{
								type: 'command',
								command: '.claude/hooks/skill-llm-eval-hook.sh',
							},
						],
					},
				],
			},
		},
		extra_files: [
			{
				local_path: resolve(HOOKS_DIR, 'skill-llm-eval-hook.sh'),
				remote_path: '.claude/hooks/skill-llm-eval-hook.sh',
			},
		],
	},
	{
		id: 'type-prompt',
		label: 'Native type:prompt hook',
		settings_json: {
			hooks: {
				UserPromptSubmit: [
					{
						hooks: [
							{
								type: 'prompt',
								prompt: `Evaluate if any available skills match this user prompt. For each skill in <available_skills>, determine YES/NO. If any are YES, activate them using the Skill(skill-name) tool BEFORE proceeding with implementation.

CRITICAL: You MUST call Skill() tool for each matching skill. Do NOT skip to implementation.`,
								timeout: 30,
							},
						],
					},
				],
			},
		},
	},
];

export function getHookConfig(id: HookConfigId): HookConfig {
	const config = HOOK_CONFIGS.find((c) => c.id === id);
	if (!config) throw new Error(`Unknown hook config: ${id}`);
	return config;
}

export function getConfigIds(): HookConfigId[] {
	return HOOK_CONFIGS.map((c) => c.id);
}
