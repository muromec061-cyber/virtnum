import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { verifyAccessToken } from '../utils/jwt';
import { logger } from '../utils/logger';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive: boolean;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();

  initialize(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
      ws.isAlive = true;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'auth') {
            const payload = verifyAccessToken(message.token);
            if (payload) {
              ws.userId = payload.userId;
              if (!this.clients.has(payload.userId)) {
                this.clients.set(payload.userId, new Set());
              }
              this.clients.get(payload.userId)!.add(ws);
              ws.send(JSON.stringify({ type: 'auth_success', userId: payload.userId }));
              logger.debug(`WebSocket authenticated: ${payload.userId}`);
            } else {
              ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }));
              ws.close();
            }
          }

          if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (err) {
          logger.error('WebSocket message error:', err);
        }
      });

      ws.on('close', () => {
        if (ws.userId) {
          const userClients = this.clients.get(ws.userId);
          if (userClients) {
            userClients.delete(ws);
            if (userClients.size === 0) {
              this.clients.delete(ws.userId);
            }
          }
        }
      });

      ws.on('error', (err) => {
        logger.error('WebSocket error:', err);
      });
    });

    const interval = setInterval(() => {
      if (!this.wss) return;
      this.wss.clients.forEach((ws: WebSocket) => {
        const client = ws as AuthenticatedWebSocket;
        if (!client.isAlive) {
          return client.terminate();
        }
        client.isAlive = false;
        client.ping();
      });
    }, 30000);

    this.wss.on('close', () => clearInterval(interval));
    logger.info('WebSocket server initialized');
  }

  private sendToUser(userId: string, data: object) {
    const userClients = this.clients.get(userId);
    if (!userClients) return;

    const message = JSON.stringify(data);
    userClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  broadcast(data: object) {
    if (!this.wss) return;
    const message = JSON.stringify(data);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  broadcastSmsReceived(sms: any, numberId: string, userId?: string) {
    const payload = { type: 'sms_received', sms, numberId };
    if (userId) {
      this.sendToUser(userId, payload);
    }
    this.broadcast({ type: 'sms_count_update', numberId });
  }

  broadcastOrderUpdate(order: any) {
    this.sendToUser(order.userId, { type: 'order_update', order });
    this.broadcast({ type: 'number_status_update', numberId: order.numberId });
  }

  broadcastNumberUpdate(number: any) {
    this.broadcast({ type: 'number_update', number });
  }

  getConnectedCount(): number {
    return this.clients.size;
  }
}

export const wsManager = new WebSocketManager();
