# Map-Based Chat App — Implementation Plan

Real-time, location-aware chat app: **Next.js** + **Socket.IO** + **Leaflet** + **Tailwind CSS** + **Framer Motion** + **NextAuth.js (Google)** + **MongoDB**.

---

## Architecture

```mermaid
graph LR
    subgraph Client ["Browser"]
        A[Leaflet Map] --> B[User Markers]
        C[Chat Panel] --> D[Messages]
        E[Socket.IO Client] --> A & C
        F[Geolocation] --> E
        L[Login] -->|Google OAuth| M[NextAuth]
    end
    subgraph Server ["Node Server"]
        G[server.js] --> H[Socket.IO]
        G --> I[Next.js]
        H --> J[Room Manager]
        O[Middleware] -->|Protect| I
    end
    subgraph DB ["MongoDB Atlas"]
        P[(Users)] & Q[(Messages)] & R[(Locations)]
    end
    E <-->|WebSocket| H
    H --> P & Q & R
```

---

## User Review Required

> [!IMPORTANT]
> **Google OAuth credentials needed**: Create a project in [Google Cloud Console](https://console.cloud.google.com/), enable OAuth, generate **Client ID** & **Client Secret** for `.env.local`.

> [!IMPORTANT]
> **Custom server**: `server.js` means no Vercel serverless. Use VPS / Railway / Render or run locally.

---

## Core Features

| Feature | Description |
|---|---|
| **Google Login** | NextAuth.js; name & avatar from Google profile |
| **Protected Routes** | Middleware redirects unauthed users to `/login` |
| **MongoDB Persistence** | Users, messages, locations stored in Atlas; **27MB cap per room** — oldest messages auto-deleted |
| **Live Map** | Leaflet map with all connected users as markers |
| **Proximity Chat** | Auto-join chat room within 500m radius |
| **Global Chat** | Always-available channel for all users |
| **Location Broadcasting** | Real-time position updates |
| **Typing Indicators** | See who's typing nearby |
| **Online Presence** | Markers appear/disappear on connect/disconnect |

---

## Proposed Changes

### 1. Project Setup

#### [NEW] `e:\web devolopment\chat-map\`

```bash
npx -y create-next-app@latest ./  # App Router, JS, Tailwind CSS, ESLint
npm i socket.io socket.io-client leaflet react-leaflet framer-motion next-auth mongoose
```

---

### 2. Custom Server

#### [NEW] [server.js](file:///e:/web%20devolopment/chat-map/server.js)

Next.js + Socket.IO + MongoDB connection on startup.

**Socket.IO events:**

| Event | Direction | Payload |
|---|---|---|
| `user:join` | C→S | `{ username, image, lat, lng }` |
| `user:location` | C→S | `{ lat, lng }` |
| `chat:message` | C→S | `{ text, roomId }` |
| `chat:typing` | C→S | `{ roomId, isTyping }` |
| `users:update` | S→C | `[{ id, username, lat, lng, online }]` |
| `chat:message` | S→C | `{ id, username, text, timestamp, roomId }` |
| `room:joined` | S→C | `{ roomId, roomName, users }` |

**Rooms:** `global` (everyone) + proximity rooms (500m radius, auto-join/leave).

---

### 3. Authentication (NextAuth.js + Google)

#### [NEW] [.env.local](file:///e:/web%20devolopment/chat-map/.env.local)

```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_SECRET=a-random-secret-string
NEXTAUTH_URL=http://localhost:3000
MONGODB_URI=mongodb+srv://subhoxsaha_db_user:subhoxsaha_db_user@cluster0.zljybkt.mongodb.net/chat-map
```

#### [NEW] [src/app/api/auth/[...nextauth]/route.js](file:///e:/web%20devolopment/chat-map/src/app/api/auth/%5B...nextauth%5D/route.js)

Google Provider + JWT strategy. Session includes `user.id`, `user.name`, `user.image`.

#### [NEW] [src/app/login/page.js](file:///e:/web%20devolopment/chat-map/src/app/login/page.js)

Dark glassmorphism login page with animated "Sign in with Google" button.

#### [NEW] [src/components/AuthProvider.js](file:///e:/web%20devolopment/chat-map/src/components/AuthProvider.js)

`<SessionProvider>` wrapper for `layout.js`.

#### [NEW] [middleware.js](file:///e:/web%20devolopment/chat-map/middleware.js)

Protects all routes except `/login`, `/api/auth/*`, and static assets.

---

### 4. MongoDB Models (Mongoose)

#### [NEW] [src/lib/mongodb.js](file:///e:/web%20devolopment/chat-map/src/lib/mongodb.js)

Cached MongoDB connection via `MONGODB_URI`.

#### [NEW] [src/models/User.js](file:///e:/web%20devolopment/chat-map/src/models/User.js)

`{ googleId, name, email, image, lastSeen, isOnline }`

#### [NEW] [src/models/Message.js](file:///e:/web%20devolopment/chat-map/src/models/Message.js)

`{ sender→User, senderName, senderImage, text, roomId, createdAt }`

**27MB cap per room:**
- After each new message insert, a **post-save hook** checks total size of messages for that `roomId` using `aggregate` with `$bsonSize`
- If total > **27MB** (27 × 1024 × 1024 bytes), oldest messages are deleted until the room is back under 27MB
- This ensures each chat room never exceeds the storage budget while keeping the most recent conversation intact

#### [NEW] [src/models/UserLocation.js](file:///e:/web%20devolopment/chat-map/src/models/UserLocation.js)

`{ userId→User (unique), lat, lng, updatedAt }`

**Data flow:** `user:join` → upsert User + Location | `chat:message` → create Message + enforce 27MB cap | `disconnect` → set offline | page load → fetch last 50 messages per room.

---

### 5. Frontend Components

#### [NEW] [src/app/page.js](file:///e:/web%20devolopment/chat-map/src/app/page.js)

Protected main page → renders `<MapChat>` with session data.

#### [NEW] [src/components/MapChat.js](file:///e:/web%20devolopment/chat-map/src/components/MapChat.js)

Split-panel: `<MapView>` + `<ChatPanel>`. Manages socket, state, session data.

#### [NEW] [src/components/MapView.js](file:///e:/web%20devolopment/chat-map/src/components/MapView.js)

Leaflet via `react-leaflet` (dynamic import, SSR disabled). Pulsing marker for self, avatar markers for others, click-to-DM popups.

#### [NEW] [src/components/ChatPanel.js](file:///e:/web%20devolopment/chat-map/src/components/ChatPanel.js)

Room tabs (Global / Nearby / DMs), message list with auto-scroll, input bar with typing indicator.

#### [NEW] [src/components/UserMarker.js](file:///e:/web%20devolopment/chat-map/src/components/UserMarker.js)

Google avatar (or initials fallback), pulse animation for self, tooltip + popup.

---

### 6. Hooks

#### [NEW] [src/hooks/useSocket.js](file:///e:/web%20devolopment/chat-map/src/hooks/useSocket.js)

Socket.IO lifecycle, exposes `sendMessage`, `updateLocation`, `setTyping`. Returns `users`, `messages`, `activeRooms`, `typingUsers`.

#### [NEW] [src/hooks/useGeolocation.js](file:///e:/web%20devolopment/chat-map/src/hooks/useGeolocation.js)

`watchPosition`, returns `{ lat, lng, accuracy, error }`, throttled broadcast every 5s.

---

### 7. Styling

**Tailwind CSS v4** + custom overrides in `globals.css`:
- Dark palette: navy `#0a0f1e`, electric blue `#3b82f6`, cyan `#06b6d4`
- Glassmorphism (`backdrop-blur`, frosted panels)
- Pulsing `@keyframes` for user marker
- Leaflet overrides, Google Font **Inter**
- Framer Motion for modal/message/panel animations
- Responsive: stacked (mobile) → side-by-side (desktop)

#### [NEW] [src/lib/geo.js](file:///e:/web%20devolopment/chat-map/src/lib/geo.js)

`haversineDistance()` and `findNearbyUsers()` utilities.

---

## Project Structure

```
chat-map/
├── server.js              # Node server (Next.js + Socket.IO + MongoDB)
├── middleware.js           # Route protection
├── .env.local              # Secrets (Google OAuth + MongoDB)
├── src/
│   ├── app/
│   │   ├── layout.js       # <AuthProvider> wrapper
│   │   ├── page.js         # Protected → MapChat
│   │   ├── globals.css     # Tailwind + dark theme
│   │   ├── login/page.js   # Google sign-in
│   │   └── api/auth/[...nextauth]/route.js
│   ├── components/
│   │   ├── AuthProvider.js, MapChat.js, MapView.js
│   │   ├── ChatPanel.js, UserMarker.js
│   ├── hooks/
│   │   ├── useSocket.js, useGeolocation.js
│   ├── models/
│   │   ├── User.js, Message.js, UserLocation.js
│   └── lib/
│       ├── mongodb.js, geo.js
```

---

## Verification

1. Navigate to `localhost:3000` → redirects to `/login`
2. Google sign-in button renders with styling
3. After login → map + chat panel render
4. Send message → persisted to MongoDB, appears in chat
5. Two tabs → markers visible on each other's map, real-time messages
