# Real-Time Live Auction & Bidding Engine (Socket.io)

An authoritative, low-latency real-time live auction platform built with Node.js, Express, and Socket.io. Features race condition prevention, server-side timer synchronization, anti-snipe soft-close timer extensions, targeted private outbid notifications, an auditable live bid activity history feed, and Web Audio synthesized audio cues wrapped in a dark "trading floor" UI aesthetic.

---

## 🚀 Key Features

- **Race-Condition Free Bidding Engine**: Atomic in-memory state updates ensure synchronous bid validation without stale state reads.
- **Server-Side Countdown Timer & Anti-Snipe Extension**: Decrements active auctions every 1 second. If a valid bid is placed with `< 15 seconds` remaining, the timer automatically extends back to `20 seconds` and broadcasts an `auction:extended` alert.
- **Targeted Private Outbid Alerts**: When a bidder is knocked off top lead, the server emits a private `bid:outbid` notification directly to their specific `socket.id`.
- **Auditable Bid History Feed**: Unshifts all valid bids with bidder metadata, timestamp, and amount to an auditable live feed.
- **Real-Time Live Audience Counter**: Dynamic calculation of sockets joined to an auction room via `io.sockets.adapter.rooms`.
- **Dark Trading Floor UI & Audio Cues**: Neon price tickers, glowing indicators, pulsing countdown clocks, and native Web Audio API sound synthesis (no external audio assets required).

---

## 📁 Directory Structure

```text
assignment-15-realtime-auction-platform/
└── Janmesh_Rohida/
    ├── public/
    │   ├── index.html        # Live bidding floor UI
    │   ├── app.js             # Client-side socket handlers & bid UI logic
    │   └── style.css          # Dark "trading floor" aesthetic with glassmorphism & animations
    ├── sockets/
    │   ├── auctionEngine.js   # Authoritative bid validation, outbid alerts, anti-snipe logic
    │   └── timerManager.js    # Server-side 1-second interval countdown clock
    ├── server.js               # Express + Socket.io server setup
    ├── package.json
    ├── .env.example
    ├── .gitignore
    └── README.md
```

---

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Real-Time WebSockets**: Socket.io
- **Utilities**: cors, dotenv, uuid
- **Dev Tools**: nodemon

---

## ⚙️ Installation & Running Locally

1. **Navigate into the project subfolder**:
   ```bash
   cd Janmesh_Rohida
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   *(Default PORT is 5000)*

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   *or production mode:*
   ```bash
   npm start
   ```

5. **Open in Browser**:
   Navigate to [http://localhost:5000](http://localhost:5000).

---

## 📡 Socket Event Protocol

### Room & Stream Events

| Event | Direction | Payload | Description |
|---|---|---|---|
| `auction:join` | Client → Server | `{ auctionId, username }` | Joins the socket.io room for that `auctionId` |
| `auction:init` | Server → Client | `{ item, bidHistory, timeRemaining }` | Sent to joining socket only to hydrate initial state |
| `auction:time_tick` | Server → Room | `{ auctionId, timeRemaining }` | Broadcast every 1 second via server clock |
| `user:joined` | Server → Room | `{ username, totalViewers }` | Broadcasts live room audience count on join/leave |

### Bidding Events

| Event | Direction | Payload | Description |
|---|---|---|---|
| `bid:place` | Client → Server | `{ auctionId, amount }` | Triggers authoritative validation engine |
| `bid:success` | Server → Room | `{ currentBid, highestBidder, bidHistory, timeRemaining }` | Broadcasts new high bid state to whole room |
| `bid:outbid` | Server → Client | `{ message }` | **Targeted private alert** emitted ONLY to previous leading bidder's `socket.id` |
| `bid:rejected` | Server → Client | `{ reason }` | Private rejection reason (bid too low, self-outbid, auction closed) |
| `auction:extended` | Server → Room | `{ timeRemaining, message }` | Broadcast when anti-snipe rule resets clock to 20s |
| `auction:sold` | Server → Room | `{ winner, finalPrice, status }` | Emitted when countdown clock hits 0s |

---

## 🧪 Testing & Verification Guide (Multi-Tab Step-by-Step)

Open **3 browser tabs/windows** to [http://localhost:5000](http://localhost:5000):

- **Tab A**: Enter Trader Alias `Vikram`
- **Tab B**: Enter Trader Alias `Ananya`
- **Tab C**: Enter Trader Alias `Rahul` (Viewer)

### Step 1: Synced Real-Time Bidding & Audience Count
- Verify all 3 tabs display **3 Watching** in the viewer tag.
- In **Tab A (Vikram)**, click **+Min (₹2,000)** or enter `52000` and click **PLACE BID NOW**.
- **Verification**: All 3 tabs instantly flash their price ticker to **₹52,000**, show **Vikram** as leading bidder, and add the entry to the Audit Bid History feed.

### Step 2: Targeted Private Outbid Notification
- In **Tab B (Ananya)**, click **+₹5,000** (bid `57000`) and submit.
- **Verification**:
  - All screens update to **₹57,000** with **Ananya** leading.
  - **Tab A (Vikram)** instantly receives a red floating toast alert: *"OUTBID ALERT! You were outbid! Ananya placed a higher bid of ₹57,000"* and plays an outbid audio chime.
  - Tab C (Rahul) does **NOT** receive the outbid alert.

### Step 3: Authoritative Rejection Checks
- In **Tab B (Ananya)**, attempt to place another bid immediately.
- **Verification**: Rejected inline with *"You are already the highest bidder"*.
- In **Tab A (Vikram)**, enter `58000` (less than `currentBid + minIncrement` = `57000 + 2000 = 59000`).
- **Verification**: Rejected inline with *"Bid too low. Minimum valid bid is ₹59,000"*.

### Step 4: Anti-Snipe Timer Extension
- Watch the countdown clock until it drops under **15 seconds** (clock turns red with anti-snipe warning label).
- Place a valid bid (e.g. `59000` from Vikram).
- **Verification**:
  - The clock instantly resets back to **20 seconds**.
  - A glowing banner **"ANTI-SNIPE TRIGGERED! +20s EXTENSION ADDED"** animates on all screens.

### Step 5: Auction Sold / Closure
- Allow the clock to tick down to `00:00`.
- **Verification**:
  - `auction:sold` is emitted.
  - The UI updates status to **ENDED**.
  - A golden **AUCTION SOLD!** banner appears displaying the winner and final price.
  - Bidding inputs are disabled. Further bids are rejected with *"Auction is closed"*.

---

## 🌐 Deploying to Render

1. Push code to GitHub repository `itm-assignment-15-auction-socket`.
2. Create a **New Web Service** on [Render](https://render.com).
3. Set **Root Directory** to `Janmesh_Rohida`.
4. Set **Build Command**: `npm install`
5. Set **Start Command**: `node server.js`
6. Render will automatically assign `process.env.PORT` and WebSockets will work out-of-the-box.
