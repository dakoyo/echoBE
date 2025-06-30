

import type { PlayerData } from '../App.js';

/**
 * Represents a player in the chat room with mutable state.
 */
export class Player {
    public readonly id: number;
    public readonly name: string;
    public readonly isOwner: boolean;
    private _isMuted: boolean;
    private _isDeafened: boolean;
    private _isOnline: boolean;
    private _volume: number;

    // Signaling properties
    public signalingId?: string;
    public playerCode?: string;
    public stream?: MediaStream;


    constructor(data: PlayerData) {
        this.id = data.id;
        this.name = data.name;
        this.isOwner = data.isOwner;
        this._isMuted = data.isMuted;
        this._isDeafened = data.isDeafened;
        this._isOnline = data.isOnline;
        this._volume = data.volume;
        this.signalingId = data.signalingId;
        this.playerCode = data.playerCode;
        this.stream = data.stream;
    }

    /** The player's mute status. This is read-only from outside. */
    get isMuted(): boolean {
        return this._isMuted;
    }
    
    /** The player's deafen status. */
    get isDeafened(): boolean {
        return this._isDeafened;
    }

    /** The player's online status. */
    get isOnline(): boolean {
        return this._isOnline;
    }

    /** The player's volume setting. */
    get volume(): number {
        return this._volume;
    }

    /**
     * Updates the player's volume.
     * @param volume The new volume level (0-150).
     */
    public setVolume(volume: number): void {
        this._volume = Math.max(0, Math.min(150, volume));
    }
    
    /**
     * Updates the player's online status.
     * @param online The new online status.
     */
    public setOnlineStatus(online: boolean): void {
        this._isOnline = online;
        if (!online) {
            this.stream = undefined;
        }
    }
    
    /**
     * Updates the player's mute status.
     * @param muted The new mute status.
     */
    public setMuteStatus(muted: boolean): void {
        this._isMuted = muted;
    }

    /**
     * Updates the player's deafen status.
     * @param deafened The new deafen status.
     */
    public setDeafenStatus(deafened: boolean): void {
        this._isDeafened = deafened;
    }


    /**
     * Creates a data object from the current instance state.
     * @returns A plain PlayerData object.
     */
    public toData(): PlayerData {
        return {
            id: this.id,
            name: this.name,
            isOwner: this.isOwner,
            isMuted: this._isMuted,
            isDeafened: this._isDeafened,
            isOnline: this._isOnline,
            volume: this._volume,
            signalingId: this.signalingId,
            playerCode: this.playerCode,
            stream: this.stream,
        };
    }
    
    /**
     * Creates a new Player instance with the same data.
     * @returns A new Player instance.
     */
    public clone(): Player {
        return new Player(this.toData());
    }
}
