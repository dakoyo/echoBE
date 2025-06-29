import { Player } from './Player.js';
import type { Player as PlayerData } from '../App.js';

/**
 * Manages the state of the chat room, including all players.
 */
export class Room {
    private players: Map<number, Player>;
    public readonly currentUser: Player;

    constructor(currentUser: Player, otherPlayersData: PlayerData[]) {
        this.currentUser = currentUser;
        this.players = new Map();

        // Add current user to the map first
        this.players.set(currentUser.id, currentUser);
        
        // Add other players
        otherPlayersData.forEach(pData => {
            // Ensure we don't re-add the current user or other duplicates
            if (!this.players.has(pData.id)) {
                this.players.set(pData.id, new Player(pData));
            }
        });
    }

    /**
     * Returns a sorted list of all players in the room, excluding the current user.
     * Online players are listed first.
     */
    get otherPlayers(): Player[] {
        const playersList = Array.from(this.players.values())
                                .filter(p => p.id !== this.currentUser.id);
        
        playersList.sort((a, b) => {
          // Primary sort: online players first
          if (a.isOnline && !b.isOnline) {
            return -1; // a (online) comes before b (offline)
          }
          if (!a.isOnline && b.isOnline) {
            return 1; // b (online) comes before a (offline)
          }

          // Secondary sort: by name, for players with the same online status
          const nameCompare = a.name.localeCompare(b.name);
          if (nameCompare !== 0) {
            return nameCompare;
          }

          // Tertiary sort (fallback): by ID, to guarantee stability
          return a.id - b.id;
        });

        return playersList;
    }
    
    /**
     * The number of other players who are currently online.
     */
    get onlinePlayerCount(): number {
        return this.otherPlayers.filter(p => p.isOnline).length;
    }
    
    /**
     * Retrieves a specific player by their ID.
     * @param id The ID of the player to find.
     * @returns The Player instance or undefined if not found.
     */
    public getPlayer(id: number): Player | undefined {
        return this.players.get(id);
    }

    /**
     * Creates a new Room instance without the specified player.
     * @param playerToKick The player instance to remove from the room.
     * @returns A new Room instance.
     */
    public kickPlayer(playerToKick: Player): Room {
        const newPlayersData = Array.from(this.players.values())
            .filter(p => p.id !== playerToKick.id && p.id !== this.currentUser.id)
            .map(p => p.toData());
        
        return new Room(this.currentUser.clone(), newPlayersData);
    }

    /**
     * Creates a new Room instance with the same data, allowing React to detect a state change.
     * @returns A new Room instance.
     */
    public clone(): Room {
        const otherPlayersData = this.otherPlayers.map(p => p.toData());
        return new Room(this.currentUser.clone(), otherPlayersData);
    }
}