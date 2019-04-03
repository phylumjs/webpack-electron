
import { app, BrowserWindow } from 'electron';

let win;

app.on('ready', () => {
	win = new BrowserWindow();
	win.loadFile(`${__dirname}/renderer/index.html`);
});

app.on('window-all-closed', () => {
	app.quit();
});
