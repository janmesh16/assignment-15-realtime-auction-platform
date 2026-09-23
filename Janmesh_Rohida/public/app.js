/**
 * AUCTIONX — Client-Side Real-Time Bidding Controller
 * Handles Socket.io events, Web Audio API sound synthesis, dynamic UI updates,
 * quick bid calculations, and outbid notification toasts.
 */

// Initialize Socket.io connection (automatically uses current origin)
const socket = io();

// State Variables
let currentAuctionId = "AUC_VINTAGE_99";
let currentUsername = "";
let currentAuctionState = null;
let audioCtx = null;

// DOM Elements
const usernameModal = document.getElementById('usernameModal');
const usernameForm = document.getElementById('usernameForm');
const usernameInput = document.getElementById('usernameInput');
const currentTraderName = document.getElementById('currentTraderName');
const connectionStatus = document.getElementById('connectionStatus');

const auctionTabs = document.getElementById('auctionTabs');
const itemAuctionId = document.getElementById('itemAuctionId');
const itemTitle = document.getElementById('itemTitle');
const itemDescription = document.getElementById('itemDescription');
const currentBidPrice = document.getElementById('currentBidPrice');
const leadingBidderName = document.getElementById('leadingBidderName');
const leadingBidderBadge = document.getElementById('leadingBidderBadge');
const totalViewers = document.getElementById('totalViewers');
const auctionStatusBadge = document.getElementById('auctionStatusBadge');

const clockPanel = document.getElementById('clockPanel');
const timeRemainingText = document.getElementById('timeRemainingText');
const timeRemainingSecs = document.getElementById('timeRemainingSecs');
const clockProgressBar = document.getElementById('clockProgressBar');
const clockStatusLabel = document.getElementById('clockStatusLabel');

const biddingConsole = document.getElementById('biddingConsole');
const minIncrementValue = document.getElementById('minIncrementValue');
const bidForm = document.getElementById('bidForm');
const bidAmountInput = document.getElementById('bidAmountInput');
const btnPlaceBid = document.getElementById('btnPlaceBid');
const bidErrorMessage = document.getElementById('bidErrorMessage');
const bidErrorText = document.getElementById('bidErrorText');

const btnQuickMin = document.getElementById('btnQuickMin');
const btnQuick5k = document.getElementById('btnQuick5k');
const btnQuick10k = document.getElementById('btnQuick10k');

const soldBanner = document.getElementById('soldBanner');
const soldTitle = document.getElementById('soldTitle');
const soldSubtext = document.getElementById('soldSubtext');

const toastContainer = document.getElementById('toastContainer');
const antiSnipeBanner = document.getElementById('antiSnipeBanner');
const bidHistoryList = document.getElementById('bidHistoryList');
const emptyHistoryMsg = document.getElementById('emptyHistoryMsg');
const historyCountBadge = document.getElementById('historyCountBadge');
const tickerBox = document.getElementById('tickerBox');

// ==========================================================================
// WEB AUDIO API SOUND SYNTHESIZER (Pure JS Audio Cues)
// ==========================================================================
function initAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Play pleasant dual-tone chime when bid succeeds
function playBidSound() {
  try {
    initAudioContext();
    const now = audioCtx.currentTime;
    
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.1); // A5
    gain2.gain.setValueAtTime(0.15, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.4);
  } catch (e) {
    console.warn("Audio Context playback failed:", e);
  }
}

// Play urgent alert when user is outbid
function playOutbidSound() {
  try {
    initAudioContext();
    const now = audioCtx.currentTime;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(311.13, now + 0.12); // Eb4
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {
    console.warn("Audio Context playback failed:", e);
  }
}

// Play anti-snipe siren sweep sound
function playAntiSnipeSound() {
  try {
    initAudioContext();
    const now = audioCtx.currentTime;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.3);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  } catch (e) {
    console.warn("Audio Context playback failed:", e);
  }
}

