# 📍 MapChat — Real-Time Proximity Web Platform

**MapChat** is a professional, high-performance real-time messaging web application where your location is your identity. Discover, chat, and connect with users around the world on a live interactive map.

![MapChat Preview](https://via.placeholder.com/1200x600/0d1d1b/ffffff?text=MapChat+Interactive+Overlay)

## 🌟 Platform Features

-   **Live Interactive Map**: Real-time user discovery powered by Leaflet and Socket.IO.
-   **Direct Messaging**: Secure, 1v1 private chats with database-authoritative persistence.
-   **Proximity Chat**: Specialized global and proximity-aware messaging streams.
-   **Premium Identity System**: Anti-flicker database identity resolution with custom Display Names and **DiceBear** avatars.
-   **Multi-Device Sync**: Real-time read-receipts and notification badges synchronized across all active sessions.
-   **Modern Auth**: Seamless Google OAuth integration via NextAuth.
-   **Premium UI**: A sleek, dark-themed interface built with Material UI (MUI) and Tailwind 4.

## 🚀 Modern Web Stack

-   **Frontend**: [Next.js 15](https://nextjs.org/) (App Router), [Material UI (MUI)](https://mui.com/), [Tailwind CSS 4](https://tailwindcss.com/)
-   **Backend**: [Custom Node.js Server](https://nodejs.org/), [Socket.IO](https://socket.io/)
-   **Database**: [MongoDB](https://www.mongodb.com/) (Mongoose ODM)
-   **Authentication**: [NextAuth.js](https://next-auth.js.org/)
-   **Maps**: [Leaflet](https://leafletjs.com/)

---

## 🛠️ Local Development

### 1. Get the source
```bash
git clone https://github.com/subhoxsaha/chat-map.git
cd chat-map
```

### 2. Configure Environment
Create a `.env.local` file in the root directory:

```env
MONGODB_URI=your_mongodb_connection_string
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_SECRET=your_generated_secret
NEXTAUTH_URL=http://localhost:3000
```

### 3. Launch Platform
```bash
npm install
npm run server
```

---

## 🌐 Production Architecture (Render)

This web application is optimized for deployment as a persistent Node.js service (e.g., Render, Railway).

-   **Build Phase**: `npm install; npm run build`
-   **Runtime Phase**: `npm run server`
-   **Stability**: Optimized with a hardened lazy-loading architecture for Next.js 15.

---

## 📄 License
MIT License.

---

*Crafted with ❤️ for the global web community.*
