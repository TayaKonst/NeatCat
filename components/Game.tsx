'use client';

import { useEffect, useRef, useCallback } from 'react';

const CW = 1200;
const CH = 600;
const GRAVITY = 0.4;
const JUMP_POWER = -10;
const SPEED = 5;
const ITEM_SIZE = 50;
const FIREWORK_DURATION = 90;
const ERROR_DURATION = 70;
const FIREWORK_SIZE = 200 * 1.5;

interface Rect { x: number; y: number; width: number; height: number; }
interface Cat extends Rect { dy: number; dx: number; speed: number; onGround: boolean; sliding: boolean; }
interface Item extends Rect {
  img: HTMLImageElement;
  room: string;
  held: boolean;
  placed: boolean;
  originalX: number;
  originalY: number;
  dy: number;
  name: string;
}

// Coordinates calibrated to the painted house image (1217×807 → 884×600)
const ROOMS: Record<string, Rect> = {
  bathroom:     { x:  62, y: 149, width: 367, height: 107 },
  kitchen:      { x: 429, y: 149, width: 370, height: 107 },
  kids_room:    { x:  62, y: 256, width: 367, height: 138 },
  parents_room: { x: 429, y: 256, width: 370, height: 138 },
  living_room:  { x:  62, y: 394, width: 367, height: 197 },
  hall:         { x: 429, y: 394, width: 370, height: 197 },
};

const ROOM_LABELS: Record<string, string> = {
  bathroom:     'Bathroom',
  kitchen:      'Kitchen',
  kids_room:    "Kid's Room",
  parents_room: 'Bedroom',
  living_room:  'Living Room',
  hall:         'Hall',
};


const ITEM_SNAP: Record<string, { x: number; y: number }> = {
  toy:          { x: 130, y: 285 },
  tv:           { x: 130, y: 480 },
  rug:          { x: 230, y: 540 },
  refrigerator: { x: 490, y: 170 },
  shoes:        { x: 480, y: 490 },
  komod:        { x: 560, y: 490 },
  picture:      { x: 590, y: 280 },
  fruits:       { x: 580, y: 170 },
  sink:         { x: 130, y: 170 },
  soap:         { x: 210, y: 170 },
  closet:       { x: 230, y: 280 },
  chair:        { x: 200, y: 480 },
};

const PLATFORMS: Rect[] = [
  { x: 62, y: 256, width: 737, height: 10 }, // upper floor
  { x: 62, y: 394, width: 737, height: 10 }, // mid floor
  { x: 62, y: 588, width: 737, height: 10 }, // ground
  ...Array.from({ length: 6 }, (_, i) => ({ x: 950, y: 100 + i * 90, width: 200, height: 10 })),
];

function loadImg(src: string) {
  const img = new Image();
  img.src = src;
  return img;
}

function collides(a: Rect & { dy?: number }, b: Rect) {
  const dy = a.dy ?? 0;
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height + dy >= b.y
  );
}

function playError() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.35);
    gain.gain.setValueAtTime(0.25, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.35);
    osc.start();
    osc.stop(ac.currentTime + 0.35);
  } catch { /* ignore */ }
}

function playSuccess() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, ac.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.1 + 0.25);
      osc.start(ac.currentTime + i * 0.1);
      osc.stop(ac.currentTime + i * 0.1 + 0.25);
    });
  } catch { /* ignore */ }
}