// Play victory gong chord when auction sold
function playSoldSound() {
  try {
    initAudioContext();
    const now = audioCtx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C Major Chord
    freqs.forEach(freq => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 1.2);
    });
  } catch (e) {
    console.warn("Audio Context playback failed:", e);
  }
}

// ==========================================================================
// INITIALIZATION & USER MANAGEMENT
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
  const savedName = sessionStorage.getItem('auctionx_trader');
  if (savedName) {
    currentUsername = savedName;
    usernameModal.classList.add('hidden');
    currentTraderName.textContent = currentUsername;
    fetchAuctionList();
  } else {
    usernameModal.classList.remove('hidden');
  }
});

usernameForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const val = usernameInput.value.trim();
  if (val) {
    currentUsername = val;
    sessionStorage.setItem('auctionx_trader', currentUsername);
    usernameModal.classList.add('hidden');
    currentTraderName.textContent = currentUsername;
    initAudioContext();
    fetchAuctionList();
  }
});

// Fetch auction list for tabs
async function fetchAuctionList() {
  try {
    const res = await fetch('/api/auctions');
    const auctions = await res.json();
    renderAuctionTabs(auctions);
    if (auctions.length > 0) {
      joinAuctionRoom(auctions[0].id);
    }
  } catch (err) {
    console.error("Error fetching auctions:", err);
  }
}

function renderAuctionTabs(auctions) {
  auctionTabs.innerHTML = '';
  auctions.forEach(auc => {
    const btn = document.createElement('button');
    btn.className = `tab-btn ${auc.id === currentAuctionId ? 'active' : ''}`;
    btn.innerHTML = `<i class="fa-solid fa-gavel"></i> ${auc.title}`;
    btn.addEventListener('click', () => {
      if (auc.id !== currentAuctionId) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        joinAuctionRoom(auc.id);
      }
    });
    auctionTabs.appendChild(btn);
  });
}

function joinAuctionRoom(auctionId) {
  currentAuctionId = auctionId;
  hideError();
  soldBanner.classList.add('hidden');
  biddingConsole.classList.remove('hidden');
  antiSnipeBanner.classList.add('hidden');

  socket.emit('auction:join', {
    auctionId: currentAuctionId,
    username: currentUsername
  });
}

// ==========================================================================
// SOCKET EVENT LISTENERS
// ==========================================================================

// Connection status updates
socket.on('connect', () => {
  connectionStatus.querySelector('.status-indicator').className = 'status-indicator online';
  connectionStatus.querySelector('.status-text').textContent = 'Socket Connected';
  if (currentUsername && currentAuctionId) {
    socket.emit('auction:join', { auctionId: currentAuctionId, username: currentUsername });
  }
});

socket.on('disconnect', () => {
  connectionStatus.querySelector('.status-indicator').className = 'status-indicator offline';
  connectionStatus.querySelector('.status-text').textContent = 'Disconnected';
});

// Event: auction:init (server -> client)
socket.on('auction:init', (data) => {
  const { item, bidHistory, timeRemaining } = data;
  currentAuctionState = item;
  currentAuctionState.timeRemaining = timeRemaining;

  itemAuctionId.textContent = item.id;
  itemTitle.textContent = item.title;
  itemDescription.textContent = item.description;
  currentBidPrice.textContent = Number(item.currentBid).toLocaleString('en-IN');
  minIncrementValue.textContent = `₹${Number(item.minIncrement).toLocaleString('en-IN')}`;

  // Leading bidder badge
  updateLeadingBidderDisplay(item.highestBidder);

  // Status Badge
  updateStatusBadge(item.status);

  // Time remaining clock
  updateClockDisplay(timeRemaining);

  // History Feed
  renderBidHistory(bidHistory);

  // Set default bid input value
  updateQuickBidInput(item.currentBid, item.minIncrement);

  // Check if auction is already ended
  if (item.status === 'ended' || timeRemaining <= 0) {
    handleAuctionEnded(item.highestBidder ? item.highestBidder.username : null, item.currentBid);
  }
});

