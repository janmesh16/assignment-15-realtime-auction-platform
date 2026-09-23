const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const { handleAuctionJoin, handleBidPlace, handleDisconnect } = require('./sockets/auctionEngine');
const { startAuctionTimer } = require('./sockets/timerManager');

const app = express();
const server = http.createServer(app);

// Enable CORS
app.use(cors());
app.use(express.json());

// Serve client-side static assets from public/ directory
app.use(express.static('public'));

// In-Memory Auction Store (Seed Data)
const auctions = {
  "AUC_VINTAGE_99": {
    id: "AUC_VINTAGE_99",
    title: "1967 Vintage Fender Stratocaster",
    description: "Original sunburst condition rare electric guitar with custom shop pickups",
    startingPrice: 50000,
    currentBid: 50000,
    highestBidder: null, // { socketId, username }
    minIncrement: 2000,
    timeRemainingSeconds: 60,
    status: "active", // "upcoming" | "active" | "ended"
    bidHistory: [],
    timerInterval: null
  },
  "AUC_ROLEX_01": {
    id: "AUC_ROLEX_01",
    title: "1972 Rolex Submariner Red Writing",
    description: "Ref 1680 vintage luxury dive watch with original patina and box",
    startingPrice: 120000,
    currentBid: 120000,
    highestBidder: null,
    minIncrement: 5000,
    timeRemainingSeconds: 90,
    status: "active",
    bidHistory: [],
    timerInterval: null
  },
  "AUC_ART_42": {
    id: "AUC_ART_42",
    title: "Cyberpunk Neon Genesis Canvas #09",
    description: "Physical acrylic and LED interactive digital art piece by Neo-Tokyo Studios",
    startingPrice: 35000,
    currentBid: 35000,
    highestBidder: null,
    minIncrement: 1500,
    timeRemainingSeconds: 45,
    status: "active",
    bidHistory: [],
    timerInterval: null
  }
};

// API Endpoint to fetch list of available auctions
app.get('/api/auctions', (req, res) => {
  const auctionList = Object.values(auctions).map(auc => ({
    id: auc.id,
    title: auc.title,
    description: auc.description,
    startingPrice: auc.startingPrice,
    currentBid: auc.currentBid,
    minIncrement: auc.minIncrement,
    status: auc.status,
    timeRemainingSeconds: auc.timeRemainingSeconds,
    highestBidder: auc.highestBidder ? auc.highestBidder.username : null
  }));
  res.json(auctionList);
});

// Initialize Socket.io Server
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Start countdown timers for seeded active auctions
Object.values(auctions).forEach(auction => {
  if (auction.status === 'active') {
    startAuctionTimer(io, auction);
  }
});

// Socket Event Handlers
io.on('connection', (socket) => {
  console.log(`[SOCKET CONNECTED] ID: ${socket.id}`);

  // Event: auction:join (client -> server)
  socket.on('auction:join', (payload) => {
    handleAuctionJoin(io, socket, auctions, payload);
  });

  // Event: bid:place (client -> server)
  socket.on('bid:place', (payload) => {
    handleBidPlace(io, socket, auctions, payload);
  });

  // Event: disconnect
  socket.on('disconnect', () => {
    console.log(`[SOCKET DISCONNECTED] ID: ${socket.id}`);
    handleDisconnect(io, socket, auctions);
  });
});

const DEFAULT_PORT = process.env.PORT || 5000;

const serverInstance = server.listen(DEFAULT_PORT, () => {
  const actualPort = serverInstance.address().port;
  console.log(`===================================================`);
  console.log(`🚀 Live Auction Engine running on http://localhost:${actualPort}`);
  console.log(`===================================================`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[PORT NOTICE] Port ${DEFAULT_PORT} is occupied. Attempting fallback port ${Number(DEFAULT_PORT) + 1}...`);
    server.listen(Number(DEFAULT_PORT) + 1, () => {
      const actualPort = server.address().port;
      console.log(`===================================================`);
      console.log(`🚀 Live Auction Engine running on http://localhost:${actualPort}`);
      console.log(`===================================================`);
    });
  } else {
    console.error('Server error:', err);
  }
});
