// K6 WebSocket Load Test
// Run with: k6 run tests/load/websocket-load-test.js

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const messagesSent = new Counter('messages_sent');
const messagesReceived = new Counter('messages_received');
const connectionErrors = new Counter('connection_errors');
const messageLatency = new Trend('message_latency');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 100 },   // Ramp up to 100 users
    { duration: '1m', target: 100 },    // Stay at 100 users
    { duration: '30s', target: 500 },   // Ramp up to 500 users
    { duration: '2m', target: 500 },    // Stay at 500 users
    { duration: '30s', target: 1000 },  // Ramp up to 1000 users
    { duration: '2m', target: 1000 },   // Stay at 1000 users
    { duration: '30s', target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    'ws_connecting': ['p(95)<1000'],      // 95% of connections under 1s
    'ws_msgs_received': ['count>10000'],  // Receive at least 10k messages
    'message_latency': ['p(95)<200'],     // 95% of messages under 200ms
    'connection_errors': ['count<10'],    // Less than 10 connection errors
  },
};

// Demo JWT token (replace with actual token generation in production)
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXItZGVtby0xMjMiLCJ1c2VybmFtZSI6ImRlbW9fdXNlciIsImVtYWlsIjoiZGVtb0BleGFtcGxlLmNvbSJ9';

const WS_URL = __ENV.WS_URL || 'ws://localhost:3000';
const ROOM_ID = 'test-room-123';

export default function () {
  const userId = `user-${__VU}-${__ITER}`;
  const url = `${WS_URL}/socket.io/?EIO=4&transport=websocket`;

  const params = {
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`
    },
    tags: { userId },
  };

  const response = ws.connect(url, params, function (socket) {
    socket.on('open', () => {
      console.log(`User ${userId} connected`);

      // Send Socket.IO handshake
      socket.send('40');

      // Join room
      setTimeout(() => {
        const joinMessage = `42["room:join",{"roomId":"${ROOM_ID}"}]`;
        socket.send(joinMessage);
      }, 100);

      // Send messages periodically
      socket.setInterval(() => {
        const timestamp = Date.now();
        const message = `42["message:send",{"roomId":"${ROOM_ID}","text":"Test message from ${userId}","timestamp":${timestamp}}]`;

        socket.send(message);
        messagesSent.add(1);
      }, 5000); // Send a message every 5 seconds

      // Random typing indicators
      socket.setInterval(() => {
        const typingMessage = `42["typing:start","${ROOM_ID}"]`;
        socket.send(typingMessage);

        socket.setTimeout(() => {
          const stopTypingMessage = `42["typing:stop","${ROOM_ID}"]`;
          socket.send(stopTypingMessage);
        }, 2000);
      }, 10000);
    });

    socket.on('message', (data) => {
      messagesReceived.add(1);

      // Parse Socket.IO message format
      if (data.startsWith('42')) {
        try {
          const jsonData = data.substring(2);
          const [event, payload] = JSON.parse(jsonData);

          // Calculate latency for own messages
          if (event === 'message:new' && payload.userId === userId) {
            const latency = Date.now() - payload.timestamp;
            messageLatency.add(latency);
          }
        } catch (error) {
          // Ignore parse errors
        }
      }
    });

    socket.on('error', (e) => {
      if (e.error() != 'websocket: close sent') {
        console.log(`User ${userId} error:`, e.error());
        connectionErrors.add(1);
      }
    });

    socket.on('close', () => {
      console.log(`User ${userId} disconnected`);
    });

    // Keep connection alive for 30 seconds
    socket.setTimeout(function () {
      console.log(`User ${userId} closing connection after timeout`);
      socket.close();
    }, 30000);
  });

  check(response, {
    'status is 101': (r) => r && r.status === 101,
  });

  sleep(1);
}

// Summary handler
export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors !== false;

  let summary = '\n';
  summary += `${indent}Test Duration: ${data.state.testRunDurationMs / 1000}s\n`;
  summary += `${indent}Virtual Users: ${data.metrics.vus?.values?.max || 0}\n`;
  summary += `${indent}Messages Sent: ${data.metrics.messages_sent?.values?.count || 0}\n`;
  summary += `${indent}Messages Received: ${data.metrics.messages_received?.values?.count || 0}\n`;
  summary += `${indent}Connection Errors: ${data.metrics.connection_errors?.values?.count || 0}\n`;

  if (data.metrics.message_latency) {
    summary += `${indent}Message Latency (p95): ${data.metrics.message_latency.values['p(95)']?.toFixed(2)}ms\n`;
    summary += `${indent}Message Latency (avg): ${data.metrics.message_latency.values.avg?.toFixed(2)}ms\n`;
  }

  return summary;
}
