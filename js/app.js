(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d', { alpha: false });
  let DPR = Math.max(1, window.devicePixelRatio || 1);

  // Pixel sand config
  const SAND_PIXEL = 2; // small as feasible while staying performant
  const SAND_BASE = [227,197,138]; // golden base
  const SAND_BASE2 = [216,183,109];

  // Grid (cells below groundTop): sandGrid and groundGrid
  let cols = 0, rows = 0;
  let sandGrid = null; // Uint8Array(cols*rows)
  let groundGrid = null; // Uint8Array(cols*rows)

  // World
  let world = { w:0, h:0, camX:0, camY:0, worldW:0 };
  let groundTop = 0; // y coordinate (in px) where ground starts

  // Inventory
  let heldSand = 0;
  const ui = {
    sandCount: document.getElementById('sandCount'),
    mineBtn: document.getElementById('mineBtn'),
    collectBtn: document.getElementById('collectBtn'),
    dropBtn: document.getElementById('dropBtn')
  };

  // Interaction modes: 'pan'|'mine'|'collect'|'drop'
  let mode = 'pan';
  function setMode(m){
    mode = m;
    if(ui.mineBtn) ui.mineBtn.classList.toggle('active', m==='mine');
    if(ui.collectBtn) ui.collectBtn.classList.toggle('active', m==='collect');
    if(ui.dropBtn) ui.dropBtn.classList.toggle('active', m==='drop');
  }
  if(ui.mineBtn) ui.mineBtn.addEventListener('click', ()=> setMode(mode==='mine'?'pan':'mine'));
  if(ui.collectBtn) ui.collectBtn.addEventListener('click', ()=> setMode(mode==='collect'?'pan':'collect'));
  if(ui.dropBtn) ui.dropBtn.addEventListener('click', ()=> setMode(mode==='drop'?'pan':'drop'));

  // Disable smoothing
  ctx.imageSmoothingEnabled = false;
  if (typeof ctx.webkitImageSmoothingEnabled !== 'undefined') ctx.webkitImageSmoothingEnabled = false;
  canvas.style.imageRendering = 'pixelated';

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  function resize() {
    DPR = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * DPR);
    canvas.height = Math.floor(rect.height * DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    world.w = canvas.width / DPR; world.h = canvas.height / DPR;
    // virtual world width: 3x viewport or at least 1200px
    world.worldW = Math.max(Math.floor(world.w * 3), 1200);
    // ground is bottom ~ 60% of screen by height
    groundTop = Math.floor(world.h * 0.6);
    initGrid();
    // keep camera in bounds after resize
    world.camX = clamp(world.camX, 0, Math.max(0, world.worldW - world.w));
  }
  window.addEventListener('resize', resize);
  // initial
  function initSize(){ const rect = canvas.getBoundingClientRect(); if(rect.width===0||rect.height===0){ canvas.style.width='100%'; canvas.style.height='100%'; } resize(); }
  initSize();

  // simple deterministic noise/hash
  function hash01(x,y){
    // 32-bit integer hash
    let n = (x | 0) * 374761393 + (y | 0) * 668265263;
    n = (n ^ (n >>> 13)) * 1274126177;
    n = n ^ (n >>> 16);
    return ((n >>> 0) / 4294967295);
  }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function mixColor(c1,c2,t){ return [ Math.round(lerp(c1[0],c2[0],t)), Math.round(lerp(c1[1],c2[1],t)), Math.round(lerp(c1[2],c2[2],t)) ]; }
  function rgbToStyle(c){ return 'rgb('+c[0]+','+c[1]+','+c[2]+')'; }

  // --- smoothing / terrain generation ---
  function smoothArray(arr, passes, kernelRadius){
    const n = arr.length;
    const tmp = new Int32Array(n);
    for(let p=0;p<passes;p++){
      for(let i=0;i<n;i++){
        let sum = 0, count = 0;
        for(let k=-kernelRadius;k<=kernelRadius;k++){
          const j = i + k;
          if(j < 0 || j >= n) continue;
          sum += arr[j]; count++;
        }
        tmp[i] = Math.round(sum / count);
      }
      for(let i=0;i<n;i++) arr[i] = tmp[i];
    }
  }

  function initGrid(){
    cols = Math.ceil(world.worldW / SAND_PIXEL);
    rows = Math.ceil((world.h - groundTop) / SAND_PIXEL);
    sandGrid = new Uint8Array(cols * rows);
    groundGrid = new Uint8Array(cols * rows);

    // Broadly flat ground with very small variation
    const baseCells = Math.max(2, Math.floor(rows * 0.5));
    const amplitude = Math.max(1, Math.floor(rows * 0.01)); // smaller amplitude for very flat
    const heights = new Int32Array(cols);
    for(let x=0;x<cols;x++){
      const nx = x/cols;
      // very low-frequency variation
      const v = Math.sin(nx * 1.8) * 0.35 + Math.cos(nx * 1.1) * 0.2;
      heights[x] = baseCells + Math.round(v * amplitude);
    }
    // Strong smoothing to remove jagged edges
    smoothArray(heights, 8, 3); // 8 passes, radius 3

    // Fill groundGrid using heights
    for(let x=0;x<cols;x++){
      const hCells = clamp(heights[x], 1, rows);
      const topY = rows - hCells;
      for(let y=rows-1; y>=topY; y--){ groundGrid[y*cols + x] = 1; }
    }

    // empty sand
    sandGrid.fill(0);
    heldSand = 0;
    if(ui.sandCount) ui.sandCount.textContent = heldSand;
  }

  function worldToGrid(wx, wy){
    const gx = Math.floor((wx + world.camX) / SAND_PIXEL);
    const gy = Math.floor((wy - groundTop) / SAND_PIXEL);
    return {gx, gy};
  }

  // mine flash feedback
  let mineFlash = {x:0,y:0,ttl:0};

  // Sand physics (CA) - operate only on visible columns ± margin
  function step(){
    if(!sandGrid) return;
    const leftCol = Math.max(0, Math.floor(world.camX / SAND_PIXEL) - 6);
    const rightCol = Math.min(cols-1, Math.ceil((world.camX + world.w) / SAND_PIXEL) + 6);
    for(let y = rows-1; y>=0; y--){
      for(let x = leftCol; x<= rightCol; x++){
        const idx = y*cols + x;
        if(sandGrid[idx] !== 1) continue;
        const belowY = y+1;
        if(belowY < rows){
          const belowIdx = belowY*cols + x;
          if(sandGrid[belowIdx] === 0 && groundGrid[belowIdx] === 0){ sandGrid[belowIdx] = 1; sandGrid[idx] = 0; continue; }
          const dir = (Math.random() > 0.5) ? -1 : 1;
          const nx = x + dir, ny = y + 1;
          if(nx >=0 && nx < cols && ny < rows && sandGrid[ny*cols + nx] === 0 && groundGrid[ny*cols + nx] === 0){ sandGrid[ny*cols + nx] = 1; sandGrid[idx]=0; continue; }
          const ox = x - dir;
          if(ox >=0 && ox < cols && ny < rows && sandGrid[ny*cols + ox] === 0 && groundGrid[ny*cols + ox] === 0){ sandGrid[ny*cols + ox] = 1; sandGrid[idx]=0; continue; }
        }
      }
    }
  }

  function draw(){
    // sky
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0,0, world.w, world.h);

    // draw ground grid (only visible columns)
    if(groundGrid){
      const startCol = Math.max(0, Math.floor(world.camX / SAND_PIXEL) - 2);
      const endCol = Math.min(cols-1, Math.ceil((world.camX + world.w) / SAND_PIXEL) + 2);
      for(let x=startCol; x<=endCol; x++){
        for(let y=0;y<rows;y++){
          const idx = y*cols + x;
          if(groundGrid[idx]){
            const px = x * SAND_PIXEL - world.camX;
            const py = groundTop + y * SAND_PIXEL - world.camY;
            // texture: subtle per-cell variation and top-edge emphasis
            const n = hash01(x, y*3);
            const base = mixColor([107,62,34],[90,50,30], n*0.6);
            // if top edge (cell above is empty) emphasize lighter
            const aboveIdx = (y-1)>=0 ? ((y-1)*cols + x) : -1;
            let color = base;
            if(aboveIdx === -1 || groundGrid[aboveIdx] === 0){ color = mixColor(base, [140,90,56], 0.45); }
            ctx.fillStyle = rgbToStyle(color);
            ctx.fillRect(Math.floor(px), Math.floor(py), SAND_PIXEL, SAND_PIXEL);
          }
        }
      }
    }

    // draw sand grid on top of ground (only visible columns)
    if(sandGrid){
      const startCol = Math.max(0, Math.floor(world.camX / SAND_PIXEL) - 2);
      const endCol = Math.min(cols-1, Math.ceil((world.camX + world.w) / SAND_PIXEL) + 2);
      for(let x=startCol; x<=endCol; x++){
        for(let y=0;y<rows;y++){
          if(sandGrid[y*cols + x]){
            const px = x * SAND_PIXEL - world.camX;
            const py = groundTop + y * SAND_PIXEL - world.camY;
            const n = hash01(x*31, y*17);
            const col = mixColor(SAND_BASE, SAND_BASE2, n*0.8);
            ctx.fillStyle = rgbToStyle(col);
            ctx.fillRect(Math.floor(px), Math.floor(py), SAND_PIXEL, SAND_PIXEL);
            // subtle top highlight and bottom shadow when pixel size allows
            if(SAND_PIXEL >= 2){
              const hl = mixColor(col, [255,255,255], 0.12);
              ctx.fillStyle = rgbToStyle(hl);
              ctx.fillRect(Math.floor(px), Math.floor(py), SAND_PIXEL, 1);
              const sh = mixColor(col, [0,0,0], 0.08);
              ctx.fillStyle = rgbToStyle(sh);
              ctx.fillRect(Math.floor(px), Math.floor(py + SAND_PIXEL - 1), SAND_PIXEL, 1);
            }
          }
        }
      }
    }

    // mine flash
    if(mineFlash.ttl > 0){
      ctx.save();
      ctx.globalAlpha = Math.min(0.5, mineFlash.ttl / 12);
      ctx.fillStyle = '#ffffff';
      const sx = mineFlash.x - world.camX - 8;
      const sy = mineFlash.y - world.camY - 8;
      ctx.beginPath();
      ctx.arc(Math.floor(sx + 12), Math.floor(sy + 12), 12, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
      mineFlash.ttl--;
    }

    // HUD overlay (mode)
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.font = '12px system-ui';
    ctx.fillText('Mode: ' + mode, 12, 18);
    ctx.restore();
  }

  // determine if a ground cell at (x,y) is accessible (not fully enclosed by ground)
  function groundAccessible(x,y){
    // if above is out of bounds that's accessible
    if(y-1 < 0) return true;
    // if any 4-neighbor is NOT ground, consider accessible
    const neighbors = [ [0,-1],[1,0],[-1,0],[0,1] ];
    for(const [dx,dy] of neighbors){
      const nx = x + dx, ny = y + dy;
      if(nx < 0 || nx >= cols || ny < 0 || ny >= rows) return true;
      if(groundGrid[ny*cols + nx] === 0) return true;
    }
    return false;
  }

  // Mining: round brush; convert only accessible ground cells into sand cells
  function mineAt(wx, wy, brushPx=12){
    if(!groundGrid) return 0;
    const {gx, gy} = worldToGrid(wx, wy);
    const r = Math.max(1, Math.round(brushPx / SAND_PIXEL));
    const r2 = r*r;
    let removed = 0;
    for(let dy = -r; dy <= r; dy++){
      for(let dx = -r; dx <= r; dx++){
        if(dx*dx + dy*dy > r2) continue; // round brush
        const x = gx + dx, y = gy + dy;
        if(x<0||x>=cols||y<0||y>=rows) continue;
        const idx = y*cols + x;
        if(groundGrid[idx] === 1 && groundAccessible(x,y)){
          groundGrid[idx] = 0; sandGrid[idx] = 1; removed++; }
      }
    }
    if(removed>0){
      mineFlash.x = gx * SAND_PIXEL + SAND_PIXEL/2; mineFlash.y = groundTop + gy * SAND_PIXEL + SAND_PIXEL/2; mineFlash.ttl = 10;
    }
    return removed;
  }

  // Collect sand into inventory (round brush)
  function collectAt(wx, wy, brushPx=12){
    if(!sandGrid) return 0;
    const {gx, gy} = worldToGrid(wx, wy);
    const r = Math.max(1, Math.round(brushPx / SAND_PIXEL));
    const r2 = r*r;
    let removed = 0;
    for(let dy = -r; dy <= r; dy++){
      for(let dx = -r; dx <= r; dx++){
        if(dx*dx + dy*dy > r2) continue;
        const x = gx + dx, y = gy + dy;
        if(x<0||x>=cols||y<0||y>=rows) continue;
        const idx = y*cols + x;
        if(sandGrid[idx] === 1){ sandGrid[idx] = 0; removed++; }
      }
    }
    if(removed){ heldSand += removed; if(ui.sandCount) ui.sandCount.textContent = heldSand; }
    return removed;
  }

  // Drop sand into grid (round brush)
  function dropAt(wx, wy, brushPx=12){
    if(!sandGrid || heldSand <= 0) return 0;
    const {gx, gy} = worldToGrid(wx, wy);
    const r = Math.max(1, Math.round(brushPx / SAND_PIXEL));
    const r2 = r*r;
    let placed = 0;
    for(let dy = -r; dy <= r && heldSand>0; dy++){
      for(let dx = -r; dx <= r && heldSand>0; dx++){
        if(dx*dx + dy*dy > r2) continue;
        const x = gx + dx;
        if(x<0||x>=cols) continue;
        // place at highest empty cell in that column
        for(let y = 0; y<rows && heldSand>0; y++){
          const idx = y*cols + x;
          if(groundGrid[idx] === 0 && sandGrid[idx] === 0){ sandGrid[idx] = 1; placed++; heldSand--; break; }
        }
      }
    }
    if(ui.sandCount) ui.sandCount.textContent = heldSand;
    return placed;
  }

  // Pointer interaction
  let isPointerDown = false, panStart = null, dragging = false;
  canvas.addEventListener('pointerdown', e=>{
    canvas.setPointerCapture(e.pointerId);
    isPointerDown = true; dragging = false;
    panStart = {x:e.clientX, y:e.clientY, camX: world.camX};
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left; const py = e.clientY - rect.top;
    if(mode === 'mine') mineAt(px, py, 16);
    if(mode === 'collect') collectAt(px, py, 12);
    if(mode === 'drop') dropAt(px, py, 12);
  });
  canvas.addEventListener('pointermove', e=>{
    if(!isPointerDown) return;
    const dx = e.clientX - panStart.x, dy = e.clientY - panStart.y;
    if(Math.hypot(dx,dy) > 6) dragging = true;
    if(dragging && mode === 'pan'){
      world.camX = clamp(panStart.camX - dx, 0, Math.max(0, world.worldW - world.w));
    } else {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left; const py = e.clientY - rect.top;
      if(mode === 'mine') mineAt(px, py, 12);
      if(mode === 'collect') collectAt(px, py, 10);
      if(mode === 'drop') dropAt(px, py, 10);
    }
  });
  canvas.addEventListener('pointerup', e=>{ canvas.releasePointerCapture(e.pointerId); isPointerDown=false; dragging=false; panStart=null; });

  // Reset
  const resetBtn = document.getElementById('reset');
  if (resetBtn) resetBtn.addEventListener('click', ()=>{ initGrid(); heldSand = 0; if (ui.sandCount) ui.sandCount.textContent = heldSand; setMode('pan'); });

  // Main loop
  function loop(){
    // run a few CA steps per frame to let sand settle
    for(let i=0;i<4;i++) step();
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

})();
