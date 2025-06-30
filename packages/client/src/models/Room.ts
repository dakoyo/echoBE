import { Player } from './Player.js';
import type { PlayerData } from '../App.js';

/**
 * Manages the state of the chat room, including all players.
 */
export class Room {
    private players: Map<number, Player>;
    public playersBySignalingId: Map<string, Player> = new Map();
    public readonly currentUser: Player;

    constructor(currentUser: Player, otherPlayersData: PlayerData[]) {
        this.currentUser = currentUser;
        this.players = new Map();

        this.players.set(currentUser.id, currentUser);
        if (currentUser.signalingId) {
            this.playersBySignalingId.set(currentUser.signalingId, currentUser);
        }
        
        otherPlayersData.forEach(pData => {
            const player = new Player(pData);
            this.players.set(player.id, player);
            if (player.signalingId) {
                this.playersBySignalingId.set(player.signalingId, player);
            }
        });
    }

    get allPlayers(): Player[] {
        return Array.from(this.players.values());
    }

    get otherPlayers(): Player[] {
        const playersList = this.allPlayers.filter(p => p.id !== this.currentUser.id);
        
        playersList.sort((a, b) => {
          if (a.isOnline && !b.isOnline) return -1;
          if (!a.isOnline && b.isOnline) return 1;
          if (a.isOwner) return -1;
          if (b.isOwner) return 1;
          const nameCompare = a.name.localeCompare(b.name);
          if (nameCompare !== 0) return nameCompare;
          return a.id - b.id;
        });

        return playersList;
    }
    
    public getPlayerBySignalingId(id: string): Player | undefined {
        return this.playersBySignalingId.get(id);
    }
    
    public updatePlayerByAuth(clientId: string, playerName: string): Room {
        const newRoom = this.clone();
        // Find player by name, since that's what we know from Minecraft world state
        const playerToUpdate = newRoom.allPlayers.find(p => p.name === playerName);
        
        if (playerToUpdate) {
            playerToUpdate.signalingId = clientId;
            playerToUpdate.setOnlineStatus(true); // Now they are fully online
            newRoom.playersBySignalingId.set(clientId, playerToUpdate);
        }
        
        return newRoom;
    }

    public addPlayer(playerData: PlayerData): Room {
        const newRoom = this.clone();
        if (!Array.from(newRoom.players.values()).some(p => p.signalingId === playerData.signalingId)) {
            const newPlayer = new Player(playerData);
            newRoom.players.set(newPlayer.id, newPlayer);
            if (newPlayer.signalingId) {
                newRoom.playersBySignalingId.set(newPlayer.signalingId, newPlayer);
            }
        }
        return newRoom;
    }

    public addPlayers(playersData: PlayerData[]): Room {
        const newRoom = this.clone();
        playersData.forEach(playerData => {
            if (!Array.from(newRoom.players.values()).some(p => p.signalingId === playerData.signalingId)) {
                const newPlayer = new Player(playerData);
                newRoom.players.set(newPlayer.id, newPlayer);
                if (newPlayer.signalingId) {
                    newRoom.playersBySignalingId.set(newPlayer.signalingId, newPlayer);
                }
            }
        });
        return newRoom;
    }

    public setPlayerOnlineStatus(clientId: string, isOnline: boolean): Room {
        const newRoom = this.clone();
        const player = newRoom.getPlayerBySignalingId(clientId);
        if (player) {
            player.setOnlineStatus(isOnline);
        }
        return newRoom;
    }

    public updatePlayerStatus(clientId: string, isMuted: boolean, isDeafened: boolean): Room {
        const newRoom = this.clone();
        const player = newRoom.getPlayerBySignalingId(clientId);
        if (player) {
            player.setMuteStatus(isMuted);
            player.setDeafenStatus(isDeafened);
        }
        return newRoom;
    }
    
    public addStreamToPlayer(clientId: string, stream: MediaStream): Room {
        const newRoom = this.clone();
        const player = newRoom.getPlayerBySignalingId(clientId);
        if (player) {
            player.stream = stream;
        }
        return newRoom;
    }

    public removeStreamFromPlayer(clientId: string): Room {
        const newRoom = this.clone();
        const player = newRoom.getPlayerBySignalingId(clientId);
        if (player) {
            player.stream = undefined;
            player.setOnlineStatus(false);
        }
        return newRoom;
    }

    public clone(): Room {
        const allPlayersData = this.allPlayers.map(p => p.toData());
        const currentUserData = allPlayersData.find(p => p.id === this.currentUser.id)!;
        const otherPlayersData = allPlayersData.filter(p => p.id !== this.currentUser.id);
        return new Room(new Player(currentUserData), otherPlayersData);
    }
}