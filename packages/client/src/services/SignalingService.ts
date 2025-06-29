
import { EventEmitter } from "events";
import type { SignalingMessageIn, SignalingMessageOut } from '../types/signaling.js';

type SignalingEvents = {
    'open': () => void;
    'close': (reason: string) => void;
    'error': (error: Event) => void;
    'message': (message: SignalingMessageIn) => void;
};

export class SignalingService extends EventEmitter {
  private ws: WebSocket | null = null;

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Close any existing connection before opening a new one
      if (this.ws) {
          this.ws.onclose = null; // Prevent old onclose handlers from firing
          this.ws.close();
      }

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log("Signaling connection established.");
        this.emit('open');
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as SignalingMessageIn;
          this.emit('message', message);
        } catch (error) {
          console.error("Failed to parse signaling message:", event.data, error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("Signaling WebSocket error:", error);
        this.emit('error', error);
        reject(error);
      };

      this.ws.onclose = (event) => {
        console.log("Signaling connection closed:", event.reason);
        this.emit('close', event.reason);
        this.ws = null;
      };
    });
  }

  send(message: SignalingMessageOut) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error("Cannot send message, WebSocket is not open or doesn't exist.");
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // Type-safe 'on' and 'emit' methods
  on<K extends keyof SignalingEvents>(event: K, listener: SignalingEvents[K]): this {
    return super.on(event, listener);
  }
  
  once<K extends keyof SignalingEvents>(event: K, listener: SignalingEvents[K]): this {
    return super.once(event, listener);
  }

  emit<K extends keyof SignalingEvents>(event: K, ...args: Parameters<SignalingEvents[K]>): boolean {
    return super.emit(event, ...args);
  }
}
