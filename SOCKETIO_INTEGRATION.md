# Socket.IO Integration with ElizaOS

This document describes how to connect a custom frontend to ElizaOS agents using Socket.IO.

## Key Discoveries

### Message Format Requirements

ElizaOS expects specific field names in the Socket.IO message payload:

```javascript
const messagePayload = {
  message: "Your message here",     // Required: The actual message content
  text: "Your message here",        // Optional: For compatibility
  channelId: "channel-id",          // Required: Channel identifier
  roomId: "channel-id",             // Required: Same as channelId
  serverId: "00000000-0000-0000-0000-000000000000",  // Required: Default server ID
  server_id: "00000000-0000-0000-0000-000000000000", // Alternative field name
  senderId: "user-id",              // Required: User identifier
  author_id: "user-id",             // Alternative field name
  source: 'client_chat',            // Required: Message source
  clientMessageId: "uuid",          // Optional: Client-side message ID
  senderName: 'user'                // Optional: Display name
};
```

### Connection Flow

1. **Connect to Socket.IO server**
   ```javascript
   const socket = io('http://localhost:3000', {
     transports: ['websocket', 'polling'],
     reconnection: true,
   });
   ```

2. **Join a channel** (ROOM_JOINING event - type 1)
   ```javascript
   socket.emit('1', {
     channelId: channelId,
     agentId: agentId,
   });
   ```

3. **Send messages** (SEND_MESSAGE event - type 2)
   ```javascript
   socket.emit('2', messagePayload);
   ```

4. **Listen for responses** (messageBroadcast event)
   ```javascript
   socket.on('messageBroadcast', (data) => {
     if (data.senderId === agentId && data.source === 'agent_response') {
       // Handle agent response
     }
   });
   ```

### Important Notes

- ElizaOS uses numeric event types: 1 (ROOM_JOINING), 2 (SEND_MESSAGE), 3 (MESSAGE), etc.
- The `message` field is required for sending, but responses come back with `text`
- Use a persistent channel ID for consistent conversation history
- Both `serverId`/`server_id` and `senderId`/`author_id` formats should be included for compatibility
- The default server ID is always `00000000-0000-0000-0000-000000000000`

### Frontend Implementation

See `apps/web/src/components/Chat/simple-chat.tsx` for a working implementation.