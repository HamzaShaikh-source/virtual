const os = require('os');
const QRCode = require('qrcode');

/**
 * Detect the host machine's LAN IPv4 address.
 * @returns {string}
 */
function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

/**
 * Generates the join URL and base64 QR code data URL.
 *
 * @param {number} [port=3000] - Server listening port
 * @returns {Promise<{url: string, qrDataUrl: string}>}
 */
async function getJoinInfo(port = 3000) {
  const lanIp = getLanIp();
  const url = `http://${lanIp}:${port}/controller.html`;
  const qrDataUrl = await QRCode.toDataURL(url);
  return {
    url,
    qrDataUrl
  };
}

module.exports = getJoinInfo;
module.exports.getJoinInfo = getJoinInfo;
module.exports.getLanIp = getLanIp;
module.exports.default = getJoinInfo;
