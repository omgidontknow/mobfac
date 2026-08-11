(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d', { alpha: false });
  let DPR = Math.max(1, window.devicePixelRatio || 1);

  // Pixel sand config
  const SAND_PIXEL = 2; // small as feasible while staying performant
  const SAND_COLORS = ['#E3C58A', '#D8B76D', '#C9A15A'];

  // Grid (cells below groundTop): sandGrid and groundGrid
  let cols = 0, rows = 0;
  let sandGrid = null; // Uint8Array(cols*rows)
  let groundGrid = null; // Uint8Array(cols*rows)

  // World
  let world = { w:0, h:0, camX:0, camY:0 };
  let groundTop = 0; // y coordinate (in px) where ground starts

  // Inventory
  let heldSand = 0;
  const ui = { sandCount: document.getElementById('sandCount'), mineBtn: document.getElementById('mineBtn'), collectBtn: document.getElementById('collectBtn'), dropBtn: document.getElementById('dropBtn') };

  // Interaction modes: 'pan'|'mine'|'collect'|'drop'
  let mode = 'pan';
  function setMode(m){ mode = m; ui.mineBtn.classList.toggle('active', m==='mine'); ui.collectBtn.classList.toggle('active', m==='collect'); ui.dropBtn.classList.toggle('active', m==='drop'); }
  ui.mineBtn.addEventListener('click', ()=> setMode(mode==='mine'?'pan':'mine'));
  ui.collectBtn.addEventListener('click', ()=> setMode(mode==='collect'?'pan':'collect'));
  ui.dropBtn.addEventListener('click', ()=> setMode(mode==='drop'?'pan':'drop'));

  // Disable smoothing
  ctx.imageSmoothingEnabled = false;
  if (typeof ctx.webkitImageSmoothingEnabled !== 'undefined') ctx.webkitImageSmoothingEnabled = false;
  canvas.style.imageRendering = 'pixelated';

  function resize() {
    DPR = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * DPR);
    canvas.height = Math.floor(rect.height * DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    world.w = canvas.width / DPR; world.h = canvas.height / DPR;
    // ground is bottom ~ 40% of screen by height
    groundTop = Math.floor(world.h * 0.6);
    initGrid();
  }
  window.addEventListener('resize', resize);
  // initial
  function initSize(){ const rect = canvas.getBoundingClientRect(); if(rect.width===0||rect.height===0){ canvas.style.width='100%'; canvas.style.height='100%'; } resize(); }
  initSize();

  function initGrid(){
    cols = Math.ceil(world.w / SAND_PIXEL);
    rows = Math.ceil((world.h - groundTop) / SAND_PIXEL);
    sandGrid = new Uint8Array(cols * rows);
    groundGrid = new Uint8Array(cols * rows);
    // fill ground with a natural-looking slope (groundGrid = 1)
    for(let x=0;x<cols;x++){
      const nx = x/cols;
      const heightPx = Math.floor((0.5 + 0.12 * Math.sin(nx * 12) + 0.06 * Math.cos(nx*7)) * (rows*SAND_PIXEL));
      const hCells = Math.min(rows, Math.max(1, Math.floor(heightPx / SAND_PIXEL)));
      for(let y=rows-1; y>=rows-hCells; y--){ groundGrid[y*cols + x] = 1; }
    }
    // ensure sandGrid is empty initially (no sand on load)
  }

  function worldToGrid(wx, wy){
    const gx = Math.floor((wx + world.camX) / SAND_PIXEL);
    const gy = Math.floor((wy - groundTop) / SAND_PIXEL);
    return {gx, gy};
  }
  function gridIndex(gx,gy){ return gy*cols + gx; }

  // Sand physics (cellular automata falling on empty cells; groundGrid blocks)
  function step(dt){
    if(!sandGrid) return;
    // iterate bottom-up
    for(let y = rows-1; y>=0; y--){
      for(let x = 0; x<cols; x++){
        const idx = y*cols + x;
        if(sandGrid[idx] !== 1) continue;
        // if below is empty of both sand and ground, fall
        const belowY = y+1;
        if(belowY < rows){
          const belowIdx = belowY*cols + x;
          if(sandGrid[belowIdx] === 0 && groundGrid[belowIdx] === 0){ sandGrid[belowIdx] = 1; sandGrid[idx] = 0; continue; }
          // try diagonal
          const dir = (Math.random() > 0.5) ? -1 : 1;
          const nx = x + dir; const ny = y+1;
          if(nx >=0 && nx < cols && ny < rows && sandGrid[ny*cols + nx] === 0 && groundGrid[ny*cols + nx] === 0){ sandGrid[ny*cols + nx] = 1; sandGrid[idx]=0; continue; }
          const ox = x - dir;
          if(ox >=0 && ox < cols && ny < rows && sandGrid[ny*cols + ox] === 0 && groundGrid[ny*cols + ox] === 0){ sandGrid[ny*cols + ox] = 1; sandGrid[idx]=0; continue; }
        } else {
          // at bottom row - nothing
        }
      }
    }
  }

  function draw(){
    // sky
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0,0, world.w, world.h);

    // draw ground grid
    if(groundGrid){
      for(let y=0;y<rows;y++){
        for(let x=0;x<cols;x++){
          const idx = y*cols + x;
          const px = x * SAND_PIXEL - world.camX;
          const py = groundTop + y * SAND_PIXEL - world.camY;
          if(groundGrid[idx]){
            ctx.fillStyle = '#6B3E22'; // darker ground block
            ctx.fillRect(Math.floor(px), Math.floor(py), SAND_PIXEL, SAND_PIXEL);
          }
        }
      }
    }

    // draw sand grid on top of ground
    if(sandGrid){
      for(let y=0;y<rows;y++){
        for(let x=0;x<cols;x++){
          if(sandGrid[y*cols + x]){
            const px = x * SAND_PIXEL - world.camX;
            const py = groundTop + y * SAND_PIXEL - world.camY;
            const shade = SAND_COLORS[(x + y) % SAND_COLORS.length];
            ctx.fillStyle = shade;
            ctx.fillRect(Math.floor(px), Math.floor(py), SAND_PIXEL, SAND_PIXEL);
          }
        }
      }
    }

    // HUD overlay (mode)
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.font = '12px system-ui';
    ctx.fillText('Mode: ' + mode, 12 - world.camX, 18 - world.camY);
    ctx.restore();
  }

  // Mining: convert ground cells into sand cells (sand appears in-world) - does NOT add to inventory
  function mineAt(wx, wy, brushPx=12){
    if(!groundGrid) return;
    const {gx, gy} = worldToGrid(wx, wy);
    const r = Math.max(1, Math.round(brushPx / SAND_PIXEL));
    for(let dy = -r; dy <= r; dy++){
      for(let dx = -r; dx <= r; dx++){
        const x = gx + dx, y = gy + dy;
        if(x<0||x>=cols||y<0||y>=rows) continue;
        const idx = y*cols + x;
        if(groundGrid[idx] === 1){ groundGrid[idx] = 0; sandGrid[idx] = 1; }
      }
    }
  }

  // Collect sand into inventory (removes sand cells)
  function collectAt(wx, wy, brushPx=12){
    if(!sandGrid) return;
    const {gx, gy} = worldToGrid(wx, wy);
    const r = Math.max(1, Math.round(brushPx / SAND_PIXEL));
    let removed = 0;
    for(let dy = -r; dy <= r; dy++){
      for(let dx = -r; dx <= r; dx++){
        const x = gx + dx, y = gy + dy;
        if(x<0||x>=cols||y<0||y>=rows) continue;
        const idx = y*cols + x;
        if(sandGrid[idx] === 1){ sandGrid[idx] = 0; removed++; }
      }
    }
    if(removed){
      heldSand += removed;
      if(ui.sandCount) ui.sandCount.textContent = heldSand;
    }
  }

  // Drop sand into grid (places sand cells; physics will settle them)
  function dropAt(wx, wy, brushPx=12){
    if(!sandGrid || heldSand <= 0) return;
    const {gx, gy} = worldToGrid(wx, wy);
    const r = Math.max(1, Math.round(brushPx / SAND_PIXEL));
    let placed = 0;
    for(let dy = -r; dy <= r && heldSand>0; dy++){
      for(let dx = -r; dx <= r && heldSand>0; dx++){
        const x = gx + dx;
        if(x<0||x>=cols) continue;
        // place at highest empty cell (closest to top of ground area)
        for(let y = 0; y<rows; y++){
          const idx = y*cols + x;
          if(groundGrid[idx] === 0 && sandGrid[idx] === 0){ sandGrid[idx] = 1; placed++; heldSand--; break; }
        }
      }
    }
    ui.sandCount.textContent = heldSand;
  }

  // Pointer interaction
  let isPointerDown = false, panStart = null, dragging = false;
  canvas.addEventListener('pointerdown', e=>{
    canvas.setPointerCapture(e.pointerId);
    isPointerDown = true; dragging = false;
    panStart = {x:e.clientX, y:e.clientY, camX: world.camX, camY: world.camY};
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left; const py = e.clientY - rect.top;
    if(mode === 'mine'){ mineAt(px, py, 12); }
    if(mode === 'collect'){ collectAt(px, py, 12); }
    if(mode === 'drop'){ dropAt(px, py, 12); }
  });
  canvas.addEventListener('pointermove', e=>{
    if(!isPointerDown) return;
    const dx = e.clientX - panStart.x, dy = e.clientY - panStart.y;
    if(Math.hypot(dx,dy) > 6) dragging = true;
    if(dragging && mode === 'pan'){
      world.camX = Math.max(0, panStart.camX - dx);
      world.camY = Math.max(0, panStart.camY - dy);
    } else {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left; const py = e.clientY - rect.top;
      if(mode === 'mine') mineAt(px, py, 8);
      if(mode === 'collect') collectAt(px, py, 8);
      if(mode === 'drop') dropAt(px, py, 8);
    }
  });
  canvas.addEventListener('pointerup', e=>{ canvas.releasePointerCapture(e.pointerId); isPointerDown=false; dragging=false; panStart=null; });

  // Reset
  document.getElementById('reset').addEventListener('click', ()=>{ initGrid(); heldSand = 0; ui.sandCount.textContent = heldSand; setMode('pan'); });

  // Main loop
  let last = performance.now();
  function loop(now){
    const dt = Math.min(1/30, (now - last) / 1000);
    // run several small CA steps per frame to make sand flow faster
    for(let i=0;i<3;i++) step(dt);
    draw();
    last = now;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

})();
