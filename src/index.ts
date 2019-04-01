
import { Task } from '@phylum/pipeline';
import { WebpackTask } from '@phylum/webpack';
import electron = require('electron/index');
import { resolve } from 'path';
import { spawn } from 'child_process';

export class WebpackElectronTask extends Task<WebpackElectronResult> {
	public constructor(options: WebpackElectronOptions) {
		super(async t => {
			const mainCompiler = await t.use(options.main.getCompiler);
			const context = mainCompiler.options.context || process.cwd();
			const proc = spawn(electron, [
				options.entry ? resolve(context, options.entry) : mainCompiler.options.output.path,
				...(options.args || [])
			], {
				cwd: options.cwd || context,
				shell: false
			});
			const exited = new Promise<void>(resolve => {
				proc.on('error', resolve);
				proc.on('exit', resolve);
			});
			t.using(() => {
				if (!proc.killed) {
					proc.kill();
				}
				return exited;
			});

			// TODO: Send updates to main process.
			// TODO: When main process rejects an update, reset this task.
			// TODO: When renderer process rejects an update, reload renderer or
			//       reset this task (configurable via renderer hmr client import).

			return new Promise<WebpackElectronResult>((resolve, reject) => {
				proc.on('error', reject);
				proc.on('exit', (code, signal) => {
					resolve({code, signal});
				});
			});
		});
		this.mainWebpackTask = options.main;
	}

	public readonly mainWebpackTask: WebpackTask;
}

export interface WebpackElectronOptions {
	readonly main: WebpackTask;
	readonly entry?: string;
	readonly cwd?: string;
	readonly args?: string[];
}

export interface WebpackElectronResult {
	code: number;
	signal: string;
}
