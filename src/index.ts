
import { inspect } from 'util';
import { Task } from '@phylum/pipeline';
import { WebpackTask } from '@phylum/webpack';
import { resolve } from 'path';
import { spawn, StdioOptions } from 'child_process';
import { HmrServer } from './hmr-server';

async function resolveExecutable(): Promise<string> {
	return import('electron/index');
}

export class WebpackElectronTask extends Task<WebpackElectronResult> {
	public constructor(optionsTask: Task<WebpackElectronOptions>) {
		super(async t => {
			const options = await t.use(optionsTask);
			const mainCompiler = await t.use(options.main.getCompiler);
			const context = mainCompiler.options.context || process.cwd();
			let proc = spawn(options.executable || await resolveExecutable(), [
				options.entry ? resolve(context, options.entry) : mainCompiler.options.output.path,
				...(options.args || [])
			], {
				cwd: options.cwd || context,
				shell: false,
				stdio: options.stdio || [0, 1, 2],
				uid: options.uid,
				gid: options.gid
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

			if (options.mainHmr) {
				t.using(options.main.pipe(state => {
					state.catch(() => {}).then(() => {
						if (!hmr.send({ name: 'update-main' })) {
							t.reset();
						}
					});
				}, false));
			}
			if (options.rendererHmr) {
				function sendRendererUpdates(name: string, renderer: WebpackTask) {
					t.using(renderer.pipe(state => {
						state.then(stats => {
							if (!hmr.send({
								name: 'update-renderer',
								renderer: name,
								stats: stats.toJson({ all: false, errors: true, warnings: true })
							})) {
								t.reset();
							}
						}).catch(error => {
							if (!hmr.send({
								name: 'update-renderer',
								renderer: name,
								error: error.stack || inspect(error)
							})) {
								t.reset();
							}
						});
					}, false));
				}

				if (options.renderer instanceof WebpackTask) {
					sendRendererUpdates('default', options.renderer);
				} else if (options.renderer) {
					for (const name in options.renderer) {
						sendRendererUpdates(name, options.renderer[name]);
					}
				}
			}
			return result;
		});
		this.optionsTask = optionsTask;
	}

	public readonly optionsTask: Task<WebpackElectronOptions>;
}

export interface WebpackElectronOptions {
	readonly main: WebpackTask;
	readonly mainHmr?: boolean;
	readonly renderer?: WebpackTask | { [Name in string]: WebpackTask };
	readonly rendererHmr?: boolean;
	readonly executable?: string;
	readonly entry?: string;
	readonly cwd?: string;
	readonly args?: string[];
	readonly stdio?: StdioOptions;
	readonly uid?: number;
	readonly gid?: number;
}

export interface WebpackElectronResult {
	code: number;
	signal: string;
}
