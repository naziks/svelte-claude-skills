import { Daytona } from '@daytonaio/sdk';
import type { Sandbox } from '@daytonaio/sdk';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { HookConfig } from './types.js';
import {
	SKILLS_DIR,
	HOOKS_LOCAL_DIR,
	SANDBOX_AUTO_STOP_MIN,
} from './config.js';

const SANDBOX_WORKDIR = '/home/daytona';
const CLAUDE_DIR = `${SANDBOX_WORKDIR}/.claude`;

export async function createSandbox(
	daytona: Daytona,
	config: HookConfig,
): Promise<Sandbox> {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new Error(
			'ANTHROPIC_API_KEY environment variable is required',
		);
	}

	const sandbox = await daytona.create({
		language: 'typescript',
		envVars: { ANTHROPIC_API_KEY: apiKey },
		autoStopInterval: SANDBOX_AUTO_STOP_MIN,
	});

	return sandbox;
}

export async function setupSandbox(
	sandbox: Sandbox,
	config: HookConfig,
): Promise<void> {
	// Create .claude directory structure
	await sandbox.process.executeCommand(
		`mkdir -p ${CLAUDE_DIR}/skills ${CLAUDE_DIR}/hooks`,
	);

	// Tar and upload skills directory
	if (existsSync(SKILLS_DIR)) {
		const skillsTar = join(tmpdir(), `skills-${Date.now()}.tar.gz`);
		execSync(`tar -czf "${skillsTar}" -C "${SKILLS_DIR}" .`);
		const skillsBuffer = readFileSync(skillsTar);
		await sandbox.fs.uploadFile(
			skillsBuffer,
			`${CLAUDE_DIR}/skills/skills.tar.gz`,
		);
		await sandbox.process.executeCommand(
			`cd ${CLAUDE_DIR}/skills && tar -xzf skills.tar.gz && rm skills.tar.gz`,
		);
	}

	// Tar and upload hooks directory
	if (existsSync(HOOKS_LOCAL_DIR)) {
		const hooksTar = join(tmpdir(), `hooks-${Date.now()}.tar.gz`);
		execSync(`tar -czf "${hooksTar}" -C "${HOOKS_LOCAL_DIR}" .`);
		const hooksBuffer = readFileSync(hooksTar);
		await sandbox.fs.uploadFile(
			hooksBuffer,
			`${CLAUDE_DIR}/hooks/hooks.tar.gz`,
		);
		await sandbox.process.executeCommand(
			`cd ${CLAUDE_DIR}/hooks && tar -xzf hooks.tar.gz && rm hooks.tar.gz`,
		);
	}

	// Upload extra_files (hook scripts) and make executable
	if (config.extra_files) {
		for (const file of config.extra_files) {
			const content = readFileSync(file.local_path);
			const remotePath = `${SANDBOX_WORKDIR}/${file.remote_path}`;
			await sandbox.fs.uploadFile(content, remotePath);
			await sandbox.process.executeCommand(
				`chmod +x "${remotePath}"`,
			);
		}
	}

	// Upload settings.json (must be Buffer, string is treated as file path)
	const settingsContent = Buffer.from(
		JSON.stringify(config.settings_json, null, 2),
	);
	await sandbox.fs.uploadFile(
		settingsContent,
		`${CLAUDE_DIR}/settings.json`,
	);
}

export async function teardownSandbox(
	daytona: Daytona,
	sandbox: Sandbox,
): Promise<void> {
	await daytona.delete(sandbox);
}
