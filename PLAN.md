# vIRTUAL

We are building Flappy Royale: a Node.js + Socket.io server running the authoritative game loop for up to 8 colored birds, a big-screen HTML5 Canvas display that shows the shared race and QR code, and a mobile-web controller page that phones use to join over the host's LAN hotspot and tap-to-flap. The server module (server/game.js) owns all physics/collision/elimination logic; the two front-ends (display + controller) are thin Socket.io clients that render whatever state the server broadcasts.

Stack: Node.js (>=18) + Express + Socket.io for the server/game loop; vanilla HTML5 Canvas + JS for the big-screen display; vanilla mobile-web HTML/JS for the controller page; qrcode npm package for the join QR; Node's built-in test runner (node --test) + socket.io-client for tests. Run with `npm install` then `npm start`, open http://localhost:3000/display.html on the big screen and scan the QR on phon…

Verification: `npm test`

| Task | Title | Owner | Files | Depends on |
|---|---|---|---|---|
| T1 | Server scaffold, entry point & wiring | KAUSTUBH | package.json, server/index.js, .env.example, .gitignore | - |
| T2 | Game physics, state & elimination logic | HamzaShaikh-source | server/game.js, server/pipes.js | - |
| T3 | Big-screen display front-end | KAUSTUBH | public/display.html, public/display.js, public/style-display.css | - |
| T4 | Mobile controller page | HamzaShaikh-source | public/controller.html, public/controller.js, public/style-controller.css | - |
| T5 | QR join info & host keyboard controls | KAUSTUBH | server/qrcode.js, public/host-controls.js | - |
| T6 | Unit tests for GameRoom physics/elimination | KAUSTUBH | tests/game.test.js | T2 |
| T7 | Integration smoke test (server + sockets) | HamzaShaikh-source | tests/integration.test.js | T1, T2 |
| T8 | README and project documentation | HamzaShaikh-source | README.md | - |
