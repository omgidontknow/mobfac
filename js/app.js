(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d', { alpha: false });
  let DPR = Math.max(1, window.devicePixelRatio || 1);

  function resize() {
    DPR = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * DPR);
    canvas.height = Math.floor(rect.height * DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  window.addEventListener('resize', resize);
  // ensure the canvas has a size initially
  function initSize(){
    const rect = canvas.getBoundingClientRect();
    if(rect.width === 0 || rect.height === 0){
      // give the canvas a default size if not yet laid out
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    }
    resize();
  }
  initSize();

  // Game world coords scale with canvas size
  let world = {
    w: canvas.width / DPR,
    h: canvas.height / DPR,
    camX: 0, camY: 0, scale:1
  };

  function updateWorldSize(){ world.w = canvas.width/DPR; world.h = canvas.height/DPR; }
  updateWorldSize();

  // Entities
  const particles = []; // sand particles
  const conveyors = []; // rectangles that nudge sand horizontally
  const collectors = []; // processor area(s)
  let sandCount = 0, coins = 0;
  let placingConveyor = false;
  let autoProcessor = false;

  // Settings / progression
  let costs = { conveyor:50, auto:200 };
  const ui = {
    coins: document.getElementById('coins'),
    sandCount: document.getElementById('sandCount'),
    buyConveyor: document.getElementById('buyConveyor'),
    buyAuto: document.getElementById('buyAuto')
  };

  function save() {
    try{
      localStorage.setItem('sandfactory_v1', JSON.stringify({coins,sandCount,conveyors,collectors,autoProcessor}));
    }catch(e){ /* ignore */ }
  }
  function load(){
    const s = localStorage.getItem('sandfactory_v1');
    if(!s) {
      // create a default collector (processor) on the right side
      collectors.push({x: (world.w-140), y: world.h - 110, w:120, h:80, rate:1000, last:0});
      return;
    }
    try {
      const obj = JSON.parse(s);
      coins = obj.coins||0; sandCount = obj.sandCount||0; autoProcessor = !!obj.autoProcessor;
      // conveyors and collectors are simple shapes; if present, keep them
      if(Array.isArray(obj.conveyors)) obj.conveyors.forEach(c => conveyors.push(c));
      if(Array.isArray(obj.collectors)) obj.collectors.forEach(c => collectors.push(c));
    } catch(e){}
  }
  load();
  ui.coins.textContent = coins;
  ui.sandCount.textContent = sandCount;

  // Input handlers (touch-friendly)
  let isPointerDown = false, lastPointer = null, dragging = false;
  let panStart = null;

  function screenToWorld(sx, sy){
    return { x: sx + world.camX, y: sy + world.camY };
  }

  canvas.addEventListener('pointerdown', e=>{
    canvas.setPointerCapture(e.pointerId);
    isPointerDown = true;
    lastPointer = {x:e.clientX, y:e.clientY};
    panStart = {x:e.clientX, y:e.clientY, camX: world.camX, camY: world.camY};
  });

  canvas.addEventListener('pointermove', e=>{
    if(!isPointerDown) return;
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    if(Math.hypot(dx,dy) > 8) dragging = true;
    if(dragging) {
      world.camX = Math.max(0, panStart.camX - dx);
      world.camY = Math.max(0, panStart.camY - dy);
    }
  });

  canvas.addEventListener('pointerup', e=>{
    canvas.releasePointerCapture(e.pointerId);
    isPointerDown = false;
    if(!dragging){
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const wpos = screenToWorld(px, py);
      if(placingConveyor){
        // place conveyor centered at tap
        const cw = 120, ch = 18;
        conveyors.push({x: wpos.x - cw/2, y: wpos.y - ch/2, w: cw, h: ch, dir: -1});
        placingConveyor = false;
        save();
      } else {
        // spawn a cluster of sand where tapped
        spawnSand(wpos.x, wpos.y, 12);
      }
    }
    dragging = false;
    panStart = null;
  });

  // Buttons
  document.getElementById('spawnBtn').addEventListener('click', ()=> {
    spawnSand(world.camX + world.w*0.2, 60, 24);
  });
  ui.buyConveyor.addEventListener('click', ()=>{
    if(coins < costs.conveyor) return flash(ui.buyConveyor);
    coins -= costs.conveyor;
    ui.coins.textContent = coins;
    placingConveyor = true;
    save();
  });
  ui.buyAuto.addEventListener('click', ()=>{
    if(coins < costs.auto) return flash(ui.buyAuto);
    coins -= costs.auto;
    ui.coins.textContent = coins;
    autoProcessor = true;
    save();
  });
  document.getElementById('reset').addEventListener('click', ()=>{
    localStorage.removeItem('sandfactory_v1');
    particles.length = conveyors.length = collectors.length = 0;
    sandCount = coins = 0; autoProcessor = false; save(); location.reload();
  });

  function flash(el){
    el.style.transition = 'transform .08s';
    el.style.transform = 'scale(0.95)';
    setTimeout(()=>{ el.style.transform=''; },120);
  }

  // Spawning particles
  function spawnSand(x,y,n=6){
    for(let i=0;i<n;i++){
      particles.push({
        x: x + (Math.random()-0.5)*20,
        y: y + (Math.random()-0.5)*6,
        vx: (Math.random()-0.5)*0.4,
        vy: Math.random()*0.5,
        r: 3 + Math.random()*2,
        color: ['#f2d28b','#ffd88a','#f8c86a'][Math.floor(Math.random()*3)]
      });
    }
  }

  // Processing: when particle overlaps a collector, collect it (remove and increment sand or coins)
  function tryCollect(p){
    for(const c of collectors){
      if(p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + c.h){
        // collected into factory
        // If autoProcessor, convert immediately to coins; else to sand inventory
        if(autoProcessor){
          coins += 1;
          ui.coins.textContent = coins;
        } else {
          sandCount += 1;
          ui.sandCount.textContent = sandCount;
        }
        return true;
      }
    }
    return false;
  }

  // Simple physics + conveyors effect
  function step(dt){
    updateWorldSize();
    // gravity
    for(let i = particles.length-1; i >= 0; i--){
      const p = particles[i];
      p.vy += 0.12 * dt;
      p.vx *= 0.999;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;

      // conveyors apply horizontal nudge when particle overlaps their rect
      for(const conv of conveyors){
        if(p.x > conv.x && p.x < conv.x + conv.w && p.y > conv.y - 2 && p.y < conv.y + conv.h + 6){
          // nudge gently
          p.vx += conv.dir * 0.12 * dt;
          // slight lift
          p.vy -= 0.08 * dt;
        }
      }

      // ground collision
      const groundY = world.h - 14;
      if(p.y > groundY){
        p.y = groundY;
        p.vy *= -0.12;
        p.vx *= 0.5;
        if(Math.abs(p.vy) < 0.2) p.vy = 0;
      }

      // try to collect
      if(tryCollect(p)){
        particles.splice(i,1);
        save();
        continue;
      }

      // remove if off-left/right or far below
      if(p.x < -200 || p.x > world.w + 200 || p.y > world.h + 400){
        particles.splice(i,1);
      }
    }

    // Auto-processor: convert stored sand to coins over time
    if(autoProcessor && sandCount > 0){
      // rate: 1 coin per 700ms per processor base
      for(const c of collectors){
        const now = performance.now();
        if(!c.last) c.last = now;
        if(now - c.last >= 700){
          const convert = Math.min(1, sandCount);
          sandCount -= convert;
          coins += convert;
          ui.sandCount.textContent = sandCount;
          ui.coins.textContent = coins;
          c.last = now;
          save();
        }
      }
    }
  }

  // Draw
  function draw(){
    ctx.clearRect(0,0,world.w, world.h);
    // background pattern
    const grd = ctx.createLinearGradient(0,0,0,world.h);
    grd.addColorStop(0, '#07121a'); grd.addColorStop(1,'#07131b');
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,world.w, world.h);

    ctx.save();
    ctx.translate(-world.camX, -world.camY);

    // ground
    ctx.fillStyle = '#0b1720';
    ctx.fillRect(0, world.h - 24, world.w + 200, 40);

    // conveyors
    for(const conv of conveyors){
      ctx.fillStyle = '#213240';
      ctx.fillRect(conv.x, conv.y, conv.w, conv.h);
      // arrows
      ctx.fillStyle = '#7da6c1';
      const step = 20;
      for(let ax = conv.x + (conv.dir>0?8:conv.w-8); conv.dir>0 ? ax < conv.x+conv.w : ax > conv.x; ax += conv.dir*step){
        ctx.beginPath();
        ctx.moveTo(ax, conv.y + conv.h/2 - 6);
        ctx.lineTo(ax + conv.dir*8, conv.y + conv.h/2);
        ctx.lineTo(ax, conv.y + conv.h/2 + 6);
        ctx.closePath();
        ctx.fill();
      }
    }

    // collectors / processors
    for(const c of collectors){
      ctx.fillStyle = '#10232b';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = '#25536b';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x+1, c.y+1, c.w-2, c.h-2);
      ctx.fillStyle = '#9fd3ff';
      ctx.font = '12px system-ui,Segoe UI';
      ctx.fillText('Processor', c.x + 8, c.y + 18);
    }

    // particles
    for(const p of particles){
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
    }

    // UI hint if placing
    if(placingConveyor){
      ctx.fillStyle = 'rgba(255,200,120,0.14)';
      const px = world.camX + world.w/2 - 60;
      const py = world.camY + world.h/2 - 9;
      ctx.fillRect(px, py, 120, 18);
      ctx.fillStyle = '#ffdca5';
      ctx.font = '13px system-ui';
      ctx.fillText('Tap to place conveyor', px + 12, py + 13);
    }

    ctx.restore();
  }

  // Main loop
  let last = performance.now();
  function loop(now){
    const dt = Math.min(1/20, (now - last) / 1000);
    step(dt * 1); // physics step factor
    draw();
    last = now;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // create a default conveyor & processor if none exist (for immediate fun)
  if(collectors.length === 0){
    collectors.push({x: world.w - 140, y: world.h - 110, w:120, h:80, rate:1000, last:0});
  }
  if(conveyors.length === 0){
    conveyors.push({x: world.w*0.4, y: world.h - 60, w: 220, h: 18, dir: 1});
  }

  // Responsive: ensure default shapes adapt on resize
  const ro = new ResizeObserver(()=>{ updateWorldSize(); });
  ro.observe(canvas);

  // simple guidance: double-tap spawn
  let lastTap = 0;
  canvas.addEventListener('dblclick', ()=> spawnSand(world.camX + world.w*0.2, 60, 40));

  // convenience: keyboard shortcuts (desktop)
  window.addEventListener('keydown', e=>{
    if(e.key === ' ') spawnSand(world.camX + world.w*0.2, 60, 20);
    if(e.key === 'c') {
      if(coins >= costs.conveyor){ coins -= costs.conveyor; conveyors.push({x: world.camX + world.w*0.5 - 60, y: world.camY + world.h - 80, w: 120, h:18, dir: -1}); ui.coins.textContent = coins; save(); }
    }
    if(e.key === 'a'){
      if(coins >= costs.auto){ coins -= costs.auto; autoProcessor = true; ui.coins.textContent = coins; save(); }
    }
  });

  // Save periodically
  setInterval(save, 2000);

})();