function makeItems(): Item[] {
  return [
    { name: 'toy',          room: 'kids_room',    x: 950,  y: 100 },
    { name: 'tv',           room: 'living_room',  x: 950,  y: 190 },
    { name: 'rug',          room: 'living_room',  x: 950,  y: 280 },
    { name: 'refrigerator', room: 'kitchen',      x: 950,  y: 370 },
    { name: 'shoes',        room: 'hall',         x: 1080, y: 100 },
    { name: 'komod',        room: 'hall',         x: 1080, y: 190 },
    { name: 'picture',      room: 'parents_room', x: 1080, y: 280 },
    { name: 'fruits',       room: 'kitchen',      x: 1080, y: 370 },
    { name: 'sink',         room: 'bathroom',     x: 950,  y: 460 },
    { name: 'soap',         room: 'bathroom',     x: 1080, y: 460 },
    { name: 'closet',       room: 'kids_room',    x: 950,  y: 550 },
    { name: 'chair',        room: 'living_room',  x: 1080, y: 550 },
  ].map(d => ({
    ...d,
    width: ITEM_SIZE, height: ITEM_SIZE,
    img: loadImg(`/${d.name}.png`),
    held: false, placed: false,
    originalX: d.x, originalY: d.y,
    dy: 0,
  }));
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stateRef = useRef({
    cat: {
      x: 300, y: 530,
      width: 50, height: 70,
      dy: 0, dx: 0, speed: SPEED,
      onGround: false, sliding: false,
    } as Cat,
    items: [] as Item[],
    imgs: {} as Record<string, HTMLImageElement>,
    fwVisible: false, fwTimer: 0,
    errVisible: false, errTimer: 0, errX: 0, errY: 0,
    won: false,
    raf: 0,
    winBox: { x: 0, y: 0, w: 0, h: 0 },
  });

  const restart = useCallback(() => {
    const s = stateRef.current;
    s.won = false;
    s.fwVisible = false;
    s.errVisible = false;
    s.items.forEach(item => {
      item.x = item.originalX;
      item.y = item.originalY;
      item.held = false;
      item.placed = false;
      item.dy = 0;
    });
    Object.assign(s.cat, {
      x: 300, y: 530,
      dx: 0, dy: 0, onGround: false, sliding: false,
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const s = stateRef.current;

    s.imgs = {
      cat:      loadImg('/cat.png'),
      house:    loadImg('/house.png'),
      shelves:  loadImg('/shelves.png'),
      firework: loadImg('/firework.png'),
    };
    s.items = makeItems();

    // ── draw ─────────────────────────────────────────────────────────────────

    function drawBg() {
      ctx.drawImage(s.imgs.house, 0, 0, CW - 316, CH);
      ctx.drawImage(s.imgs.shelves, CW - 316, 0, 316, CH);

      // Room name labels on the painted floors
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      for (const [name, r] of Object.entries(ROOMS)) {
        const lx = r.x + r.width / 2;
        const ly = r.y + r.height - 8; // near the bottom of each room (on the floor band)
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        const tw = ctx.measureText(ROOM_LABELS[name]).width;
        ctx.fillRect(lx - tw / 2 - 4, ly - 14, tw + 8, 18);
        ctx.fillStyle = '#1a0a3a';
        ctx.fillText(ROOM_LABELS[name], lx, ly);
      }
      ctx.textAlign = 'left';
    }

    function drawCross(x: number, y: number, alpha: number) {
      const sz = 28;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#ff2020';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - sz, y - sz); ctx.lineTo(x + sz, y + sz);
      ctx.moveTo(x + sz, y - sz); ctx.lineTo(x - sz, y + sz);
      ctx.stroke();

      // Circle outline
      ctx.strokeStyle = '#ff6060';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, sz + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawWin() {
      ctx.save();
      ctx.fillStyle = 'rgba(10, 10, 40, 0.72)';
      ctx.fillRect(0, 0, CW, CH);

      const bw = 440, bh = 210;
      const bx = (CW - bw) / 2, by = (CH - bh) / 2;

      ctx.fillStyle = '#fffde8';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 18);
      ctx.fill();

      ctx.strokeStyle = '#f0c030';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 18);
      ctx.stroke();

      ctx.fillStyle = '#222';
      ctx.font = 'bold 52px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('You Win! 🎉', CW / 2, by + 88);

      ctx.fillStyle = '#666';
      ctx.font = '17px sans-serif';
      ctx.fillText('Press R  or  tap to play again', CW / 2, by + 130);

      ctx.restore();
      s.winBox = { x: bx, y: by, w: bw, h: bh };
    }

    function render() {
      ctx.clearRect(0, 0, CW, CH);
      drawBg();

      ctx.drawImage(s.imgs.cat, s.cat.x, s.cat.y, s.cat.width, s.cat.height);

      s.items.forEach(item => {
        ctx.drawImage(item.img, item.x, item.y, item.width, item.height);
      });

      if (s.fwVisible) {
        ctx.save();
        ctx.shadowBlur = 24;
        ctx.shadowColor = 'rgba(255,210,0,0.9)';
        ctx.drawImage(s.imgs.firework, (CW - FIREWORK_SIZE) / 2, (CH - FIREWORK_SIZE) / 2, FIREWORK_SIZE, FIREWORK_SIZE);
        ctx.restore();
      }

      if (s.errVisible) {
        drawCross(s.errX, s.errY, s.errTimer / ERROR_DURATION);
      }

      if (s.won) drawWin();
    }

    // ── update ────────────────────────────────────────────────────────────────

    function updateCat() {
      const c = s.cat;
      if (!c.sliding) c.dy += GRAVITY;
      c.y += c.dy;
      c.x += c.dx;

      c.onGround = false;
      PLATFORMS.forEach(p => {
        if (collides(c, p)) {
          if (!c.sliding) {
            c.y = p.y - c.height;
            c.dy = 0;
            c.onGround = true;
          }
        }
      });

      if (c.y + c.height > CH) { c.y = CH - c.height; c.dy = 0; c.onGround = true; }
      c.x = Math.max(0, Math.min(c.x, CW - c.width));
    }

    function updateItems() {
      s.items.forEach(item => {
        if (item.placed) return;
        if (item.held) {
          item.x = s.cat.x;
          item.y = s.cat.y - item.height;
        } else {
          item.dy += GRAVITY;
          item.y += item.dy;
          PLATFORMS.forEach(p => {
            if (collides(item, p)) { item.y = p.y - item.height; item.dy = 0; }
          });
          item.y = Math.min(item.y, CH - item.height);
          item.x = Math.max(0, Math.min(item.x, CW - item.width));
        }
      });

      if (s.fwVisible) {
        s.fwTimer--;
        if (s.fwTimer <= 0) {
          s.fwVisible = false;
          if (s.items.every(i => i.placed)) s.won = true;
        }
      }

      if (s.errVisible) {
        s.errTimer--;
        if (s.errTimer <= 0) s.errVisible = false;
      }
    }

    // ── placement ─────────────────────────────────────────────────────────────

    function tryPlace(item: Item) {
      for (const [room, r] of Object.entries(ROOMS)) {
        const inside =
          item.x > r.x && item.x + item.width < r.x + r.width &&
          item.y > r.y && item.y + item.height < r.y + r.height;
        if (!inside) continue;

        if (item.room === room) {
          const snap = ITEM_SNAP[item.name];
          if (snap) { item.x = snap.x; item.y = snap.y; }
          item.placed = true;
          s.fwVisible = true;
          s.fwTimer = FIREWORK_DURATION;
          playSuccess();
        } else {
          s.errVisible = true;
          s.errTimer = ERROR_DURATION;
          s.errX = item.x + item.width / 2;
          s.errY = item.y + item.height / 2;
          playError();
          item.x = item.originalX;
          item.y = item.originalY;
          item.dy = 0;
        }
        return;
      }
      // Dropped outside any room — return to shelf
      item.x = item.originalX;
      item.y = item.originalY;
      item.dy = 0;
    }

    function pickupOrDrop() {
      if (s.won) return;
      const held = s.items.find(i => i.held);
      if (held) {
        held.held = false;
        held.dy = 0;
        tryPlace(held);
      } else {
        for (const item of s.items) {
          if (!item.placed && collides(s.cat, item)) {
            item.held = true;
            item.dy = 0;
            break;
          }
        }
      }
    }

    // ── input ─────────────────────────────────────────────────────────────────

    function onKeyDown(e: KeyboardEvent) {
      if (s.won) { if (e.code === 'KeyR') restart(); return; }
      if (e.code === 'ArrowLeft')  s.cat.dx = -SPEED;
      else if (e.code === 'ArrowRight') s.cat.dx = SPEED;
      else if (e.code === 'ArrowDown') { s.cat.sliding = true; s.cat.dy = SPEED; }
      else if (e.code === 'Space' && s.cat.onGround) { s.cat.dy = JUMP_POWER; s.cat.onGround = false; }
      else if (e.code === 'KeyE') pickupOrDrop();
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') s.cat.dx = 0;
      if (e.code === 'ArrowDown') { s.cat.sliding = false; s.cat.dy = 0; }
    }

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      if (s.won) { restart(); return; }
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const tx = (t.clientX - rect.left) * (CW / rect.width);

      if (tx < CW / 3) s.cat.dx = -SPEED;
      else if (tx > (CW * 2) / 3) s.cat.dx = SPEED;
      else if (s.cat.onGround) { s.cat.dy = JUMP_POWER; s.cat.onGround = false; }
      else pickupOrDrop();
    }

    function onTouchEnd() { s.cat.dx = 0; }

    function onClick(e: MouseEvent) {
      if (!s.won) return;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (CW / rect.width);
      const my = (e.clientY - rect.top) * (CH / rect.height);
      const b = s.winBox;
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) restart();
    }

    // ── loop ──────────────────────────────────────────────────────────────────

    function loop() {
      if (!s.won) { updateCat(); updateItems(); }
      render();
      s.raf = requestAnimationFrame(loop);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('click', onClick);
    s.raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(s.raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('click', onClick);
    };
  }, [restart]);

  return (
    <div style={{ padding: '12px' }}>
      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        style={{
          display: 'block',
          maxWidth: '100%',
          border: '3px solid #444',
          borderRadius: 10,
          cursor: 'pointer',
          touchAction: 'none',
        }}
      />
      <p style={{
        color: '#aaa', fontSize: 13, textAlign: 'center', marginTop: 8, fontFamily: 'sans-serif',
      }}>
        Arrow keys to move · Space to jump · E to pick up / drop
      </p>
    </div>
  );
}
