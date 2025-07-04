const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    isElectron: true,
    /**
     * @param {number} port
     * @returns {Promise<any>}
     */
    startServer: async (port) => {
        return await ipcRenderer.invoke("start-server", port);
    },
    /**
     * @returns {Promise<any>}
     */
    stopServer: async () => {
        return await ipcRenderer.invoke("stop-server");
    },
    /**
     * @param {function({playerName: string}): void} callback
     */
    onPlayerJoin: (callback) => {
        ipcRenderer.on("playerJoin", (event, playerName) => {
            callback({ playerName });
        });
    },

    /**
     * @returns {Promise<string>}
     */
    getLocalPlayerName: async () => {
        return await ipcRenderer.invoke("get-local-player-name");
    },
    /**
     * @param {function({playerName: string}): void} callback
     */
    onPlayerLeave: (callback) => {
        ipcRenderer.on("playerLeave", (event, playerName) => {
            callback({ playerName });
        });
    },
    /**
     * @param {function(): void} callback
     */
    onTick: (callback) => {
        ipcRenderer.on("tick", () => {
            callback();
        });
    },
    /**
     * @param {function(): void} callback
     */
    onWorldConnected: (callback) => {
        ipcRenderer.on("worldConnected", () => {
            callback();
        });
    },
    /**
     * @param {function({playerName: string}): void} callback
     */
    onCodeRequest: (callback) => {
        ipcRenderer.on("codeRequest", (event, playerName) => {
            callback({ playerName });
        });
    },
    /**
     * @returns {Promise<any[]>}
     */
    requestPlayerData: () => {
        return ipcRenderer.invoke("requestPlayerData");
    },
    /**
     * @param {string} message
     * @param {string} playerName
     */
    sendMessage(message, playerName) {
        ipcRenderer.invoke("sendMessage", message, playerName);
    }
});