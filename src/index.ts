
import { Task } from '@phylum/pipeline';
import { WebpackTask } from '@phylum/webpack';
import electron = require('electron/index');
import { resolve } from 'path';
import { spawn } from 'child_process';
import { HmrServer } from './hmr-server';
import { inspect } from 'util';

export class WebpackElectronTask extends Task<WebpackElectronResult> {
	public constructor(options: WebpackElectronOptions) {
		super(async t => {
			const mainCompiler = await t.use(options.main.getCompiler);
			const context = mainCompiler.options.context || process.cwd();
			let proc = spawn(electron, [
				options.entry ? resolve(context, options.entry) : mainCompiler.options.output.path,
				...(options.args || [])
			], {
				cwd: options.cwd || context,
				shell: false,
				stdio: [0, 1, 2]
			});

			const hmr = await HmrServer.create(proc.pid);
			hmr.on('update-rejected', () => {
				this.reset();
			});
			t.using(hmr);

			const done = new Promise<void>(resolve => {
				proc.on('error', resolve);
				proc.on('exit', resolve);
			}).then(() => {
				proc = null;
				hmr.dispose().catch(error => {
					this.throw(error);
				});
			});
			const result = new Promise<WebpackElectronResult>((resolve, reject) => {
				proc.on('error', reject);
				proc.on('exit', (code, signal) => {
					resolve({code, signal});
				});
			});
			t.using(() => {
				if (proc && !proc.killed) {
					proc.kill();
					proc = null;
				}
				return done;
			});

			t.using(options.main.pipe(state => {
				state.catch(() => {}).then(stats => {
					if (!hmr.send({ name: 'update-main' })) {
						t.reset();
					}
				});
			}, false));
			return result;
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
