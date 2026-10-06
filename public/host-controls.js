// public/host-controls.js - Host keyboard controls and button wiring for Flappy Royale

(function () {
  'use strict';

  // Obtain or establish socket connection
  let socket = window.hostSocket || window.socket;
  if (!socket && typeof io === 'function') {
    socket = io();
  }
  window.hostSocket = socket;
  window.socket = socket;
  window.HOST_CONTROLS_LOADED = true;

  if (!socket) {
    console.warn('host-controls.js: Socket.io client not available.');
    return;
  }

  // Register host as a player upon connection
  function joinAsHost() {
    socket.emit('join', { name: 'Host' });
  }

  if (socket.connected) {
    joinAsHost();
  } else {
    socket.on('connect', joinAsHost);
  }

  // Keyboard controls: Space = flap, Enter = startRound, R = restart
  window.addEventListener('keydown', (e) => {
    // Avoid capturing inputs if user is typing in an input or textarea
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      return;
    }

    if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
      e.preventDefault();
      socket.emit('flap');
    } else if (e.code === 'Enter' || e.key === 'Enter' || e.keyCode === 13) {
      socket.emit('startRound');
    } else if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R') {
      socket.emit('restart');
    }
  });

  // Attach button click listeners (supports #btn-start, #start-btn, #btn-restart, #restart-btn)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = (btn.id || '').toLowerCase();
    const text = (btn.textContent || '').trim().toLowerCase();

    if (id === 'btn-start' || id === 'start-btn' || text.includes('start round') || text === 'start') {
      socket.emit('startRound');
    } else if (id === 'btn-restart' || id === 'restart-btn' || text.includes('restart')) {
      socket.emit('restart');
    }
  });
})();
