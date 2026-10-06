// public/display.js - Big-Screen Display front-end for Flappy Royale

(function () {
  'use strict';

  // DOM Elements
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;

  const qrImageEl = document.getElementById('qr-image');
  const joinUrlEl = document.getElementById('join-url');
  const statusBadgeEl = document.getElementById('status-badge');
  const playerCountEl = document.getElementById('player-count');
  const playersListEl = document.getElementById('players-list');
  const eliminationListEl = document.getElementById('elimination-list');
  const winnerOverlayEl = document.getElementById('winner-overlay');
  const winnerNameEl = document.getElementById('winner-name');

  const btnStart = document.getElementById('btn-start');
  const btnRestart = document.getElementById('btn-restart');
  const btnFlap = document.getElementById('btn-flap');

  // Internal State
  let gameState = {
    status: 'lobby',
    players: [],
    pipes: [],
    eliminated: [],
    winnerId: null
  };

  // QR Code Image for Canvas rendering
  const qrImageObj = new Image();
  let qrImageLoaded = false;
  qrImageObj.onload = () => {
    qrImageLoaded = true;
  };

  // Fetch join info (QR code & URL)
  async function loadJoinInfo() {
    try {
      const response = await fetch('/api/join-info');
      if (!response.ok) return;
      const data = await response.json();
      if (data.qrDataUrl) {
        if (qrImageEl) qrImageEl.src = data.qrDataUrl;
        qrImageObj.src = data.qrDataUrl;
      }
      if (data.url) {
        if (joinUrlEl) {
          joinUrlEl.textContent = data.url;
          joinUrlEl.href = data.url;
        }
      }
    } catch (err) {
      console.warn('Could not load join info from /api/join-info:', err);
    }
  }

  // Socket.io connection
  let socket = null;
  if (typeof io === 'function') {
    socket = io();
    socket.on('state', (state) => {
      gameState = state || gameState;
      updateDOM(gameState);
    });
  }

  // Fallback Host Buttons wiring (in case host-controls.js has not attached them)
  if (btnStart) {
    btnStart.addEventListener('click', () => {
      if (socket) socket.emit('startRound');
    });
  }
  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      if (socket) socket.emit('restart');
    });
  }
  if (btnFlap) {
    btnFlap.addEventListener('click', () => {
      if (socket) socket.emit('flap');
    });
  }

  // Keyboard shortcut fallback for host
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!socket) return;
    if (e.code === 'Space') {
      e.preventDefault();
      socket.emit('flap');
    } else if (e.code === 'Enter') {
      socket.emit('startRound');
    } else if (e.code === 'KeyR') {
      socket.emit('restart');
    }
  });

  // Helpers
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Update DOM UI from state broadcast
  function updateDOM(state) {
    const status = state.status || 'lobby';
    const players = state.players || [];
    const eliminated = state.eliminated || [];
    const winnerId = state.winnerId;

    // Status Badge
    if (statusBadgeEl) {
      statusBadgeEl.className = 'badge';
      if (status === 'lobby') {
        statusBadgeEl.classList.add('badge-lobby');
        statusBadgeEl.textContent = 'LOBBY';
      } else if (status === 'playing') {
        statusBadgeEl.classList.add('badge-playing');
        statusBadgeEl.textContent = 'PLAYING';
      } else if (status === 'ended') {
        statusBadgeEl.classList.add('badge-ended');
        statusBadgeEl.textContent = 'ROUND OVER';
      }
    }

    // Player Count
    if (playerCountEl) {
      playerCountEl.textContent = `${players.length} Player${players.length === 1 ? '' : 's'}`;
    }

    // Players List
    if (playersListEl) {
      if (players.length === 0) {
        playersListEl.innerHTML = '<li class="empty-state-text">Waiting for players to join...</li>';
      } else {
        playersListEl.innerHTML = players
          .map((p) => {
            const isAlive = p.alive !== false;
            return `
              <li class="player-item">
                <div class="player-name-group">
                  <span class="color-dot" style="background-color: ${escapeHtml(p.color || '#38bdf8')}"></span>
                  <span class="player-name">${escapeHtml(p.name || 'Player')}</span>
                </div>
                <span class="player-state-tag ${isAlive ? 'tag-alive' : 'tag-dead'}">${isAlive ? 'ALIVE' : 'OUT'}</span>
              </li>
            `;
          })
          .join('');
      }
    }

    // Elimination Order List
    if (eliminationListEl) {
      if (eliminated.length === 0) {
        eliminationListEl.innerHTML = '<li class="empty-state-text">No eliminations yet</li>';
      } else {
        const playerMap = new Map();
        players.forEach((p) => playerMap.set(p.id, p));

        eliminationListEl.innerHTML = eliminated
          .map((id, index) => {
            const player = playerMap.get(id);
            const name = player ? player.name : `Player (${id.slice(0, 4)})`;
            const color = player ? player.color : '#e2e8f0';
            return `
              <li class="elimination-item">
                <div class="player-name-group">
                  <span class="elimination-order-badge">#${index + 1}</span>
                  <span class="color-dot" style="background-color: ${escapeHtml(color)}"></span>
                  <span>${escapeHtml(name)}</span>
                </div>
                <span class="player-state-tag tag-dead">OUT</span>
              </li>
            `;
          })
          .join('');
      }
    }

    // Winner Banner / Overlay
    if (winnerOverlayEl) {
      const isEnded = status === 'ended' || Boolean(winnerId);
      if (isEnded) {
        let winnerName = 'Unknown Winner';
        if (winnerId) {
          const winner = players.find((p) => p.id === winnerId);
          if (winner) winnerName = winner.name;
        } else {
          const survivor = players.find((p) => p.alive);
          if (survivor) winnerName = survivor.name;
        }
        if (winnerNameEl) {
          winnerNameEl.textContent = `👑 ${winnerName} 👑`;
        }
        winnerOverlayEl.classList.remove('hidden');
      } else {
        winnerOverlayEl.classList.add('hidden');
      }
    }
  }

  // Canvas Drawing
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const GROUND_HEIGHT = 40;
  const PLAY_HEIGHT = CANVAS_HEIGHT - GROUND_HEIGHT;

  function drawBackground() {
    // Sky
    const skyGradient = ctx.createLinearGradient(0, 0, 0, PLAY_HEIGHT);
    skyGradient.addColorStop(0, '#4fc3f7');
    skyGradient.addColorStop(1, '#b3e5fc');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, PLAY_HEIGHT);

    // Decorative distant clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(150, 100, 30, 0, Math.PI * 2);
    ctx.arc(180, 95, 35, 0, Math.PI * 2);
    ctx.arc(210, 100, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(580, 140, 26, 0, Math.PI * 2);
    ctx.arc(605, 135, 32, 0, Math.PI * 2);
    ctx.arc(630, 140, 24, 0, Math.PI * 2);
    ctx.fill();

    // Ground
    ctx.fillStyle = '#ded895';
    ctx.fillRect(0, PLAY_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);

    // Grass strip
    ctx.fillStyle = '#73bf2e';
    ctx.fillRect(0, PLAY_HEIGHT, CANVAS_WIDTH, 12);

    ctx.fillStyle = '#558b2f';
    ctx.fillRect(0, PLAY_HEIGHT + 12, CANVAS_WIDTH, 2);
  }

  function drawPipes(pipes) {
    if (!pipes || pipes.length === 0) return;
    const pipeWidth = 60;
    const lipHeight = 24;
    const lipOverlap = 4;

    pipes.forEach((pipe) => {
      const x = pipe.x;
      const gapY = pipe.gapY;
      const gapHeight = pipe.gapHeight;
      const bottomY = gapY + gapHeight;

      // Pipe main colors
      const pipeColor = '#73bf2e';
      const pipeBorder = '#2e7d32';
      const pipeHighlight = '#9ccc65';

      // 1. Top pipe
      if (gapY > 0) {
        // Body
        ctx.fillStyle = pipeColor;
        ctx.fillRect(x, 0, pipeWidth, gapY);

        ctx.fillStyle = pipeHighlight;
        ctx.fillRect(x + 4, 0, 8, gapY);

        ctx.strokeStyle = pipeBorder;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x, -2, pipeWidth, gapY + 2);

        // Top lip (cap)
        const capY = gapY - lipHeight;
        if (capY >= 0) {
          ctx.fillStyle = pipeColor;
          ctx.fillRect(x - lipOverlap, capY, pipeWidth + lipOverlap * 2, lipHeight);

          ctx.fillStyle = pipeHighlight;
          ctx.fillRect(x - lipOverlap + 4, capY, 8, lipHeight);

          ctx.strokeStyle = pipeBorder;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(x - lipOverlap, capY, pipeWidth + lipOverlap * 2, lipHeight);
        }
      }

      // 2. Bottom pipe
      if (bottomY < PLAY_HEIGHT) {
        const height = PLAY_HEIGHT - bottomY;

        // Body
        ctx.fillStyle = pipeColor;
        ctx.fillRect(x, bottomY, pipeWidth, height);

        ctx.fillStyle = pipeHighlight;
        ctx.fillRect(x + 4, bottomY, 8, height);

        ctx.strokeStyle = pipeBorder;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x, bottomY, pipeWidth, height);

        // Bottom lip (cap)
        ctx.fillStyle = pipeColor;
        ctx.fillRect(x - lipOverlap, bottomY, pipeWidth + lipOverlap * 2, lipHeight);

        ctx.fillStyle = pipeHighlight;
        ctx.fillRect(x - lipOverlap + 4, bottomY, 8, lipHeight);

        ctx.strokeStyle = pipeBorder;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x - lipOverlap, bottomY, pipeWidth + lipOverlap * 2, lipHeight);
      }
    });
  }

  function drawBird(player, index) {
    const isAlive = player.alive !== false;
    // Default x staggered slightly if not provided in state
    const birdX = typeof player.x === 'number' ? player.x : (120 + ((index * 22) % 66));
    const birdY = typeof player.y === 'number' ? player.y : 250;
    const color = player.color || '#e74c3c';
    const vy = typeof player.vy === 'number' ? player.vy : 0;
    const radius = 16;

    ctx.save();
    ctx.translate(birdX, birdY);

    if (!isAlive) {
      ctx.globalAlpha = 0.55;
    }

    // Bird rotation based on velocity
    const rotation = isAlive ? Math.min(Math.max((vy * Math.PI) / 180, -0.6), 0.7) : Math.PI / 2;
    ctx.rotate(rotation);

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Belly
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-2, 4, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    if (isAlive) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(7, -5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(8.5, -5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // X for dead eye
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(4, -8);
      ctx.lineTo(10, -2);
      ctx.moveTo(10, -8);
      ctx.lineTo(4, -2);
      ctx.stroke();
    }

    // Beak
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(12, -2);
    ctx.lineTo(21, 1);
    ctx.lineTo(12, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#c2410c';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Wing
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-6, 2, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();

    // Name tag above bird (drawn without rotation)
    ctx.save();
    ctx.font = 'bold 12px sans-serif';
    const nameText = player.name || `Player ${index + 1}`;
    const textWidth = ctx.measureText(nameText).width;
    const tagPadding = 6;
    const tagHeight = 18;
    const tagX = birdX - textWidth / 2 - tagPadding;
    const tagY = birdY - radius - 16;

    ctx.fillStyle = isAlive ? 'rgba(15, 23, 42, 0.75)' : 'rgba(239, 68, 68, 0.75)';
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, textWidth + tagPadding * 2, tagHeight, 4);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nameText, birdX, tagY + tagHeight / 2);
    ctx.restore();
  }

  function drawLobbyScreen() {
    // Semi-transparent overlay over background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, PLAY_HEIGHT);

    // Title
    ctx.save();
    ctx.fillStyle = '#f59e0b';
    ctx.font = '900 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 8;
    ctx.fillText('FLAPPY ROYALE', CANVAS_WIDTH / 2, 120);

    ctx.font = '600 18px sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('Multiplayer Elimination Battle', CANVAS_WIDTH / 2, 155);

    // Render QR Code onto the Canvas if loaded
    if (qrImageLoaded && qrImageObj) {
      const qrSize = 160;
      const qrX = CANVAS_WIDTH / 2 - qrSize / 2;
      const qrY = 190;

      // White background card for QR
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 8);
      ctx.fill();
      ctx.drawImage(qrImageObj, qrX, qrY, qrSize, qrSize);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('SCAN WITH PHONE TO JOIN', CANVAS_WIDTH / 2, qrY + qrSize + 35);
    } else {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '16px sans-serif';
      ctx.fillText('Loading Join Info...', CANVAS_WIDTH / 2, 260);
    }

    // Lobby instruction
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    if (gameState.players && gameState.players.length > 0) {
      ctx.fillText(
        `${gameState.players.length} player(s) in lobby. Host: click Start Round or press Enter`,
        CANVAS_WIDTH / 2,
        450
      );
    } else {
      ctx.fillText('Waiting for players to join the lobby...', CANVAS_WIDTH / 2, 450);
    }
    ctx.restore();
  }

  function drawEndedBanner() {
    let winnerName = 'Unknown Winner';
    if (gameState.winnerId) {
      const winner = (gameState.players || []).find((p) => p.id === gameState.winnerId);
      if (winner) winnerName = winner.name;
    } else {
      const survivor = (gameState.players || []).find((p) => p.alive);
      if (survivor) winnerName = survivor.name;
    }

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(0, 160, CANVAS_WIDTH, 140);

    ctx.fillStyle = '#f59e0b';
    ctx.font = '900 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ROUND OVER', CANVAS_WIDTH / 2, 215);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`WINNER: ${winnerName}`, CANVAS_WIDTH / 2, 255);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '14px sans-serif';
    ctx.fillText('Host: click Restart or press R', CANVAS_WIDTH / 2, 285);
    ctx.restore();
  }

  // Main Render Loop
  function render() {
    if (!ctx) return;

    drawBackground();

    const status = gameState.status || 'lobby';
    const pipes = gameState.pipes || [];
    const players = gameState.players || [];

    if (status === 'lobby') {
      // In lobby, render birds if any joined, plus the lobby QR screen
      if (players.length > 0) {
        players.forEach((player, idx) => drawBird(player, idx));
      }
      drawLobbyScreen();
    } else {
      // In playing or ended, render pipes and birds strictly from state
      drawPipes(pipes);
      players.forEach((player, idx) => drawBird(player, idx));

      if (status === 'ended') {
        drawEndedBanner();
      }
    }

    requestAnimationFrame(render);
  }

  // Initialize
  loadJoinInfo();
  updateDOM(gameState);
  requestAnimationFrame(render);
})();
