/**
 * Socket.IO server.
 *
 * The browser connects here (authenticated via JWT query param).
 * This server proxies inspection state updates from the Python CV service
 * to the connected browser client in real time.
 *
 * Topology:
 *   Browser ←→ Socket.IO (Node) ←→ WebSocket (Python FastAPI)
 */
import http from 'http';
import { Server, Socket } from 'socket.io';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { Inspection } from '../models/Inspection';

export function createSocketServer(httpServer: http.Server): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.CORS_ORIGINS,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 5 * 1024 * 1024, // 5 MB for frame chunks
  });

  // ── Auth middleware ───────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth.token ?? socket.handshake.query.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = jwt.verify(String(token), config.JWT_SECRET) as {
        userId: string;
        email: string;
        role: string;
      };
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    logger.info('socket.connected', { socketId: socket.id, userId: user.userId });

    let cvWs: WebSocket | null = null;
    let intentionalClose = false;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;

    // Reconnects automatically if the internal cv-service link drops
    // unexpectedly (e.g. an idle connection reaped by Docker's network
    // layer) — the phone's video_frame emits alone are not enough traffic
    // to reliably keep it alive over a slow/flaky mobile connection.
    function connectToCv(sessionId: string, inspectionId: string) {
      const cvUrl = `${config.CV_WS_URL}/ws/inspect?session_id=${sessionId}&inspector_id=${user.userId}`;
      logger.info('socket.cv_connect', { cvUrl, sessionId, attempt: reconnectAttempts });

      const ws = new WebSocket(cvUrl);
      cvWs = ws;

      ws.on('open', () => {
        reconnectAttempts = 0;
        logger.info('socket.cv_connected', { sessionId });
        socket.emit('inspection_ready', { sessionId });
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          socket.emit('state_update', msg);

          // Persist on completion
          if (msg.type === 'inspection_complete') {
            _persistCompletion(inspectionId, msg.data).catch((e) =>
              logger.error('socket.persist_error', { error: e }),
            );
          }
        } catch (e) {
          logger.warn('socket.cv_parse_error', { error: String(e) });
        }
      });

      ws.on('error', (err) => {
        logger.error('socket.cv_error', { error: err.message });
        socket.emit('cv_error', { message: err.message });
      });

      ws.on('close', () => {
        logger.info('socket.cv_disconnected', { sessionId, intentional: intentionalClose });
        socket.emit('cv_disconnected');
        if (cvWs === ws) cvWs = null;

        if (!intentionalClose && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts += 1;
          setTimeout(() => {
            if (!intentionalClose) connectToCv(sessionId, inspectionId);
          }, 1000);
        }
      });
    }

    // ── Client → Server: start_inspection ──────────────────────────────
    socket.on(
      'start_inspection',
      async (payload: { inspectionId: string; sessionId: string }) => {
        intentionalClose = false;
        reconnectAttempts = 0;
        connectToCv(payload.sessionId, payload.inspectionId);
      },
    );

    // ── Client → Server: video_frame (binary JPEG data) ────────────────
    socket.on('video_frame', (frameData: Buffer) => {
      if (cvWs && cvWs.readyState === WebSocket.OPEN) {
        cvWs.send(frameData);
      }
    });

    // ── Client → Server: stop_inspection ───────────────────────────────
    socket.on('stop_inspection', () => {
      logger.info('socket.stop_inspection', { socketId: socket.id });
      intentionalClose = true;
      cvWs?.close();
      cvWs = null;
    });

    socket.on('disconnect', (reason) => {
      logger.info('socket.disconnected', { socketId: socket.id, reason });
      intentionalClose = true;
      cvWs?.close();
      cvWs = null;
    });
  });

  return io;
}

// ------------------------------------------------------------------
// Persist completed inspection data to MongoDB
// ------------------------------------------------------------------
async function _persistCompletion(
  inspectionId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await Inspection.findOneAndUpdate(
    { inspectionId },
    {
      $set: {
        manufacturer: data.manufacturer,
        aedModel: data.model,
        serialNumber: data.serial_number,
        padsExpiry: data.pads_expiry,
        batteryExpiry: data.battery_expiry,
        statusIndicator: data.status_indicator,
        statusConfidence: data.status_confidence,
        inspectionResult: data.inspection_result ?? 'REVIEW',
        inspectionStatus: 'complete',
        completedAt: new Date(),
        durationSeconds: data.duration_seconds,
        cvSessionData: data,
      },
    },
    { new: true },
  );
}
