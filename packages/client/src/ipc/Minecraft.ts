// Electronのコンテキストブリッジで使う。ダミー。オーナーしか使用ができない

import { EventEmitter } from "events";

// プレイヤー位置の型定義
interface PlayerLocation {
  x: number;
  y: number;
  z: number;
}

// プレイヤー回転の型定義
interface PlayerRotation {
  x: number;
  y: number;
}

// プレイヤーデータの型定義
interface PlayerData {
  name: string;
  location: PlayerLocation;
  rotation: PlayerRotation;
}

// イベント定義
interface WorldEvents {
  playersJoin: (players: string[]) => void; // プレイヤーがマインクラフトに入った時に発火する
  playersLeave: (players: string[]) => void; // プレイヤーがマインクラフトから出た時に発火する
  tick: () => void; // マインクラフト内の1tick（0.05秒）ごとに発火する
  worldConnected: () => void; // /connect localhost:3000などのコマンドがマインクラフト内で入力され、webSocket接続が確立された時に発火する
}

class WorldEventEmitter extends EventEmitter {
  on<K extends keyof WorldEvents>(eventName: K, listener: WorldEvents[K]): this {
    return super.on(eventName, listener);
  }

  emit<K extends keyof WorldEvents>(eventName: K, ...args: Parameters<WorldEvents[K]>): boolean {
    return super.emit(eventName, ...args);
  }
}

class World {
  private players: Map<string, PlayerData> = new Map([
    ["Owner", { name: "Owner", location: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0 } }],
    ["Steve", { name: "Steve", location: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0 } }],
    ["Alex", { name: "Alex", location: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0 } }],
  ]);

  async getOwnerName(): Promise<string> {
    return "Owner"
  }

  getPlayerNames(): string[] {
    return Array.from(this.players.keys());
  }

  getPlayerLocation(playerName: string): PlayerLocation {
    return this.players.get(playerName)?.location || { x: 0, y: 0, z: 0 };
  }

  getPlayerRotation(playerName: string): PlayerRotation {
    return this.players.get(playerName)?.rotation || { x: 0, y: 0 };
  }
  /**
   * マインクラフトのテキストチャット内にメッセージを書き込む
   * @param message - 送信するメッセージ内容
   * @param playerName - 送信するプレイヤーの名前（undefinedならワールド全体に送信される）
   */
  sendMessage(message: string, playerName?: string) {
    console.log(message); //テスト用にコンソールに出力
  }

  // プレイヤーデータを追加するメソッド（ダミー実装用）
  addPlayer(name: string, location?: PlayerLocation, rotation?: PlayerRotation): void {
    this.players.set(name, {
      name,
      location: location || { x: 0, y: 0, z: 0 },
      rotation: rotation || { x: 0, y: 0 }
    });
  }

  events = new WorldEventEmitter();
}

export const world = new World();