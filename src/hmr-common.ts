
import { join } from 'path';
import { tmpdir } from 'os';

export function getSocketPath(lpid: number) {
	return join(process.platform === 'win32' ? '\\\\?\\pipe' : tmpdir(), `phylum-electron-hmr-${lpid}`);
}

export function getSocketUrl(lpid: number) {
	return `ws+unix://${getSocketPath(lpid).replace(/\\/g, '/')}`;
}
