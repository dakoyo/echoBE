const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { Player, Server, ServerEvent } = require('socket-be');
require('./types'); // Import types for JSDoc

import { World, Server as ServerType, ServerEvent as ServerEventTypes } from 'socket-be';

// Define variables
let world: World | null  = null;
let server: ServerType | null = null;
/** @type {any} */
let mainWindow = null;
/** @type {NodeJS.Timeout|null} */
let tickInterval = null;
/** @type {any} */
let localPlayer = null;
let currentPlayers = new Map<string, any>(); // Map to hold player data

function sendJSON(obj) {
    if (!world) return;

    world.runCommand(`scriptevent vc:msg ${JSON.stringify(obj)}`);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        }
    });
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.loadFile(path.join(__dirname, 'app/index.html'));

    mainWindow.on('closed', () => {
        // Stop the server if the main window is closed
        stopServerLogic();
    });
}

async function stopServerLogic() {
    if (tickInterval) {
        clearInterval(tickInterval);
        tickInterval = null;
    }
    if (server) {
        // Assuming the server cleans up its own event listeners on stop.
        // If not, you might need server.removeAllListeners() or similar.
        await server.stop();
        server = null;
    }
    world = null;
    localPlayer = null;
    currentPlayers = new Map(); // Clear the current players list
    console.log("Server stopped and resources cleaned up.");
}

/**
 * @param {any} event
 * @param {number} port
 */
ipcMain.handle("start-server", async (event, port) => {
    // If a server is already running, stop it before starting a new one.
    if (server) {
        await stopServerLogic();
    }

    try {
        server = new Server({ port, disableEncryption: true});


        server.once(ServerEvent.Open, () => {
            console.log(`Server is open on port ${port}`);
            mainWindow?.webContents.send("serverOpen", { port });
        })
        server.once(ServerEvent.WorldAdd, async (ev) => {
            world = ev.world;
            console.log(`world initialized: ${world.name}`);
            localPlayer = await world.getLocalPlayer();
            await sendJSON({
                type: "worldConnected",
                localPlayerName: localPlayer.name
            })
            setTimeout(() => {
                mainWindow?.webContents.send("worldConnected");
                sendJSON({
                    type: "worldConnected"
                })
            }, 500)
        });
        server.on(ServerEvent.PlayerJoin, ev => {
            if (ev.world !== world) return;
            mainWindow?.webContents.send("playerJoin", { playerName: ev.player.name });
        });

        server.on(ServerEvent.PlayerLeave, ev => {
            if (ev.world !== world) return;
            mainWindow?.webContents.send("playerLeave", { playerName: ev.player.name });
        });

        tickInterval = setInterval(async () => {
            try {
                if (!localPlayer) return;
                mainWindow?.webContents.send("tick");

                const players = new Map();
                const tags = await localPlayer.getTags();
                for (const tag of tags || []) {
                    if (tag.startsWith("vc_")) {
                        // Use a try-catch here to prevent a single malformed tag from crashing the loop
                        try {
                            const data = JSON.parse(tag.substring(3));
                            if (data.type === "playerData") {
                                players.set(data.name, data);
                            }
                        } catch (e) {
                            console.error(`Failed to parse player data tag: ${tag}`, e);
                        }
                    }
                }
                currentPlayers = players;
            } catch (e) {
                console.error("Error during server tick:", e);
            }
        }, 50);

        return { status: 'success', message: `Server started on port ${port}` };
    } catch (e) {
        console.error("Failed to start server:", e);
        await stopServerLogic(); // Ensure cleanup on failed start
        return { status: 'error', message: e.message };
    }
});

ipcMain.handle("stop-server", async () => {
    await stopServerLogic();
    return { status: 'success', message: 'Server stopped.' };
});

ipcMain.handle("requestPlayerData", () => {
    return currentPlayers;
});

/**
 * @param {any} event
 * @param {string} message
 * @param {string} [playerName]
 */
ipcMain.handle("sendMessage", async (event, message, playerName) => {
    if (!world) {
        console.warn("Cannot send message, world is not initialized.");
        return;
    }

    if (!playerName) {
        world.sendMessage(message);
        return;
    }

    const players = await world.getPlayers();
    const targetPlayer = players.find(p => p.name === playerName);
    if (targetPlayer) {
        await targetPlayer.sendMessage(message);
    } else {
        console.warn(`Cannot send message, player not found: ${playerName}`);
    }
});

ipcMain.handle("get-local-player-name", async () => {
    if (!localPlayer) {
        console.warn("Local player is not initialized.");
        return '';
    }
    return localPlayer.name;
});

ipcMain.handle("notifyCode", async (event, playerName, roomCode, playerCode) => {
    if (!world) {
        console.warn("Cannot notify code, world is not initialized.");
        return;
    }
    console.log(`${playerName} -> ${roomCode} (${playerCode})`)
    sendJSON({
        type: "notifyCode",
        name: playerName,
        roomCode,
        playerCode
    })
})

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        world = null; // Clear the world reference
        server = null; // Clear the server reference
        if (tickInterval) {
            clearInterval(tickInterval);
            tickInterval = null;
        }
        mainWindow = null; // Clear the main window reference
        localPlayer = null; // Clear the local player reference
        currentPlayers = new Map(); // Clear the current players list
        app.quit();

    }
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});


