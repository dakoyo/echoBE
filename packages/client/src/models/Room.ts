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
        
        const playerExists = Array.from(newRoom.players.values()).some(p => {
            // A player is considered the same if they have the same name
            if (p.name === playerData.name) {
                return true;
            }
            // Or if they have the same, defined, signalingId
            if (playerData.signalingId && p.signalingId === playerData.signalingId) {
                return true;
            }
            return false;
        });

        if (!playerExists) {
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

    public removePlayerByName(playerName: string): Room {
        const newRoom = this.clone();
        let playerToRemove: Player | undefined;
        
        for (const player of newRoom.players.values()) {
            if (player.name === playerName) {
                playerToRemove = player;
                break;
            }
        }
        
        if (playerToRemove) {
            newRoom.players.delete(playerToRemove.id);
            if (playerToRemove.signalingId) {
                newRoom.playersBySignalingId.delete(playerToRemove.signalingId);
            }
        }
        
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

    public syncPlayers(playersInfo: { id: string; name: string }[], ownerId: string): Room {
        const newRoom = this.clone();

        playersInfo.forEach(pInfo => {
            let player = newRoom.getPlayerBySignalingId(pInfo.id);
            
            if (player) {
                // Player exists, only update if name is different (for placeholder owner)
                if (player.name !== pInfo.name) {
                    const newPlayerData = player.toData();
                    newPlayerData.name = pInfo.name;
                    const updatedPlayer = new Player(newPlayerData);
                    
                    newRoom.players.set(player.id, updatedPlayer);
                    if (player.signalingId) {
                        newRoom.playersBySignalingId.set(player.signalingId, updatedPlayer);
                    }
                }
            } else if (pInfo.id !== this.currentUser.signalingId) { // Don't re-add current user
                // New player, add them
                const newPlayer = new Player({
                    id: Math.random(),
                    name: pInfo.name,
                    isMuted: false, isDeafened: false,
                    isOwner: pInfo.id === ownerId,
                    volume: 100, isOnline: true,
                    signalingId: pInfo.id,
                });
                newRoom.players.set(newPlayer.id, newPlayer);
                if (newPlayer.signalingId) {
                    newRoom.playersBySignalingId.set(newPlayer.signalingId!, newPlayer);
                }
            }
        });

        return newRoom;
    }
}