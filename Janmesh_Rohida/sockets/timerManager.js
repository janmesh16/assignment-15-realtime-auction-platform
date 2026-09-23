/**
 * Timer Manager for Live Auction Engine
 * Manages 1-second server-side countdown timers for active auctions
 * Handles timer expiration and auction closure broadcasts
 */

const activeTimers = {};

/**
 * Starts a 1-second countdown clock for an auction if not already running.
 * @param {object} io - Socket.io server instance
 * @param {object} auction - Auction state object
 */
function startAuctionTimer(io, auction) {
  if (!auction || auction.status !== 'active') return;

  // Don't start duplicate interval if already running
  if (activeTimers[auction.id]) return;

  const timerInterval = setInterval(() => {
    if (auction.timeRemainingSeconds > 0) {
      auction.timeRemainingSeconds -= 1;

      // Broadcast 1s tick to all connected clients in the auction room
      io.to(auction.id).emit('auction:time_tick', {
        auctionId: auction.id,
        timeRemaining: auction.timeRemainingSeconds
      });
    }

    // Check if auction timer has reached 0
    if (auction.timeRemainingSeconds <= 0) {
      auction.status = 'ended';
      clearInterval(activeTimers[auction.id]);
      delete activeTimers[auction.id];
      auction.timerInterval = null;

      const winnerName = auction.highestBidder ? auction.highestBidder.username : null;

      console.log(`[TIMER EXPIRED] Auction ${auction.id} sold to ${winnerName || 'No Winner'} for ₹${auction.currentBid}`);

      // Broadcast auction:sold event to the room
      io.to(auction.id).emit('auction:sold', {
        auctionId: auction.id,
        winner: winnerName,
        finalPrice: auction.currentBid,
        status: 'sold'
      });
    }
  }, 1000);

  activeTimers[auction.id] = timerInterval;
  auction.timerInterval = timerInterval;
}

/**
 * Clears an active timer for an auction.
 * @param {string} auctionId
 */
function stopAuctionTimer(auctionId) {
  if (activeTimers[auctionId]) {
    clearInterval(activeTimers[auctionId]);
    delete activeTimers[auctionId];
  }
}

module.exports = {
  startAuctionTimer,
  stopAuctionTimer,
  activeTimers
};
