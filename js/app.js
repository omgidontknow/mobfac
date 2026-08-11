(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d', { alpha: false });
  let DPR = Math.max(1, window.devicePixelRatio || 1);

  // Pixel sand config
  const SAND_PIXEL = 2; // small as feasible while staying performant
  const SAND_COLORS = ['#E3C58A', '#D8B76D', '#C9A15A'];

  // Grid (cells: 0 empty, 1 sand)
  let cols = 0, rows = 0;
  let grid = null; // Uint8Array(cols*rows)

  // World
  let world = { w:0, h:0, camX:0, camY:0 };
  let groundTop = 0; // y coordinate (in px) where ground starts

  // Inventory
  let heldSand = 0;
  const ui = { sandCount: document.getElementById('sandCount'), collectBtn: document.getElementById('collectBtn'), dropBtn: document.getElementById('dropBtn') };

  // Interaction modes: 'pan'|'collect'|'drop'
  let mode = 'pan';
  function setMode(m){ mode = m; ui.collectBtn.classList.toggle('active', m==='collect'); ui.dropBtn.classList.toggle('active', m==='drop'); }
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
    // ground is bottom ~ 30% of screen by height
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
    grid = new Uint8Array(cols * rows);
    // fill ground with a natural-looking slope
    for(let x=0;x<cols;x++){
      // height varies by perlin-like simple noise
      const nx = x/cols;
      const heightPx = Math.floor((0.4 + 0.15 * Math.sin(nx * 12) + 0.08 * Math.cos(nx*7)) * (rows*SAND_PIXEL));
      const hCells = Math.min(rows, Math.max(1, Math.floor(heightPx / SAND_PIXEL)));
      for(let y=rows-1; y>=rows-hCells; y--){ grid[y*cols + x] = 1; }
    }
  }

  function worldToGrid(wx, wy){
    const gx = Math.floor((wx + world.camX) / SAND_PIXEL);
    const gy = Math.floor((wy - groundTop) / SAND_PIXEL);
    return {gx, gy};
  }
  function gridIndex(gx,gy){ return gy*cols + gx; }

  // Sand physics (cellular automata falling)
  function step(dt){
    if(!grid) return;
    // iterate bottom-up so particles can fall multiple cells per step if space
    // we'll do one pass moving down where possible
    for(let y = rows-1; y>=0; y--){
      for(let x = 0; x<cols; x++){
        const idx = y*cols + x;
        if(grid[idx] !== 1) continue;
        const below = (y+1<rows) ? ( (y+1)*cols + x ) : -1;
        if(below !== -1 && grid[below] === 0){
          grid[below] = 1; grid[idx] = 0; continue;
        }
        // try down-left or down-right randomly
        const dir = (Math.random() > 0.5) ? -1 : 1;
        const nx = x + dir; const ny = y+1;
        if(nx >=0 && nx < cols && ny < rows && grid[ny*cols + nx] === 0){ grid[ny*cols + nx] = 1; grid[idx]=0; continue; }
        // try the other side
        const ox = x - dir;
        if(ox >=0 && ox < cols && ny < rows && grid[ny*cols + ox] === 0){ grid[ny*cols + ox] = 1; grid[idx]=0; continue; }
      }
    }
  }

  function draw(){
    // sky
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0,0, world.w, world.h);

    // draw ground background (brown area)
    ctx.fillStyle = '#8B5A2B';
    ctx.fillRect(0, groundTop, world.w, world.h - groundTop);

    // draw sand grid
    if(grid){
      for(let y=0;y<rows;y++){
        for(let x=0;x<cols;x++){
          if(grid[y*cols + x]){
            const px = x * SAND_PIXEL - world.camX;
            const py = groundTop + y * SAND_PIXEL - world.camY;
            // shade variation
            const shade = SAND_COLORS[(x + y) % SAND_COLORS.length];
            ctx.fillStyle = shade;
            ctx.fillRect(Math.floor(px), Math.floor(py), SAND_PIXEL, SAND_PIXEL);
          }
        }
      }
    }

    // HUD overlay (mode)
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.font = '12px system-ui';
    ctx.fillText('Mode: ' + mode, 12 - world.camX, 18 - world.camY);
    ctx.restore();
  }

  // Mining: remove sand cells under brush and count
  function mineAt(wx, wy, brushPx=12){
    if(!grid) return;
    const {gx, gy} = worldToGrid(wx, wy);
    const r = Math.max(1, Math.round(brushPx / SAND_PIXEL));
    let removed = 0;
    for(let dy = -r; dy <= r; dy++){
      for(let dx = -r; dx <= r; dx++){
        const x = gx + dx, y = gy + dy;
        if(x<0||x>=cols||y<0||y>=rows) continue;
        const idx = y*cols + x;
        if(grid[idx] === 1){ grid[idx] = 0; removed++; }
      }
    }
    heldSand += removed;
    ui.sandCount.textContent = heldSand;
  }

  // Drop sand into grid (fills the highest empty cell at point)
  function dropAt(wx, wy, brushPx=12){
    if(!grid || heldSand <= 0) return;
    const {gx, gy} = worldToGrid(wx, wy);
    const r = Math.max(1, Math.round(brushPx / SAND_PIXEL));
    // attempt to place up to heldSand cells within brush
    let placed = 0;
    for(let dy = -r; dy <= r && heldSand>0; dy++){
      for(let dx = -r; dx <= r && heldSand>0; dx++){
        const x = gx + dx;
        if(x<0||x>=cols) continue;
        // find highest empty cell from top of ground area downwards around gy
        for(let y = 0; y<rows; y++){
          const idx = y*cols + x;
          if(grid[idx] === 0){ grid[idx] = 1; placed++; heldSand--; break; }
        }
      }
    }
    ui.sandCount.textContent = heldSand;
  }

  // Pointer interaction: pan when dragging, collect/drop when clicking depending on mode
  let isPointerDown = false, panStart = null, dragging = false;
  canvas.addEventListener('pointerdown', e=>{
    canvas.setPointerCapture(e.pointerId);
    isPointerDown = true; dragging = false;
    panStart = {x:e.clientX, y:e.clientY, camX: world.camX, camY: world.camY};
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left; const py = e.clientY - rect.top;
    if(mode === 'collect'){ mineAt(px, py, 12); }
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
      // if collecting/dropping while moving
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left; const py = e.clientY - rect.top;
      if(mode === 'collect') mineAt(px, py, 8);
      if(mode === 'drop') dropAt(px, py, 8);
    }
  });
  canvas.addEventListener('pointerup', e=>{ canvas.releasePointerCapture(e.pointerId); isPointerDown=false; dragging=false; panStart=null; });

  // Reset
  document.getElementById('reset').addEventListener('click', ()=>{ initGrid(); heldSand = 0; ui.sandCount.textContent = heldSand; });

  // Main loop
  let last = performance.now();
  function loop(now){
    const dt = Math.min(1/30, (now - last) / 1000);
    // run several small CA steps per frame to make sand flow faster
    for(let i=0;i<2;i++) step(dt);
    draw();
    last = now;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

})();
