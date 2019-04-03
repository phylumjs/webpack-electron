/// <reference path="../types/webpack.d.ts"/>

import { getSocketUrl } from './hmr-common';
import { parse as parseQuery } from 'querystring';
import { ipcMain, BrowserWindow, ipcRenderer } from 'electron';
import WebSocket = require('ws');

if (process.type === 'renderer') {
	const query = parseQuery(__resourceQuery.slice(1));
	const name = typeof query.name === 'string' ? query.name : 'default';
	const reboot = query.onreject === 'reboot';
	ipcRenderer.on('phylum-electron-renderer-update', (e: any, message: any) => {
		if (message.renderer === name) {
			applyRendererUpdates();
		}
	});

	function applyRendererUpdates() {
		function rejectUpdates() {
			if (reboot) {
				ipcRenderer.send('phylum-electron-renderer-reboot');
			} else {
				location.reload();
			}
		}

		if (module.hot && module.hot.status() === 'idle') {
			let reject = false;
			module.hot.check({
				onUnaccepted: () => reject = true,
				onDeclined: () => reject = true
			}).catch(() => {
				reject = true;
			}).then(() => {
				if (reject) {
					rejectUpdates();
				}
			});
		} else {
			rejectUpdates();
		}
	}

} else {
	const socket = new WebSocket(getSocketUrl(process.pid));
	socket.on('message', data => {
		const message = JSON.parse(data as string);
		switch (message.name) {
			case 'update-main':
				applyMainUpdates();
				break;

			case 'update-renderer':
				for (const window of BrowserWindow.getAllWindows()) {
					window.webContents.send('phylum-electron-renderer-update', message);
				}
				break;
		}
	});

	ipcMain.on('phylum-electron-renderer-reboot', () => {
		socket.send(JSON.stringify({ name: 'update-rejected' }));
	});

	function applyMainUpdates() {
		if (module.hot && module.hot.status() === 'idle') {
			let reject = false;
			module.hot.check({
				onUnaccepted: () => reject = true,
				onDeclined: () => reject = true
			}).catch(() => {
				reject = true;
			}).then(() => {
				if (reject) {
					socket.send(JSON.stringify({ name: 'update-rejected' }));
				}
			});
		} else {
			socket.send(JSON.stringify({ name: 'update-rejected' }));
		}
	}
}
