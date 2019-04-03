'use strict';

const { isAbsolute } = require('path');
const { remove } = require('fs-extra');
const { config } = require('@phylum/cli');
const { Task } = require('@phylum/pipeline');
const { HotModuleReplacementPlugin } = require('webpack');
const HtmlPlugin = require('html-webpack-plugin');
const { WebpackTask } = require('@phylum/webpack');
const { WebpackElectronTask } = require('..');

const clean = new Task(async () => {
	await remove(`${__dirname}/dist`);
});

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

const bundleRenderer = new WebpackTask(new Task(async t => {
	const { command } = await t.use(config);
	return {
		name: 'renderer',
		context: `${__dirname}/..`,
		mode: 'production',
		entry: [
			...(command.dev ? [require.resolve('../dist/hmr') + '?onreject=reboot'] : []),
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

function webpackLog(stats) {
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

const bundleMainAndLog = bundleMain.transform(webpackLog);
const bundleRendererAndLog = bundleRenderer.transform(webpackLog);

const electron = new WebpackElectronTask({
	hot: true,
	main: bundleMain,
	renderer: bundleRenderer
});

exports.default = new Task(async t => {
	const { command } = await t.use(config);
	await t.use(clean);
	await Promise.all([
		t.use(bundleMainAndLog),
		t.use(bundleRendererAndLog)
	]);
	if (command.dev) {
		await t.use(electron);
	}
});

exports.args = [
	{name: 'dev', alias: 'd', type: 'flag', defaultValue: false}
];