// Event: auction:time_tick (server -> room)
socket.on('auction:time_tick', (data) => {
  if (data.auctionId === currentAuctionId) {
    if (currentAuctionState) {
      currentAuctionState.timeRemaining = data.timeRemaining;
    }
    updateClockDisplay(data.timeRemaining);
  }
});

// Event: user:joined (server -> room)
socket.on('user:joined', (data) => {
  totalViewers.textContent = data.totalViewers || 1;
});

// Event: bid:success (server -> room)
socket.on('bid:success', (data) => {
  if (currentAuctionState) {
    currentAuctionState.currentBid = data.currentBid;
    currentAuctionState.highestBidder = data.highestBidder;
    currentAuctionState.timeRemaining = data.timeRemaining;
  }

  // Update Price Display with flash effect
  currentBidPrice.textContent = Number(data.currentBid).toLocaleString('en-IN');
  tickerBox.classList.remove('price-flash');
  void tickerBox.offsetWidth; // trigger reflow
  tickerBox.classList.add('price-flash');

  // Update Leading Bidder Badge
  updateLeadingBidderDisplay(data.highestBidder);

  // Render updated bid history feed
  renderBidHistory(data.bidHistory);

  // Update quick bid input for next bid
  updateQuickBidInput(data.currentBid, currentAuctionState.minIncrement);
  hideError();

  // Play audio chime
  playBidSound();
});

// Event: bid:outbid (server -> client private)
socket.on('bid:outbid', (data) => {
  showToast(data.message, 'outbid');
  playOutbidSound();
});

// Event: bid:rejected (server -> client private)
socket.on('bid:rejected', (data) => {
  showError(data.reason);
});

// Event: auction:extended (server -> room)
socket.on('auction:extended', (data) => {
  if (currentAuctionState) {
    currentAuctionState.timeRemaining = data.timeRemaining;
  }
  updateClockDisplay(data.timeRemaining);
  
  // Show Anti-Snipe Animated Banner
  antiSnipeBanner.classList.remove('hidden');
  playAntiSnipeSound();

  setTimeout(() => {
    antiSnipeBanner.classList.add('hidden');
  }, 4000);
});

// Event: auction:sold (server -> room)
socket.on('auction:sold', (data) => {
  handleAuctionEnded(data.winner, data.finalPrice);
  playSoldSound();
});

// ==========================================================================
// FORM SUBMISSION & QUICK BIDS
// ==========================================================================
bidForm.addEventListener('submit', (e) => {
  e.preventDefault();
  hideError();

  const amount = Number(bidAmountInput.value);
  if (!amount || isNaN(amount)) {
    showError("Please enter a valid bid amount.");
    return;
  }

  // Emit bid:place to server
  socket.emit('bid:place', {
    auctionId: currentAuctionId,
    amount: amount
  });
});

btnQuickMin.addEventListener('click', () => {
  if (!currentAuctionState) return;
  const target = currentAuctionState.currentBid + currentAuctionState.minIncrement;
  bidAmountInput.value = target;
});

btnQuick5k.addEventListener('click', () => {
  if (!currentAuctionState) return;
  const target = currentAuctionState.currentBid + 5000;
  bidAmountInput.value = target;
});

btnQuick10k.addEventListener('click', () => {
  if (!currentAuctionState) return;
  const target = currentAuctionState.currentBid + 10000;
  bidAmountInput.value = target;
});

function updateQuickBidInput(currentBid, minIncrement) {
  bidAmountInput.value = currentBid + minIncrement;
}

