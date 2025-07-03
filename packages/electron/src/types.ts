export interface PlayerLocation {
    x: number;
    y: number;
    z: number;
}

export interface PlayerRotation {
    x: number;
    y: number;
}

export interface PlayerData {
    type: "playerData";
    name: string;
    location: PlayerLocation;
    rotation: PlayerRotation;
    isSpectator: boolean;
}

export type TagData = PlayerData;