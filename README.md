# Webpack Electron Task
[![Build Status](https://travis-ci.com/phylumjs/webpack-electron.svg?branch=master)](https://travis-ci.com/phylumjs/webpack-electron)
[![Coverage Status](https://coveralls.io/repos/github/phylumjs/webpack-electron/badge.svg?branch=master)](https://coveralls.io/github/phylumjs/webpack-electron?branch=master)
[![Latest](https://img.shields.io/npm/v/@phylum/webpack-electron.svg?label=latest) ![License](https://img.shields.io/npm/l/@phylum/webpack-electron.svg?label=license)](https://npmjs.org/package/@phylum/webpack-electron)

This package exposes a task that runs an electron instance for webpack bundled code and supports hot module replacement in the main and render process.

## Installation
```bash
npm i webpack @phylum/webpack electron @phylum/webpack-electron
```

# Usage
The webpack electron task runs an electron main process from bundled sources.
*Note, that the webpack tasks will not be started automatically by the webpack electron task.*

```ts
import { Task } from '@phylum/pipeline';
import { WebpackTask } from '@phylum/webpack';
import { WebpackElectronTask } from '@phylum/webpack-electron';

const bundleMain = new WebpackTask(...);

const electron = new WebpackElectronTask(Task.value({
	main: bundleMain
}));

new Task(async t => {
	// Run the webpack compiler:
	await t.use(bundleMain);
	// Start an electron process:
	await t.use(electron);
});
```
*Note that the electron task assumes, that the main bundle has already been compiled.*

# Hot Module Replacement

## Main Bundle
```ts
new WebpackElectronTask(Task.value({
	// Enable hot module replacement:
	mainHmr: true,
	main: bundleMain
}));
```
```ts
// Import the hmr client somewhere in your main process code...
import '@phylum/webpack-electron/dist/hmr';
```
```ts
// ...or add it to your entry point:
entry: ['@phylum/webpack-electron/dist/hmr', './src/main.js'],

// Optional. Include the hmr runtime:
plugins: [
	new webpack.HotModuleReplacementPlugin()
]
```
If the hmr runtime is not included or an update is rejected, the main process will be rebooted.

## Renderer Bundles
For renderer hmr support, it is required that the hmr client is also included in the main bundle as it routes update signals to one or more renderer processes.
```ts
new WebpackElectronTask(Task.value({
	...

	// Enable renderer hmr:
	rendererHmr: true

	// single renderer bundle:
	renderer: bundleRenderer,

	// multiple renderer bundles:
	renderer: {
		foo: bundleRendererFoo,
		bar: bundleRendererBar
	}
}));
```
```ts
// Import the hmr client somewhere in your code...
import '@phylum/webpack-electron/dist/hmr';

// and specify the name when using multiple renderer bundles:
import '@phylum/webpack-electron/dist/hmr?name=foo';
```
```ts
// ...or add it to your entry point:
entry: ['@phylum/webpack-electron/dist/hmr?...', './src/renderer.js'],

// Optional. Include the hmr runtime:
plugins: [
	new webpack.HotModuleReplacementPlugin()
]
```
When a renderer process rejects an update or the hmr runtime is not included, the renderer page will be reloaded by default.<br>
This behaviour can be changed to rebooting the main process instead by using the **onreject** query parameter:
```ts
import '@phylum/webpack-electron/dist/hmr?onreject=reboot';
```
