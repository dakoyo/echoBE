interface PlayerLocation {
    x: number;
    y: number;
    z: number;
}

interface PlayerRotation {
    x: number;
    y: number;
}

interface PlayerData {
    type: "playerData";
    name: string;
    location: PlayerLocation;
    rotation: PlayerRotation;
    isSpectator: boolean;
}

type TagData = PlayerData;

declare global {
    interface Window {
        electronAPI: {
            isElectron: boolean;
            startServer: (port: number) => Promise<unknown>;
            stopServer: () => Promise<unknown>;
            onPlayerJoin: (callback: (ev: { playerName: string }) => void) => void;
            onPlayerLeave: (callback: (ev: { playerName: string }) => void) => void;
            onTick: (callback: () => void) => void;
            onWorldConnected: (callback: () => void) => void;
            getLocalPlayerName: () => Promise<string>;
            onCodeRequest: (callback: (ev: { playerName: string }) => void) => void;
            requestPlayerData: () => Promise<[string, PlayerData][]>; // Returns a promise that resolves to an array of tuples [playerName, PlayerData]
            sendMessage: (message: string, playerName?: string) => Promise<void>;
        };
    }
}

export {};