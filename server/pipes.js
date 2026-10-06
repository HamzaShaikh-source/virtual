/**
 * Generates deterministic pipe obstacles for Flappy Royale.
 *
 * @param {number} [seed=12345] - Deterministic PRNG seed
 * @param {number} [count=100] - Number of pipes to generate
 * @returns {Array<{x: number, gapY: number, gapHeight: number}>}
 */

const DEFAULT_PIPE_COUNT = 100;
const PIPE_START_X = 600;
const PIPE_SPACING = 250;
const DEFAULT_GAP_HEIGHT = 140;
const MIN_GAP_Y = 80;
const MAX_GAP_Y = 360;

function createPrng(seed) {
  let s = (seed !== undefined && seed !== null && !Number.isNaN(Number(seed)))
    ? (Number(seed) >>> 0 || 12345)
    : 12345;

  return function() {
    // Mulberry32 32-bit PRNG
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generatePipes(seed = 12345, count = DEFAULT_PIPE_COUNT) {
  const prng = createPrng(seed);
  const pipes = [];

  for (let i = 0; i < count; i++) {
    const x = PIPE_START_X + i * PIPE_SPACING;
    const gapHeight = DEFAULT_GAP_HEIGHT;
    const gapY = Math.floor(MIN_GAP_Y + prng() * (MAX_GAP_Y - MIN_GAP_Y));
    pipes.push({ x, gapY, gapHeight });
  }

  return pipes;
}

module.exports = generatePipes;
module.exports.generatePipes = generatePipes;
module.exports.default = generatePipes;
