(function() {
  'use strict';

  // DOM Elements
  const connectionBanner = document.getElementById('connection-banner');
  const joinScreen = document.getElementById('join-screen');
  const joinForm = document.getElementById('join-form');
  const playerNameInput = document.getElementById('player-name-input');
  const joinButton = document.getElementById('join-button');

  const controllerScreen = document.getElementById('controller-screen');
  const playerAvatar = document.getElementById('player-avatar');
  const playerNameDisplay = document.getElementById('player-name-display');
  const playerRoleBadge = document.getElementById('player-role-badge');
  const gameStatusBadge = document.getElementById('game-status-badge');

  const hostPanel = document.getElementById('host-panel');
  const startRoundBtn = document.getElementById('start-round-btn');
  const restartRoundBtn = document.getElementById('restart-round-btn');

  const flapButton = document.getElementById('flap-button');
  const eliminatedOverlay = document.getElementById('eliminated-overlay');
  const eliminatedDesc = document.getElementById('eliminated-desc');
  const winnerOverlay = document.getElementById('winner-overlay');
  const gameOverOverlay = document.getElementById('game-over-overlay');
  const gameOverDesc = document.getElementById('game-over-desc');

  // Player State
  let myPlayerId = null;
  let myPlayerName = '';
  let myColor = '#007aff';
  let isHost = false;
  let isEliminated = false;
  let lastFlapTime = 0;
  const MIN_FLAP_INTERVAL_MS = 25; // Debounce synthetic duplicate events while allowing rapid tapping

  // Initialize Socket.io
  const socket = (typeof io === 'function') ? io() : null;

  if (socket) {
    socket.on('connect', () => {
      if (connectionBanner) connectionBanner.classList.add('hidden');
    });

    socket.on('disconnect', () => {
      if (connectionBanner) connectionBanner.classList.remove('hidden');
    });

    socket.on('connect_error', () => {
      if (connectionBanner) connectionBanner.classList.remove('hidden');
    });

    socket.on('joined', (playerInfo) => {
      handleJoined(playerInfo);
    });

    socket.on('state', (state) => {
      handleStateUpdate(state);
    });
  }

  // Handle successful join
  function handleJoined(playerInfo) {
    if (!playerInfo) return;

    myPlayerId = playerInfo.id;
    myColor = playerInfo.color || '#007aff';
    isHost = Boolean(playerInfo.isHost);

    // Apply color theme
    document.documentElement.style.setProperty('--player-color', myColor);
    if (playerAvatar) {
      playerAvatar.style.backgroundColor = myColor;
      playerAvatar.style.boxShadow = `0 0 12px ${myColor}`;
    }
    if (flapButton) {
      flapButton.style.borderColor = myColor;
    }
    if (playerNameDisplay) {
      playerNameDisplay.textContent = myPlayerName || playerInfo.name || 'Player';
    }
    if (playerRoleBadge) {
      playerRoleBadge.textContent = isHost ? 'HOST CONTROLLER' : 'PLAYER';
      playerRoleBadge.style.color = isHost ? '#ffcc00' : myColor;
    }

    if (isHost && hostPanel) {
      hostPanel.classList.remove('hidden');
    }

    // Switch screen
    joinScreen.classList.remove('active');
    joinScreen.classList.add('hidden');

    controllerScreen.classList.remove('hidden');
    controllerScreen.classList.add('active');
  }

  // Join form submission
  if (joinForm) {
    joinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const rawName = playerNameInput ? playerNameInput.value.trim() : '';
      myPlayerName = rawName || 'Player';

      if (joinButton) {
        joinButton.disabled = true;
        joinButton.textContent = 'CONNECTING...';
      }

      if (socket) {
        socket.emit('join', { name: myPlayerName }, (playerInfo) => {
          if (playerInfo) {
            handleJoined(playerInfo);
          }
        });
      }
    });
  }

  // Rapid tap handling for flap
  function triggerFlap(e) {
    if (e && e.cancelable) {
      e.preventDefault();
    }

    if (!myPlayerId || isEliminated) return;

    const now = performance.now();
    if (now - lastFlapTime < MIN_FLAP_INTERVAL_MS) {
      return;
    }
    lastFlapTime = now;

    // Send flap event to server
    if (socket) {
      socket.emit('flap');
    }

    // Visual feedback
    if (flapButton) {
      flapButton.classList.add('pressed');
      setTimeout(() => {
        flapButton.classList.remove('pressed');
      }, 70);
    }

    // Haptic feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(10);
      } catch (_) {}
    }
  }

  if (flapButton) {
    flapButton.addEventListener('pointerdown', triggerFlap);
    flapButton.addEventListener('pointerup', () => flapButton.classList.remove('pressed'));
    flapButton.addEventListener('pointercancel', () => flapButton.classList.remove('pressed'));
    flapButton.addEventListener('pointerleave', () => flapButton.classList.remove('pressed'));
  }

  // Host buttons
  if (startRoundBtn) {
    startRoundBtn.addEventListener('click', () => {
      if (socket && isHost) {
        socket.emit('startRound');
      }
    });
  }

  if (restartRoundBtn) {
    restartRoundBtn.addEventListener('click', () => {
      if (socket && isHost) {
        socket.emit('restart');
      }
    });
  }

  // Process game state updates from server
  function handleStateUpdate(state) {
    if (!state) return;

    const status = state.status || 'lobby';

    // Update status badge
    if (gameStatusBadge) {
      gameStatusBadge.textContent = status.toUpperCase();
      gameStatusBadge.className = `status-badge status-${status}`;
    }

    // Update host panel buttons
    if (isHost && hostPanel) {
      hostPanel.classList.remove('hidden');
      if (status === 'lobby') {
        if (startRoundBtn) startRoundBtn.classList.remove('hidden');
        if (restartRoundBtn) restartRoundBtn.classList.add('hidden');
      } else if (status === 'ended') {
        if (startRoundBtn) startRoundBtn.classList.add('hidden');
        if (restartRoundBtn) restartRoundBtn.classList.remove('hidden');
      } else {
        if (startRoundBtn) startRoundBtn.classList.add('hidden');
        if (restartRoundBtn) restartRoundBtn.classList.add('hidden');
      }
    }

    // Find current player in state
    const me = Array.isArray(state.players)
      ? state.players.find(p => p.id === myPlayerId)
      : null;

    const amEliminated = (Array.isArray(state.eliminated) && state.eliminated.includes(myPlayerId)) ||
      (me && me.alive === false);

    const amWinner = (status === 'ended' && state.winnerId === myPlayerId);

    // Overlays logic
    if (status === 'lobby') {
      isEliminated = false;
      if (eliminatedOverlay) eliminatedOverlay.classList.add('hidden');
      if (winnerOverlay) winnerOverlay.classList.add('hidden');
      if (gameOverOverlay) gameOverOverlay.classList.add('hidden');
    } else if (status === 'playing') {
      if (winnerOverlay) winnerOverlay.classList.add('hidden');
      if (gameOverOverlay) gameOverOverlay.classList.add('hidden');

      if (amEliminated) {
        isEliminated = true;
        if (eliminatedOverlay) {
          eliminatedOverlay.classList.remove('hidden');
          if (eliminatedDesc) {
            eliminatedDesc.textContent = 'You hit an obstacle! Spectating the live race.';
          }
        }
      } else {
        isEliminated = false;
        if (eliminatedOverlay) eliminatedOverlay.classList.add('hidden');
      }
    } else if (status === 'ended') {
      if (amWinner) {
        isEliminated = false;
        if (eliminatedOverlay) eliminatedOverlay.classList.add('hidden');
        if (gameOverOverlay) gameOverOverlay.classList.add('hidden');
        if (winnerOverlay) winnerOverlay.classList.remove('hidden');
      } else if (amEliminated) {
        const winner = Array.isArray(state.players) && state.winnerId
          ? state.players.find(p => p.id === state.winnerId)
          : null;

        if (eliminatedOverlay) {
          eliminatedOverlay.classList.remove('hidden');
          if (eliminatedDesc) {
            eliminatedDesc.textContent = winner
              ? `${winner.name} won the championship!`
              : 'Round ended!';
          }
        }
      } else {
        if (eliminatedOverlay) eliminatedOverlay.classList.add('hidden');
        if (winnerOverlay) winnerOverlay.classList.add('hidden');
        if (gameOverOverlay) {
          gameOverOverlay.classList.remove('hidden');
          const winner = Array.isArray(state.players) && state.winnerId
            ? state.players.find(p => p.id === state.winnerId)
            : null;
          if (gameOverDesc) {
            gameOverDesc.textContent = winner
              ? `${winner.name} took the crown!`
              : 'Round ended!';
          }
        }
      }
    }
  }

  // Export for testing in Node / mock environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      handleJoined,
      handleStateUpdate,
      triggerFlap,
    };
  }
})();
