'use strict';

const { isAbsolute } = require('path');
const { config } = require('@phylum/cli');
const { Task } = require('@phylum/pipeline');
const { HotModuleReplacementPlugin } = require('webpack');
const { WebpackTask } = require('@phylum/webpack');
const { WebpackElectronTask } = require('..');

const bundleMain = new WebpackTask(new Task(async t => {
	const { command } = await t.use(config);
	return {
		context: `${__dirname}/..`,
		mode: 'production',
		entry: './sample/src/main',
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
		externals: (ctx, req, cb) => /!/.test(req) || /^(\.\.|\.)([\\/]|$)/.test(req) || isAbsolute(req)
			? cb() : cb(null, `commonjs ${req}`)
	};
}));

const bundleMainAndLog = bundleMain.transform(stats => {
	const data = stats.toJson();
	for (const msg of data.errors) {
		console.error(msg);
	}
	for (const msg of data.warnings) {
		console.warn(msg);
	}
	console.log('Main bundle complete.');
});

const electron = new WebpackElectronTask({
	main: bundleMain
});

exports.default = new Task(async t => {
	await t.use(bundleMainAndLog);
	await t.use(electron);
});

exports.args = [
	{name: 'dev', alias: 'd', type: 'flag', defaultValue: false}
];
