/**
 * Authoritative Auction Engine
 * Validates bids, enforces minimum increments, handles anti-snipe logic,
 * broadcasts real-time outbid notifications, and manages viewer counts.
 */

const { startAuctionTimer } = require('./timerManager');

/**
 * Handles a user joining an auction room.
 */
function handleAuctionJoin(io, socket, auctions, payload) {
  const { auctionId, username } = payload || {};

  if (!auctionId || !auctions[auctionId]) {
    socket.emit('bid:rejected', { reason: 'Invalid auction room specified.' });
    return;
  }

  const auction = auctions[auctionId];

  // Store user info on socket data object for reference
  socket.data.username = username || `Trader_${socket.id.substring(0, 5)}`;
  socket.data.currentAuctionId = auctionId;

  // Leave previous auction rooms if any (except default socket room)
  for (const room of socket.rooms) {
    if (room !== socket.id) {
      socket.leave(room);
    }
  }

  // Join target auction room
  socket.join(auctionId);

  // Hydrate joining client with full initial auction state
  socket.emit('auction:init', {
    item: {
      id: auction.id,
      title: auction.title,
      description: auction.description,
      startingPrice: auction.startingPrice,
      currentBid: auction.currentBid,
      highestBidder: auction.highestBidder,
      minIncrement: auction.minIncrement,
      status: auction.status
    },
    bidHistory: auction.bidHistory,
    timeRemaining: auction.timeRemainingSeconds
  });

  // Calculate live audience count in this room
  const roomSockets = io.sockets.adapter.rooms.get(auctionId);
  const totalViewers = roomSockets ? roomSockets.size : 1;

  // Broadcast user:joined to the room
  io.to(auctionId).emit('user:joined', {
    username: socket.data.username,
    totalViewers
  });

  // Ensure server-side timer is active for this auction
  if (auction.status === 'active') {
    startAuctionTimer(io, auction);
  }
}

/**
 * Authoritative Bid Placement & Validation Engine
 */
function handleBidPlace(io, socket, auctions, payload) {
  const { auctionId, amount } = payload || {};
  const bidAmount = Number(amount);

  if (!auctionId || !auctions[auctionId]) {
    socket.emit('bid:rejected', { reason: 'Auction does not exist.' });
    return;
  }

  const auction = auctions[auctionId];
  const username = socket.data.username || 'Anonymous';

  // RULE 1: Reject if auction isn't active or time has hit 0
  if (auction.status !== 'active' || auction.timeRemainingSeconds <= 0) {
    socket.emit('bid:rejected', { reason: 'Auction is closed' });
    return;
  }

  // RULE 2: Reject if bidder is already the highest bidder (no self-outbid)
  if (auction.highestBidder && auction.highestBidder.socketId === socket.id) {
    socket.emit('bid:rejected', { reason: 'You are already the highest bidder' });
    return;
  }

  // RULE 3: Reject if bid < currentBid + minIncrement
  const minimumRequired = auction.currentBid + auction.minIncrement;
  if (isNaN(bidAmount) || bidAmount < minimumRequired) {
    socket.emit('bid:rejected', {
      reason: `Bid too low. Minimum valid bid is ₹${minimumRequired.toLocaleString('en-IN')}`
    });
    return;
  }

  // RULE 4: Capture previous bidder BEFORE updating state
  const previousBidder = auction.highestBidder;

  // RULE 5: Synchronously update auction state (no async gaps to prevent race conditions)
  auction.currentBid = bidAmount;
  auction.highestBidder = {
    socketId: socket.id,
    username: username
  };

  const newBidEntry = {
    bidder: username,
    amount: bidAmount,
    timestamp: new Date().toISOString()
  };
  auction.bidHistory.unshift(newBidEntry);

  // RULE 6: ANTI-SNIPE RULE
  // If timeRemainingSeconds < 15, reset to 20s and emit auction:extended
  let timerExtended = false;
  if (auction.timeRemainingSeconds < 15) {
    auction.timeRemainingSeconds = 20;
    timerExtended = true;
    io.to(auctionId).emit('auction:extended', {
      timeRemaining: auction.timeRemainingSeconds,
      message: 'Bid in final seconds: Timer extended by 20s!'
    });
  }

  // RULE 7: Broadcast bid:success to the room
  io.to(auctionId).emit('bid:success', {
    currentBid: auction.currentBid,
    highestBidder: auction.highestBidder,
    bidHistory: auction.bidHistory,
    timeRemaining: auction.timeRemainingSeconds
  });

  // RULE 8: Targeted outbid alert to previous highest bidder ONLY
  if (previousBidder && previousBidder.socketId && previousBidder.socketId !== socket.id) {
    io.to(previousBidder.socketId).emit('bid:outbid', {
      message: `You were outbid! ${username} placed a higher bid of ₹${bidAmount.toLocaleString('en-IN')}.`
    });
  }
}

/**
 * Handles client socket disconnection to update viewer counts.
 */
function handleDisconnect(io, socket, auctions) {
  const auctionId = socket.data.currentAuctionId;
  if (auctionId && auctions[auctionId]) {
    const roomSockets = io.sockets.adapter.rooms.get(auctionId);
    const totalViewers = roomSockets ? roomSockets.size : 0;
    io.to(auctionId).emit('user:joined', {
      username: socket.data.username || 'A viewer',
      totalViewers
    });
  }
}

module.exports = {
  handleAuctionJoin,
  handleBidPlace,
  handleDisconnect
};
