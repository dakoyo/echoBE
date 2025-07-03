import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
    isElectron: true,
    startServer: async (port: number) => {
        return await ipcRenderer.invoke("start-server", port);
    },
    stopServer: async () => {
        return await ipcRenderer.invoke("stop-server");
    },
    onPlayerJoin: (callback: (ev: { playerName: string }) => void) => {
        ipcRenderer.on("playerJoin", (event, playerName) => {
            callback({ playerName });
        });
    },
    onPlayerLeave: (callback: (ev: { playerName: string }) => void) => {
        ipcRenderer.on("playerLeave", (event, playerName) => {
            callback({ playerName });
        });
    },
    onTick: (callback: () => void) => {
        ipcRenderer.on("tick", () => {
            callback();
        });
    },
    onWorldConnected: (callback: () => void) => {
        ipcRenderer.on("worldConnected", () => {
            callback();
        });
    },
    onCodeRequest: (callback: (ev: { playerName: string }) => void) => {
        ipcRenderer.on("codeRequest", (event, playerName) => {
            callback({ playerName });
        });
    },
    requestPlayerData: () => {
        return ipcRenderer.invoke("requestPlayerData");
    },
    sendMessage(message: string, playerName: string) {
        ipcRenderer.invoke("sendMessage", message, playerName);
    }
});