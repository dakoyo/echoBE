import type { Player as PlayerData } from '../App.js';

/**
 * Represents a player in the chat room with mutable state.
 */
export class Player {
    public readonly id: number;
    public readonly name: string;
    public readonly isOwner: boolean;
    private _isMuted: boolean;
    private _isOnline: boolean;
    private _volume: number;

    constructor(data: PlayerData) {
        this.id = data.id;
        this.name = data.name;
        this.isOwner = data.isOwner;
        this._isMuted = data.isMuted;
        this._isOnline = data.isOnline;
        this._volume = data.volume;
    }

    /** The player's mute status. This is read-only from outside. */
    get isMuted(): boolean {
        return this._isMuted;
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
    }
    
    /**
     * Updates the player's mute status.
     * @param muted The new mute status.
     */
    public setMuteStatus(muted: boolean): void {
        this._isMuted = muted;
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
            isOnline: this._isOnline,
            volume: this._volume,
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