// ==========================================================================
// UI HELPER FUNCTIONS
// ==========================================================================
function updateLeadingBidderDisplay(highestBidder) {
  if (highestBidder && highestBidder.username) {
    leadingBidderBadge.classList.remove('empty');
    const isMe = highestBidder.username === currentUsername;
    leadingBidderName.textContent = isMe ? `${highestBidder.username} (YOU)` : highestBidder.username;
  } else {
    leadingBidderBadge.classList.add('empty');
    leadingBidderName.textContent = 'No bids placed yet';
  }
}

function updateStatusBadge(status) {
  auctionStatusBadge.textContent = status.toUpperCase();
  if (status === 'active') {
    auctionStatusBadge.className = 'badge badge-status status-active';
  } else {
    auctionStatusBadge.className = 'badge badge-status ended';
  }
}

function updateClockDisplay(timeRemaining) {
  const secs = Math.max(0, timeRemaining);
  const minutes = Math.floor(secs / 60);
  const remSecs = secs % 60;
  
  const formatted = `${String(minutes).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;
  timeRemainingText.textContent = formatted;
  timeRemainingSecs.textContent = `${secs} seconds remaining`;

  // Progress Bar calculation (max 60s baseline or default)
  const maxTime = 60;
  const percentage = Math.min(100, Math.max(0, (secs / maxTime) * 100));
  clockProgressBar.style.width = `${percentage}%`;

  // Warning styling under 15 seconds
  if (secs <= 15 && secs > 0) {
    clockPanel.classList.add('warning');
    clockStatusLabel.textContent = '⚡ ANTI-SNIPE ZONE (<15s)';
  } else {
    clockPanel.classList.remove('warning');
    clockStatusLabel.textContent = 'CLOSING SOON';
  }
}

function renderBidHistory(bidHistory) {
  historyCountBadge.textContent = `${bidHistory.length} Bids`;
  if (!bidHistory || bidHistory.length === 0) {
    emptyHistoryMsg.classList.remove('hidden');
    bidHistoryList.innerHTML = '';
    return;
  }

  emptyHistoryMsg.classList.add('hidden');
  bidHistoryList.innerHTML = '';

  bidHistory.forEach((bid, index) => {
    const li = document.createElement('li');
    li.className = 'bid-history-item';
    
    const timeStr = bid.timestamp ? new Date(bid.timestamp).toLocaleTimeString() : 'Just now';
    const isMe = bid.bidder === currentUsername;

    li.innerHTML = `
      <div class="bidder-meta">
        <div class="bidder-avatar">${bid.bidder.charAt(0).toUpperCase()}</div>
        <div>
          <span class="bidder-name">${bid.bidder} ${isMe ? '<span class="text-accent">(You)</span>' : ''}</span>
          <span class="bid-time">${timeStr}</span>
        </div>
      </div>
      <div class="bid-amount-badge">₹${Number(bid.amount).toLocaleString('en-IN')}</div>
    `;
    bidHistoryList.appendChild(li);
  });
}

function handleAuctionEnded(winner, finalPrice) {
  updateStatusBadge('ended');
  biddingConsole.classList.add('hidden');
  soldBanner.classList.remove('hidden');
  clockPanel.classList.remove('warning');

  if (winner) {
    soldTitle.textContent = "AUCTION SOLD!";
    soldSubtext.textContent = `Winning Bidder: ${winner} — Final Sold Price: ₹${Number(finalPrice).toLocaleString('en-IN')}`;
  } else {
    soldTitle.textContent = "AUCTION ENDED";
    soldSubtext.textContent = `No bids were placed for this item. Final Price: ₹${Number(finalPrice).toLocaleString('en-IN')}`;
  }
}

function showError(msg) {
  bidErrorText.textContent = msg;
  bidErrorMessage.classList.remove('hidden');
}

function hideError() {
  bidErrorMessage.classList.add('hidden');
}

function showToast(msg, type = 'outbid') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid fa-triangle-exclamation"></i>
    <div>
      <strong>OUTBID ALERT!</strong>
      <p style="font-size:0.85rem; margin-top:2px;">${msg}</p>
    </div>
  `;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}
