/**
 * বাপের রাস্তা · Baper Rasta Multiplayer Client Extension
 * Real-time WebSocket synchronization with 3D remote vehicles, interpolation,
 * Dhaka street nameplates, PvP bumping, off-screen edge compass radar,
 * and live minimap opponent blips.
 */

(function () {
  // Helper: Bengali digit conversion
  function toBengaliDigits(num) {
    const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(Math.round(num || 0)).replace(/[0-9]/g, d => bn[Number(d)]);
  }

  // Inject CSS styles for modal, nameplates, edge indicators, and multiplayer HUD
  const style = document.createElement('style');
  style.id = 'mp-styles';
  style.textContent = `
    /* Multiplayer Join Modal */
    #mp-join-overlay {
      position: fixed;
      inset: 0;
      background: rgba(10, 8, 6, 0.88);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: 'Anek Bangla', 'Tiro Bangla', sans-serif;
      animation: mpFadeIn 0.3s ease-out;
    }
    @keyframes mpFadeIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    .mp-modal-box {
      background: #1d1814;
      border: 3px solid #ffcb1f;
      border-radius: 18px;
      padding: 32px 28px;
      width: 90%;
      max-width: 440px;
      text-align: center;
      box-shadow: 0 16px 48px rgba(0,0,0,0.7), 0 0 24px rgba(255, 203, 31, 0.25);
      color: #f7efe0;
      position: relative;
    }
    .mp-modal-box h2 {
      margin: 0 0 8px 0;
      font-size: 26px;
      color: #ffcb1f;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font-family: 'Baloo Da 2', 'Anek Bangla', sans-serif;
    }
    .mp-modal-box p {
      margin: 0 0 24px 0;
      font-size: 15px;
      color: #d8cebc;
      line-height: 1.4;
    }
    .mp-input-wrap {
      margin-bottom: 22px;
      text-align: left;
    }
    .mp-input-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #ff3fa4;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }
    .mp-name-input {
      width: 100%;
      box-sizing: border-box;
      background: #110e0c;
      border: 2px solid #443a30;
      border-radius: 12px;
      padding: 14px 16px;
      font-size: 18px;
      color: #fff;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .mp-name-input:focus {
      border-color: #2ee6ff;
      box-shadow: 0 0 12px rgba(46, 230, 255, 0.35);
    }
    .mp-join-btn {
      width: 100%;
      background: linear-gradient(135deg, #ffcb1f 0%, #ff7b25 100%);
      color: #15110e;
      border: none;
      border-radius: 12px;
      padding: 15px;
      font-size: 19px;
      font-weight: 700;
      cursor: pointer;
      font-family: 'Baloo Da 2', inherit;
      box-shadow: 0 6px 18px rgba(255, 123, 37, 0.35);
      transition: transform 0.15s, filter 0.15s;
    }
    .mp-join-btn:hover {
      transform: translateY(-2px);
      filter: brightness(1.1);
    }
    .mp-join-btn:active {
      transform: translateY(1px);
    }

    /* Multiplayer HUD Widget - Positioned safely on TOP-LEFT under National Loss counter,
       leaving the TOP-RIGHT minimap and battery completely clear and visible! */
    #mp-hud {
      position: fixed;
      top: calc(env(safe-area-inset-top, 0px) + 78px);
      left: 14px;
      right: auto;
      z-index: 99990;
      pointer-events: none;
      font-family: 'Anek Bangla', 'Tiro Bangla', sans-serif;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 7px;
      max-width: 220px;
    }
    @media (max-width: 640px) {
      #mp-hud {
        top: calc(env(safe-area-inset-top, 0px) + 64px);
        left: 10px;
        max-width: 180px;
      }
    }

    .mp-badge-pill, .mp-radar-tracker {
      pointer-events: auto;
    }

    .mp-badge-pill {
      background: rgba(21, 17, 14, 0.88);
      border: 1.5px solid #2ee6ff;
      border-radius: 20px;
      padding: 5px 13px;
      font-size: 12.5px;
      font-weight: bold;
      color: #2ee6ff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.55);
      display: flex;
      align-items: center;
      gap: 7px;
      backdrop-filter: blur(4px);
    }
    .mp-badge-dot {
      width: 9px;
      height: 9px;
      background: #24d05a;
      border-radius: 50%;
      box-shadow: 0 0 8px #24d05a;
      animation: mpPulse 1.5s infinite;
    }
    @keyframes mpPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.35; transform: scale(0.85); }
    }

    /* Nearest Opponent Live Compass Radar Bar */
    .mp-radar-tracker {
      background: rgba(20, 16, 13, 0.9);
      border: 1.5px solid #ff7b25;
      border-radius: 12px;
      padding: 6px 10px;
      width: 100%;
      box-sizing: border-box;
      color: #f7efe0;
      box-shadow: 0 6px 16px rgba(0,0,0,0.6);
      backdrop-filter: blur(5px);
      display: none;
      align-items: center;
      gap: 8px;
      transition: border-color 0.2s;
    }
    .mp-radar-dial {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.5);
      border: 1.5px solid #ffcb1f;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 0 8px rgba(255, 203, 31, 0.35);
    }
    .mp-radar-needle {
      font-size: 14px;
      color: #ffcb1f;
      font-weight: 900;
      display: inline-block;
      line-height: 1;
      transform-origin: center center;
      transition: transform 0.08s linear;
    }
    .mp-radar-info {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      line-height: 1.25;
    }
    .mp-radar-title {
      font-size: 10px;
      font-weight: 700;
      color: #ffcb1f;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .mp-radar-opp {
      font-size: 11.5px;
      font-weight: 700;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 135px;
    }
    .mp-radar-dist {
      font-size: 10.5px;
      color: #2ee6ff;
      font-weight: 700;
    }


    /* 3D Floating Nameplate Above Vehicle */
    .mp-nameplate {
      position: absolute;
      top: 0;
      left: 0;
      transform: translate(-50%, -100%);
      pointer-events: none;
      z-index: 9990;
      white-space: nowrap;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: opacity 0.2s;
    }
    .mp-nameplate-box {
      background: rgba(18, 14, 12, 0.92);
      border: 1.5px solid #ffcb1f;
      border-radius: 8px;
      padding: 2px 8px;
      color: #f7efe0;
      font-size: 12px;
      font-weight: bold;
      font-family: 'Baloo Da 2', 'Anek Bangla', sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .mp-nameplate-arrow {
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 5px solid #ffcb1f;
    }

    /* Off-Screen Edge Direction Radar Indicators */
    #mp-edge-indicators {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 99985;
      overflow: hidden;
    }
    .mp-edge-marker {
      position: absolute;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: opacity 0.15s ease-out;
      filter: drop-shadow(0 4px 10px rgba(0,0,0,0.85));
    }
    .mp-edge-arrow {
      width: 0;
      height: 0;
      border-top: 7px solid transparent;
      border-bottom: 7px solid transparent;
      border-left: 12px solid #ffcb1f;
      flex-shrink: 0;
      filter: drop-shadow(0 0 5px rgba(255, 203, 31, 0.8));
    }
    .mp-edge-badge {
      background: rgba(16, 12, 10, 0.92);
      border: 1.8px solid #ffcb1f;
      border-radius: 16px;
      padding: 3px 9px 3px 7px;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
      box-shadow: 0 0 12px rgba(0,0,0,0.6);
      font-family: 'Anek Bangla', 'Baloo Da 2', sans-serif;
    }
    .mp-edge-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #ffcb1f;
      flex-shrink: 0;
    }
    .mp-edge-dist-tag {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      padding: 1px 5px;
      font-size: 10px;
      font-weight: 800;
      color: #2ee6ff;
    }

    /* Toast notification */
    .mp-toast {
      position: fixed;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(17, 14, 12, 0.92);
      border: 1.5px solid #2ee6ff;
      color: #fff;
      padding: 8px 18px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      z-index: 99999;
      pointer-events: none;
      box-shadow: 0 8px 24px rgba(0,0,0,0.7);
      animation: mpToastAnim 3s forwards ease-in-out;
    }
    @keyframes mpToastAnim {
      0% { opacity: 0; transform: translate(-50%, 15px); }
      15% { opacity: 1; transform: translate(-50%, 0); }
      80% { opacity: 1; transform: translate(-50%, 0); }
      100% { opacity: 0; transform: translate(-50%, -15px); }
    }
  `;
  document.head.appendChild(style);

  // Multiplayer Client State
  let ws = null;
  let myId = null;
  let myName = localStorage.getItem('baper_rasta_driver_name') || '';
  let myColor = '#ffcb1f';
  const remotePlayers = new Map(); // id -> { data, obj, badgeEl, currentX, currentZ, currentYaw, ... }
  let lastSyncTime = 0;
  let hudContainer = null;
  let nameplateContainer = null;
  let edgeContainer = null;
  let bumpCooldown = 0;

  // Wait for game engine ready
  function waitForGame(cb) {
    const timer = setInterval(() => {
      if (window.__at && window.__at.P && window.__at.SCENE && window.__at.CAM && window.__at.zs) {
        clearInterval(timer);
        cb(window.__at);
      }
    }, 100);
  }

  // Show Join Modal if name is not set, or let user confirm/change name
  function showJoinModal(onJoin) {
    const existing = document.getElementById('mp-join-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'mp-join-overlay';
    overlay.innerHTML = `
      <div class="mp-modal-box">
        <h2>🛺 বাপের রাস্তা মাল্টিপ্লেয়ার</h2>
        <p>ঢাকার রাজপথে লাইভ অটোরিকশা চালান। অন্যান্য চালকদের সাথে ধাক্কাধাক্কি আর জাতীয় ক্ষতি বাড়ান!</p>
        <div class="mp-input-wrap">
          <label class="mp-input-label">আপনার চালকের নাম (Driver Name)</label>
          <input type="text" id="mp-name-input" class="mp-name-input" maxlength="15" placeholder="যেমন: ড্রাইভার জিসান" value="${myName || ''}" autocomplete="off" />
        </div>
        <button id="mp-join-btn" class="mp-join-btn">রাস্তায় নামুন 🚦</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById('mp-name-input');
    const btn = document.getElementById('mp-join-btn');
    input.focus();
    input.select();

    function doJoin() {
      let chosenName = input.value.trim();
      if (!chosenName) {
        chosenName = 'ড্রাইভার ' + Math.floor(100 + Math.random() * 900);
      }
      myName = chosenName;
      localStorage.setItem('baper_rasta_driver_name', myName);
      overlay.style.transition = 'opacity 0.25s, transform 0.25s';
      overlay.style.opacity = '0';
      overlay.style.transform = 'scale(0.95)';
      setTimeout(() => overlay.remove(), 250);
      onJoin(myName);
    }

    btn.addEventListener('click', doJoin);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doJoin();
    });
  }

  // Toast notification
  function showToast(text, color = '#2ee6ff') {
    const toast = document.createElement('div');
    toast.className = 'mp-toast';
    toast.style.borderColor = color;
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3100);
  }

  // Setup HUD: Positioned cleanly on TOP-LEFT, completely leaving minimap on top-right untouched!
  function initHud() {
    hudContainer = document.createElement('div');
    hudContainer.id = 'mp-hud';
    hudContainer.innerHTML = `
      <div class="mp-badge-pill">
        <span class="mp-badge-dot"></span>
        <span id="mp-online-text">১ জন লাইভ</span>
      </div>

      <div class="mp-radar-tracker" id="mp-radar-tracker">
        <div class="mp-radar-dial" id="mp-radar-dial">
          <span class="mp-radar-needle" id="mp-tracker-compass">▲</span>
        </div>
        <div class="mp-radar-info">
          <span class="mp-radar-title">📍 নিকটতম প্রতিপক্ষ</span>
          <span class="mp-radar-opp" id="mp-tracker-name">খোঁজা হচ্ছে...</span>
          <span class="mp-radar-dist" id="mp-tracker-dist">০০মি</span>
        </div>
      </div>
    `;
    document.body.appendChild(hudContainer);

    // Container for 3D In-World Nameplates
    nameplateContainer = document.createElement('div');
    nameplateContainer.id = 'mp-nameplates';
    nameplateContainer.style.position = 'fixed';
    nameplateContainer.style.inset = '0';
    nameplateContainer.style.pointerEvents = 'none';
    nameplateContainer.style.zIndex = '9990';
    document.body.appendChild(nameplateContainer);

    // Container for Screen-Edge Direction Indicators (when opponents are off-screen)
    edgeContainer = document.createElement('div');
    edgeContainer.id = 'mp-edge-indicators';
    document.body.appendChild(edgeContainer);
  }

  // Update Online Player Count
  function updateOnlineCount() {
    if (!hudContainer) return;
    const onlineEl = document.getElementById('mp-online-text');
    if (!onlineEl) return;
    const totalDrivers = 1 + remotePlayers.size;
    onlineEl.textContent = `${totalDrivers} জন চালক লাইভ`;
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  function formatNumber(num) {
    return Number(num || 0).toLocaleString('en-US');
  }

  // Spawn a 3D auto-rickshaw for remote player
  function spawnRemoteRickshaw(player) {
    if (remotePlayers.has(player.id)) return;

    const game = window.__at;
    if (!game || !game.zs || !game.SCENE) return;

    // Build vehicle using game's built-in factory
    const vehicle = game.zs('auto', { looseWheel: true, film: true });
    vehicle.grp.rotation.order = 'YXZ';
    vehicle.grp.position.set(player.x || 0, 0, player.z || 0);
    vehicle.grp.rotation.set(0, player.yaw || 0, 0);

    // Add to Three.js scene
    game.SCENE.add(vehicle.grp);

    // Create 2D projected HTML nameplate badge (with live distance tag)
    const badge = document.createElement('div');
    badge.className = 'mp-nameplate';
    badge.innerHTML = `
      <div class="mp-nameplate-box" style="border-color: ${player.color || '#ffcb1f'}">
        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${player.color || '#ffcb1f'}; flex-shrink:0;"></span>
        <span class="mp-badge-name">${escapeHtml(player.name)}</span>
        <span class="mp-badge-dist" style="color: ${player.color || '#2ee6ff'}; font-size: 11px; margin-left: 2px;"></span>
      </div>
      <div class="mp-nameplate-arrow" style="border-top-color: ${player.color || '#ffcb1f'}"></div>
    `;
    nameplateContainer.appendChild(badge);

    const remoteEntry = {
      id: player.id,
      name: player.name,
      color: player.color,
      obj: vehicle,
      badgeEl: badge,
      // Current interpolated state
      currX: player.x || 0,
      currY: player.y || 0,
      currZ: player.z || 0,
      currYaw: player.yaw || 0,
      currPitch: player.pitch || 0,
      currRoll: player.roll || 0,
      // Target network state
      targetX: player.x || 0,
      targetY: player.y || 0,
      targetZ: player.z || 0,
      targetYaw: player.yaw || 0,
      targetPitch: player.pitch || 0,
      targetRoll: player.roll || 0,
      v: player.v || 0,
      steer: player.steer || 0,
      boost: player.boost || false,
      horn: player.horn || false,
      damage: player.damage || 0,
      alive: player.alive !== false,
      projPos: null
    };

    remotePlayers.set(player.id, remoteEntry);
    updateOnlineCount();
  }

  // Remove remote player
  function removeRemotePlayer(playerId) {
    const r = remotePlayers.get(playerId);
    if (!r) return;

    if (r.obj && r.obj.grp && window.__at && window.__at.SCENE) {
      window.__at.SCENE.remove(r.obj.grp);
    }
    if (r.badgeEl) {
      r.badgeEl.remove();
    }
    const edgeMarker = document.getElementById(`mp-edge-${playerId}`);
    if (edgeMarker) {
      edgeMarker.remove();
    }

    remotePlayers.delete(playerId);
    updateOnlineCount();
  }

  // Connect WebSocket to Python Server
  function connectWebSocket(driverName) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connected to Baper Rasta multiplayer server!');
      ws.send(JSON.stringify({ name: driverName }));
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        handleServerMessage(msg);
      } catch (e) {
        console.error('Failed to parse WS msg:', e);
      }
    };

    ws.onclose = () => {
      console.warn('Multiplayer disconnected. Reconnecting in 2s...');
      setTimeout(() => connectWebSocket(driverName), 2000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  // Handle incoming server messages
  function handleServerMessage(msg) {
    if (msg.type === 'welcome') {
      myId = msg.self.id;
      myColor = msg.self.color;
      showToast(`🚦 স্বাগতম, ${myName}! লাইভ সার্ভারে যুক্ত হয়েছেন।`, myColor);

      // Spawn all existing players
      for (const p of msg.players) {
        spawnRemoteRickshaw(p);
      }
      updateOnlineCount();

    } else if (msg.type === 'player_joined') {
      const p = msg.data;
      if (p.id !== myId) {
        spawnRemoteRickshaw(p);
        showToast(`🛺 ${p.name} রাস্তায় নেমেছেন!`, p.color);
        updateOnlineCount();
      }

    } else if (msg.type === 'player_left') {
      const p = msg.data;
      showToast(`👋 ${p.name} রাস্তা ছেড়েছেন`);
      removeRemotePlayer(p.id);

    } else if (msg.type === 'sync') {
      // High-frequency position sync
      const players = msg.players || [];
      for (const p of players) {
        if (p.id === myId) continue;
        let r = remotePlayers.get(p.id);
        if (!r) {
          spawnRemoteRickshaw(p);
          r = remotePlayers.get(p.id);
        }
        if (r) {
          r.targetX = p.x;
          r.targetY = p.y;
          r.targetZ = p.z;
          r.targetYaw = p.yaw;
          r.targetPitch = p.pitch;
          r.targetRoll = p.roll;
          r.v = p.v;
          r.steer = p.steer;
          r.damage = p.damage;
          r.alive = p.alive;

          if (p.horn && !r.horn) {
            triggerRemoteHorn(r);
          }
          r.horn = p.horn;
        }
      }
      updateOnlineCount();

    } else if (msg.type === 'remote_horn') {
      const d = msg.data;
      if (d && d.sender_id !== myId) {
        const r = remotePlayers.get(d.sender_id);
        if (r) triggerRemoteHorn(r);
      }

    } else if (msg.type === 'remote_crash') {
      const d = msg.data;
      if (window.__at && window.__at.FX && window.__at.sfx) {
        window.__at.sfx.crash(d.x, d.z, 1.0, 'metal');
        window.__at.FX.debris(d.x, 1, d.z, 15, 'player');
      }
    }
  }

  // Play remote horn sound
  function triggerRemoteHorn(r) {
    if (!window.__at || !window.__at.sfx || !window.__at.CAM) return;
    try {
      const cam = window.__at.CAM;
      const dist = Math.hypot(cam.position.x - r.currX, cam.position.z - r.currZ);
      if (dist < 80) {
        window.__at.sfx.bell && window.__at.sfx.bell();
      }
    } catch (e) {}
  }

  // Local horn detection
  let lastHornKey = false;
  function checkLocalHorn() {
    const isHorn = !!(window.He && (window.He.KeyH || window.He.Space));
    if (isHorn && !lastHornKey && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'event',
        name: 'remote_horn',
        data: { x: window.__at.P.x, z: window.__at.P.z }
      }));
    }
    lastHornKey = isHorn;
  }

  // =========================================================================
  // 1. LIVE MINIMAP OPPONENT BLIPS & RADAR ARROWS
  // =========================================================================
  function drawOpponentsOnMinimap() {
    const canvas = document.getElementById('minimap');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const game = window.__at;
    if (!game || !game.P) return;
    const b = game.P;
    if (typeof b.x !== 'number') return;

    const e = canvas.width;
    const n = e / 2;
    const ql = 200; // world radar radius
    const s = (n - 4) / ql;

    for (const [id, r] of remotePlayers.entries()) {
      if (!r.alive) continue;
      const dx = r.currX - b.x;
      const dz = r.currZ - b.z;
      const dist = Math.hypot(dx, dz);

      // Local player-relative coordinates (forward is UP)
      const mx = n + (dx * b.rx + dz * b.rz) * s;
      const my = n - (dx * b.fx + dz * b.fz) * s;

      const angleFromCenter = Math.atan2(my - n, mx - n);
      const radarR = n - 11;
      const isOffMap = Math.hypot(mx - n, my - n) > (radarR - 4);
      const col = r.color || '#ffcb1f';

      if (isOffMap) {
        // Clamped to perimeter with outward pointer chevron
        const bx = n + Math.cos(angleFromCenter) * radarR;
        const by = n + Math.sin(angleFromCenter) * radarR;

        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(angleFromCenter);

        ctx.fillStyle = col;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-6, -6);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-6, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Distance text on border
        ctx.save();
        ctx.font = 'bold 10px "Baloo Da 2", "Anek Bangla", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textR = radarR - 13;
        const tx = n + Math.cos(angleFromCenter) * textR;
        const ty = n + Math.sin(angleFromCenter) * textR;
        ctx.fillStyle = col;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        const distStr = `${toBengaliDigits(Math.round(dist))}মি`;
        ctx.strokeText(distStr, tx, ty);
        ctx.fillText(distStr, tx, ty);
        ctx.restore();

      } else {
        // On radar!
        // Sonar ripple pulse
        const pulse = (performance.now() % 1200) / 1200;
        ctx.save();
        ctx.beginPath();
        ctx.arc(mx, my, 5 + pulse * 7, 0, Math.PI * 2);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.8;
        ctx.globalAlpha = 0.85 * (1 - pulse);
        ctx.stroke();
        ctx.restore();

        // Opponent rickshaw heading arrow / triangle
        const relYaw = -(r.currYaw - b.yaw);
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(relYaw);

        ctx.fillStyle = col;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(6, 6);
        ctx.lineTo(0, 3);
        ctx.lineTo(-6, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Name label above blip
        ctx.save();
        ctx.font = 'bold 11px "Baloo Da 2", "Anek Bangla", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 3;
        ctx.strokeText(r.name || 'চালক', mx, my - 10);
        ctx.fillText(r.name || 'চালক', mx, my - 10);
        ctx.restore();
      }
    }
  }

  // Hook game's drawMap to ensure opponent dots are always drawn on top of roads
  function hookMinimap() {
    const game = window.__at;
    if (!game) return;
    if (game.drawMap && !game._mpHooked) {
      game._mpHooked = true;
      const orig = game.drawMap;
      game.drawMap = function () {
        orig.apply(this, arguments);
        drawOpponentsOnMinimap();
      };
    }
  }

  // =========================================================================
  // 2. NEAREST OPPONENT HUD COMPASS RADAR BAR
  // =========================================================================
  function updateNearestTracker(localP) {
    const trackerEl = document.getElementById('mp-radar-tracker');
    if (!trackerEl) return;

    if (remotePlayers.size === 0) {
      trackerEl.style.display = 'none';
      return;
    }

    let nearest = null;
    let minDist = Infinity;

    for (const [id, r] of remotePlayers.entries()) {
      if (!r.alive) continue;
      const dx = r.currX - localP.x;
      const dz = r.currZ - localP.z;
      const d = Math.hypot(dx, dz);
      if (d < minDist) {
        minDist = d;
        nearest = { r, dist: d, dx, dz };
      }
    }

    if (!nearest) {
      trackerEl.style.display = 'none';
      return;
    }

    trackerEl.style.display = 'flex';

    // Relative vehicle coordinates: rx is right, ry is forward
    const rx = nearest.dx * localP.rx + nearest.dz * localP.rz;
    const ry = nearest.dx * localP.fx + nearest.dz * localP.fz;
    // Compass angle (0deg is straight ahead UP)
    const compassAngle = Math.atan2(rx, ry) * (180 / Math.PI);

    const needle = document.getElementById('mp-tracker-compass');
    const nameEl = document.getElementById('mp-tracker-name');
    const distEl = document.getElementById('mp-tracker-dist');
    const dial = document.getElementById('mp-radar-dial');

    const col = nearest.r.color || '#ffcb1f';
    if (needle) {
      needle.style.transform = `rotate(${compassAngle}deg)`;
      needle.style.color = col;
    }
    if (dial) {
      dial.style.borderColor = col;
      dial.style.boxShadow = `0 0 10px ${col}66`;
    }
    if (nameEl) {
      nameEl.textContent = nearest.r.name;
    }
    if (distEl) {
      distEl.textContent = `${toBengaliDigits(Math.round(nearest.dist))} মিটার দূরত্বে`;
      distEl.style.color = col;
    }
    trackerEl.style.borderColor = col;
  }

  // =========================================================================
  // 3. SCREEN-EDGE DIRECTION INDICATORS (OFF-SCREEN OPPONENT COMPASS)
  // =========================================================================
  let tempCamVec = null;

  function updateEdgeIndicators(localP, cam) {
    if (!edgeContainer) return;
    if (!tempCamVec) tempCamVec = cam.position.clone();

    const w = window.innerWidth;
    const h = window.innerHeight;
    const halfW = w / 2;
    const halfH = h / 2;
    const margin = 42;

    const camMatInv = cam.matrixWorldInverse;

    for (const [id, r] of remotePlayers.entries()) {
      let marker = document.getElementById(`mp-edge-${id}`);
      if (!marker) {
        marker = document.createElement('div');
        marker.id = `mp-edge-${id}`;
        marker.className = 'mp-edge-marker';
        marker.innerHTML = `
          <div class="mp-edge-arrow"></div>
          <div class="mp-edge-badge">
            <span class="mp-edge-dot"></span>
            <span class="mp-edge-name"></span>
            <span class="mp-edge-dist-tag"></span>
          </div>
        `;
        edgeContainer.appendChild(marker);
      }

      if (!r.alive) {
        marker.style.display = 'none';
        continue;
      }

      // Check position in camera local coordinate space
      tempCamVec.set(r.currX, r.currY + 1.2, r.currZ);
      const worldDist = cam.position.distanceTo(tempCamVec);
      tempCamVec.applyMatrix4(camMatInv);

      // In Three.js camera space: -Z is forward, +Z is behind
      const isBehind = tempCamVec.z >= -0.5;

      // Project into normalized viewport [-1, 1]
      r.projPos = r.projPos || cam.position.clone();
      r.projPos.set(r.currX, r.currY + 1.2, r.currZ);
      r.projPos.project(cam);

      let sx = (r.projPos.x * 0.5 + 0.5) * w;
      let sy = (-(r.projPos.y * 0.5) + 0.5) * h;

      const isOffScreen = isBehind || sx < margin || sx > (w - margin) || sy < margin || sy > (h - margin);

      if (isOffScreen) {
        // Target is off-screen! Clamp along perimeter ray
        let dx, dy;
        if (isBehind) {
          dx = tempCamVec.x;
          dy = -tempCamVec.y; // invert Y for screen space
          if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) dy = 1;
        } else {
          dx = sx - halfW;
          dy = sy - halfH;
        }

        const angle = Math.atan2(dy, dx);
        const maxW = halfW - margin;
        const maxH = halfH - margin;
        const scale = Math.min(
          Math.abs(maxW / (Math.cos(angle) || 0.0001)),
          Math.abs(maxH / (Math.sin(angle) || 0.0001))
        );

        const edgeX = halfW + Math.cos(angle) * scale;
        const edgeY = halfH + Math.sin(angle) * scale;
        const deg = angle * (180 / Math.PI);

        marker.style.display = 'flex';
        marker.style.left = `${Math.round(edgeX)}px`;
        marker.style.top = `${Math.round(edgeY)}px`;

        if (edgeX > halfW) {
          marker.style.flexDirection = 'row-reverse';
          marker.style.transform = 'translate(-100%, -50%)';
        } else {
          marker.style.flexDirection = 'row';
          marker.style.transform = 'translate(0%, -50%)';
        }

        const arrow = marker.querySelector('.mp-edge-arrow');
        const badge = marker.querySelector('.mp-edge-badge');
        const dot = marker.querySelector('.mp-edge-dot');
        const nameEl = marker.querySelector('.mp-edge-name');
        const distEl = marker.querySelector('.mp-edge-dist-tag');

        const col = r.color || '#ffcb1f';
        if (arrow) {
          arrow.style.transform = `rotate(${deg}deg)`;
          arrow.style.borderLeftColor = col;
          arrow.style.filter = `drop-shadow(0 0 5px ${col})`;
        }
        if (badge) {
          badge.style.borderColor = col;
          badge.style.boxShadow = `0 0 10px ${col}44`;
        }
        if (dot) {
          dot.style.background = col;
        }
        if (nameEl) {
          nameEl.textContent = r.name;
        }
        if (distEl) {
          distEl.textContent = `${toBengaliDigits(Math.round(worldDist))}মি`;
          distEl.style.color = col;
        }

      } else {
        // Target is directly in view on screen
        marker.style.display = 'none';
      }
    }

    // Clean up disconnected player markers
    const allMarkers = edgeContainer.querySelectorAll('.mp-edge-marker');
    for (const m of allMarkers) {
      const pid = m.id.replace('mp-edge-', '');
      if (!remotePlayers.has(pid)) {
        m.remove();
      }
    }
  }

  // =========================================================================
  // MULTIPLAYER MAIN UPDATE LOOP
  // =========================================================================
  let lastTime = performance.now();

  function mpLoop() {
    requestAnimationFrame(mpLoop);

    const now = performance.now();
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    const game = window.__at;
    if (!game || !game.P || !game.CAM) return;
    const localP = game.P;
    const cam = game.CAM;

    hookMinimap();

    if (bumpCooldown > 0) bumpCooldown -= dt;

    // 1. Send Local State to Server (~25 times per second)
    if (ws && ws.readyState === WebSocket.OPEN && now - lastSyncTime > 40) {
      lastSyncTime = now;
      const currentDamage = (game.G && game.G.bounty) || 0;
      ws.send(JSON.stringify({
        type: 'state',
        x: localP.x,
        y: (localP.fly && localP.fly.y) || 0,
        z: localP.z,
        yaw: localP.yaw,
        pitch: localP.pitch || 0,
        roll: localP.roll || 0,
        v: localP.v || 0,
        steer: localP.steer || 0,
        boost: !!localP.boost,
        horn: !!(window.He && (window.He.KeyH || window.He.Space)),
        damage: currentDamage,
        alive: !!localP.alive
      }));
    }

    checkLocalHorn();

    // 2. Interpolate Remote Players and check PvP Collision
    const lerpFactor = Math.min(1, dt * 14);

    for (const [id, r] of remotePlayers.entries()) {
      // Smooth position lerp
      r.currX += (r.targetX - r.currX) * lerpFactor;
      r.currY += (r.targetY - r.currY) * lerpFactor;
      r.currZ += (r.targetZ - r.currZ) * lerpFactor;

      // Shortest-angle yaw lerp
      let diffYaw = r.targetYaw - r.currYaw;
      while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
      while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
      r.currYaw += diffYaw * lerpFactor;

      r.currPitch += (r.targetPitch - r.currPitch) * lerpFactor;
      r.currRoll += (r.targetRoll - r.currRoll) * lerpFactor;

      // Update 3D model
      if (r.obj && r.obj.grp) {
        r.obj.grp.position.set(r.currX, r.currY + 0.05, r.currZ);
        r.obj.grp.rotation.set(r.currPitch, r.currYaw, r.currRoll);
        r.obj.grp.visible = r.alive;
      }

      // 3. PvP Bumping & Ramming Physics!
      if (bumpCooldown <= 0 && localP.alive && r.alive) {
        const dx = localP.x - r.currX;
        const dz = localP.z - r.currZ;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.01 && dist < 1.85) {
          bumpCooldown = 0.35;

          const nx = dx / dist;
          const nz = dz / dist;
          const impactSpeed = Math.max(Math.abs(localP.v), Math.abs(r.v), 5);
          const bumpForce = impactSpeed * 0.45;

          localP.x += nx * bumpForce * 0.25;
          localP.z += nz * bumpForce * 0.25;
          localP.v *= 0.65;
          localP.yawRate = (Math.random() - 0.5) * 4;

          if (game.sfx && game.sfx.crash) {
            game.sfx.crash(localP.x, localP.z, 1.2, 'metal');
          }
          if (game.FX && game.FX.debris) {
            game.FX.debris(localP.x, 1, localP.z, 16, 'player');
          }
          if (game.FX && game.FX.shake) {
            game.FX.shake(0.65);
          }

          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'event',
              name: 'remote_crash',
              data: { x: localP.x, z: localP.z }
            }));
          }
        }
      }

      // 4. In-View 3D Nameplate Badge update
      if (r.badgeEl) {
        if (!r.alive) {
          r.badgeEl.style.display = 'none';
          continue;
        }

        r.projPos = r.projPos || cam.position.clone();
        r.projPos.set(r.currX, r.currY + 2.1, r.currZ);
        r.projPos.project(cam);

        if (r.projPos.z < 1 && r.projPos.z > -1) {
          const sx = (r.projPos.x * 0.5 + 0.5) * window.innerWidth;
          const sy = (-(r.projPos.y * 0.5) + 0.5) * window.innerHeight;
          const distToCam = Math.hypot(cam.position.x - r.currX, cam.position.z - r.currZ);

          if (distToCam < 95) {
            r.badgeEl.style.display = 'flex';
            r.badgeEl.style.transform = `translate(-50%, -100%) translate(${Math.round(sx)}px, ${Math.round(sy)}px)`;
            const scale = Math.max(0.65, Math.min(1.0, 1 - (distToCam - 10) / 100));
            r.badgeEl.style.scale = scale.toFixed(2);

            const distBadge = r.badgeEl.querySelector('.mp-badge-dist');
            if (distBadge) {
              distBadge.textContent = `${toBengaliDigits(Math.round(distToCam))}মি`;
            }
          } else {
            r.badgeEl.style.display = 'none';
          }
        } else {
          r.badgeEl.style.display = 'none';
        }
      }
    }

    // 5. Update Screen-Edge Direction Indicators & Nearest Compass
    updateEdgeIndicators(localP, cam);
    updateNearestTracker(localP);
    drawOpponentsOnMinimap();
  }

  // Initialize
  waitForGame(() => {
    initHud();
    showJoinModal((driverName) => {
      connectWebSocket(driverName);
      mpLoop();
    });
  });

})();
