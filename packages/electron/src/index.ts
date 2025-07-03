import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import isDev from 'electron-is-dev'
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Player, Server, ServerEvent, World } from 'socket-be';
import { PlayerData, TagData } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let world: World | null = null;
let server: Server | null = null;
let mainWindow: BrowserWindow | null = null;
let tickInterval: NodeJS.Timeout | null = null;
let localPlayer: Player | null = null;
let currentPlayers: [string, PlayerData][] = [];

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
    currentPlayers = [];
    console.log("Server stopped and resources cleaned up.");
}

ipcMain.handle("start-server", async (event, port: number) => {
    // If a server is already running, stop it before starting a new one.
    if (server) {
        await stopServerLogic();
    }

    try {
        server = new Server({ port });

        server.once(ServerEvent.WorldAdd, async (ev) => {
            world = ev.world;
            localPlayer = await world.getLocalPlayer();
            mainWindow?.webContents.send("worldConnected");
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

                const players: [string, PlayerData][] = [];
                const tags = await localPlayer.getTags();
                for (const tag of tags || []) {
                    if (tag.startsWith("vc_")) {
                        // Use a try-catch here to prevent a single malformed tag from crashing the loop
                        try {
                            const data = JSON.parse(tag.substring(3)) as TagData;
                            if (data.type === "playerData") {
                                players.push([data.name, data]);
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
        return { status: 'error', message: (e as Error).message };
    }
});

ipcMain.handle("stop-server", async () => {
    await stopServerLogic();
    return { status: 'success', message: 'Server stopped.' };
});

ipcMain.handle("requestPlayerData", () => {
    return currentPlayers;
});

ipcMain.handle("sendMessage", async (event, message: string, playerName?: string) => {
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
        currentPlayers = []; // Clear the current players list
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


