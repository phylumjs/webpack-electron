
import { getSocketUrl } from './hmr-common';
import WebSocket = require('ws');

if (process['type'] === 'renderer') {
	throw new Error('Hot module replacement is currently not supported in render processes.');
}

const socket = new WebSocket(getSocketUrl(process.pid));
socket.on('message', data => {
	const message = JSON.parse(data as string);
	switch (message.name) {
		case 'update-main':
			applyMainUpdates();
			break;
	}
});

function applyMainUpdates() {
	if (module['hot'] && module['hot'].status() === 'idle') {
		let reject = false;
		module['hot'].check({
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
