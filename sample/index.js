'use strict';

const { isAbsolute } = require('path');
const { remove } = require('fs-extra');
const { config } = require('@phylum/cli');
const { Task } = require('@phylum/pipeline');
const { HotModuleReplacementPlugin } = require('webpack');
const HtmlPlugin = require('html-webpack-plugin');
const { WebpackTask } = require('@phylum/webpack');
const { WebpackElectronTask } = require('..');

/**
 * This task is used for cleaning up the output directory:
 */
const clean = new Task(async () => {
	await remove(`${__dirname}/dist`);
});

/**
 * Webpack task that bundles main process code.
 */
const bundleMain = new WebpackTask(new Task(async t => {
	const { command } = await t.use(config);
	return {
		name: 'main',
		context: `${__dirname}/..`,
		mode: 'production',
		entry: [
			...(command.dev ? [require.resolve('../dist/hmr')] : []),
			'./sample/src/main'
		],
		target: 'electron-main',
		output: {
			path: `${__dirname}/dist`,
			filename: 'index.js'
		},
		plugins: command.dev ? [
			new HotModuleReplacementPlugin()
		] : [],
		watch: command.dev,
		node: false,
		externals: (ctx, req, cb) => /[?!]/.test(req) || /^(\.\.|\.)([\\/]|$)/.test(req) || isAbsolute(req)
			? cb() : cb(null, `commonjs ${req}`)
	};
}));

/**
 * Webpack task that bundles renderer process code.
 */
const bundleRenderer = new WebpackTask(new Task(async t => {
	const { command } = await t.use(config);
	return {
		name: 'renderer',
		context: `${__dirname}/..`,
		mode: 'production',
		entry: [
			...(command.dev ? [require.resolve('../dist/hmr')] : []),
			'./sample/src/renderer'
		],
		target: 'electron-renderer',
		output: {
			path: `${__dirname}/dist/renderer`,
			filename: 'index.js'
		},
		plugins: [
			...(command.dev ? [
				new HotModuleReplacementPlugin()
			] : []),
			new HtmlPlugin({
				template: './sample/src/renderer/index.html',
				inject: 'body'
			})
		],
		watch: command.dev,
		node: false,
		externals: (ctx, req, cb) => /[?!]/.test(req) || /^(\.\.|\.)([\\/]|$)/.test(req) || isAbsolute(req)
			? cb() : cb(null, `commonjs ${req}`)
	}
}));

/**
 * The following tasks add minimal logging when a compilation completes:
 */
const bundleMainAndLog = bundleMain.transform(log);
const bundleRendererAndLog = bundleRenderer.transform(log);

function log(stats) {
	const data = stats.toJson();
	for (const msg of data.errors) {
		console.error(msg);
	}
	for (const msg of data.warnings) {
		console.warn(msg);
	}
	if (data.errors.length === 0) {
		console.log(`Bundle complete: ${stats.compilation.compiler.options.name}`);
	}
}

/**
 * The electron task.
 */
const electron = new WebpackElectronTask(Task.value({
	mainHmr: true,
	main: bundleMain,
	rendererHmr: true,
	renderer: bundleRenderer
}));

/**
 * The main task that will be executed by the phylum cli:
 */
exports.default = new Task(async t => {
	const { command } = await t.use(config);
	await t.use(clean);
	await Promise.all([
		t.use(bundleMainAndLog),
		t.use(bundleRendererAndLog)
	]);
	// Only start the electron app when running in dev mode:
	if (command.dev) {
		await t.use(electron);
	}
});

/**
 * Add a '--dev | -d' flag to be parsed by the phylum cli:
 */
exports.args = [
	{name: 'dev', alias: 'd', type: 'flag', defaultValue: false}
];
