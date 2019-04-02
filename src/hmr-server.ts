
import { createServer, Server } from 'http';
import WebSocket = require('ws');
import { remove } from 'fs-extra';
import { getSocketPath } from './hmr-common';
import EventEmitter = require('events');

export class HmrServer extends EventEmitter {
	private constructor(
		private readonly server: Server,
		private readonly wss: WebSocket.Server
	) {
		super();
		wss.on('connection', ws => {
			ws.on('message', data => {
				const message = JSON.parse(data as string);
				switch (message.name) {
					case 'update-rejected':
						this.emit('update-rejected');
						break;
				}
			});
		});
	}

	private disposing: Promise<void>;

	public static async create(lpid: number): Promise<HmrServer> {
		const server = createServer();
		const wss = new WebSocket.Server({ server, clientTracking: true });
		const socketPath = getSocketPath(lpid);
		if (process.platform !== 'win32') {
			await remove(socketPath).catch(() => {});
		}
		await new Promise((resolve, reject) => {
			server.on('error', reject);
			server.on('listening', resolve);
			server.listen(socketPath);
		});
		return new HmrServer(server, wss);
	}

	public send(message: any) {
		if (this.disposing) {
			return false;
		}
		const data = JSON.stringify(message);
		for (const ws of this.wss.clients) {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(data);
				return true;
			}
		}
		return false;
	}

	public async dispose() {
		if (!this.disposing) {
			this.disposing = new Promise((resolve, reject) => {
				this.server.close(error => {
					if (error) {
						reject(error);
					} else {
						resolve();
					}
				});
			}).then(() => {
				for (const ws of this.wss.clients) {
					ws.terminate();
				}
			});
		}
		return this.disposing;
	}
}
