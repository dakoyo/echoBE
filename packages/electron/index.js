const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        }
    })
    if (isDev) {
        win.webContents.openDevTools();
    }


    win.loadFile(path.join(__dirname, 'app/index.html'))
}

app.whenReady().then(createWindow)
