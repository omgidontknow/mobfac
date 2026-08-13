"use strict";


/* =========================================================
   SANDWORKS
   Game logic
========================================================= */

const GAME_VERSION = "v0.4.0";


/* =========================================================
   CONFIGURATION
========================================================= */

const CELL = 12;

const WORLD_WIDTH = 140;
const WORLD_HEIGHT = 200;

const DIRT_TO_SAND = 2;

const MINING_RADIUS = 2.25;

const MAX_SAND_PARTICLES = 9000;

const INVENTORY_CAPACITY = 500;

const SAND_GRAINS_PER_CONVERSION = 24;

const COLLECT_RADIUS = 25;

const COLLECT_PER_TAP = 35;

const DROP_GRAINS = 32;


/* =========================================================
   CANVAS
========================================================= */

const canvas =
  document.getElementById("game");

const ctx =
  canvas.getContext("2d");

ctx.imageSmoothingEnabled = false;

let screenW = 0;
let screenH = 0;


function resize() {

  screenW = window.innerWidth;
  screenH = window.innerHeight;

  canvas.width = screenW;
  canvas.height = screenH;
}


window.addEventListener(
  "resize",
  resize
);

resize();


/* =========================================================
   VERSION DISPLAY
========================================================= */

document.getElementById("version").textContent =
  GAME_VERSION;


/* =========================================================
   MATERIALS
========================================================= */

const AIR = 0;
const DIRT = 1;
const STONE = 2;
const BEDROCK = 3;


/* =========================================================
   TERRAIN
========================================================= */

const terrain =
  new Uint8Array(
    WORLD_WIDTH * WORLD_HEIGHT
  );

const grass =
  new Uint8Array(
    WORLD_WIDTH * WORLD_HEIGHT
  );


function index(x, y) {

  return y * WORLD_WIDTH + x;
}


function insideWorld(x, y) {

  return (
    x >= 0 &&
    x < WORLD_WIDTH &&
    y >= 0 &&
    y < WORLD_HEIGHT
  );
}


function getTerrain(x, y) {

  if (!insideWorld(x, y)) {
    return BEDROCK;
  }

  return terrain[index(x, y)];
}


function setTerrain(x, y, material) {

  if (!insideWorld(x, y)) {
    return;
  }

  terrain[index(x, y)] = material;
}


/* =========================================================
   NATURAL SURFACE
========================================================= */

const surfaceHeights =
  new Int16Array(WORLD_WIDTH);


for (let x = 0; x < WORLD_WIDTH; x++) {

  const large =
    Math.sin(x * 0.055) * 3.5;

  const medium =
    Math.sin(x * 0.13) * 1.5;

  const small =
    Math.sin(x * 0.37) * 0.45;

  const irregular =
    Math.sin(x * 1.17) * 0.18;

  surfaceHeights[x] =
    Math.round(
      22 +
      large +
      medium +
      small +
      irregular
    );
}


/* =========================================================
   GENERATE TERRAIN
========================================================= */

for (let x = 0; x < WORLD_WIDTH; x++) {

  const surface =
    surfaceHeights[x];

  for (let y = 0; y < WORLD_HEIGHT; y++) {

    if (y < surface) {

      setTerrain(x, y, AIR);

    } else if (y < surface + 22) {

      setTerrain(x, y, DIRT);

    } else if (
      y < WORLD_HEIGHT - 7
    ) {

      setTerrain(x, y, STONE);

    } else {

      setTerrain(x, y, BEDROCK);
    }
  }

  if (
    getTerrain(x, surface) === DIRT
  ) {

    grass[index(x, surface)] = 1;
  }
}


/* =========================================================
   SAND PARTICLES
========================================================= */

const sandParticles = [];

const sandHash = new Map();

const SAND_HASH_SIZE = 5;


function hashKey(x, y) {

  return (
    Math.floor(x / SAND_HASH_SIZE) +
    "," +
    Math.floor(y / SAND_HASH_SIZE)
  );
}


function clearSandHash() {

  sandHash.clear();
}


function addToSandHash(particle, particleIndex) {

  const key =
    hashKey(
      particle.x,
      particle.y
    );

  let bucket =
    sandHash.get(key);

  if (!bucket) {

    bucket = [];

    sandHash.set(key, bucket);
  }

  bucket.push(particleIndex);
}


function buildSandHash() {

  clearSandHash();

  for (
    let i = 0;
    i < sandParticles.length;
    i++
  ) {

    addToSandHash(
      sandParticles[i],
      i
    );
  }
}


/* =========================================================
   CREATE SAND
========================================================= */

function spawnSand(
  worldX,
  worldY,
  amount,
  burst = true
) {

  if (
    sandParticles.length >=
    MAX_SAND_PARTICLES
  ) {
    return;
  }

  const baseX =
    worldX * CELL +
    CELL / 2;

  const baseY =
    worldY * CELL +
    CELL / 2;

  const remaining =
    MAX_SAND_PARTICLES -
    sandParticles.length;

  amount =
    Math.min(
      amount,
      remaining
    );

  for (let i = 0; i < amount; i++) {

    const spread =
      burst
        ? 5 + Math.random() * 6
        : 3 + Math.random() * 5;

    sandParticles.push({

      x:
        baseX +
        (Math.random() - 0.5) *
        spread,

      y:
        baseY +
        (Math.random() - 0.5) *
        spread,

      vx:
        burst
          ? (Math.random() - 0.5) * 1.3
          : (Math.random() - 0.5) * 0.6,

      vy:
        burst
          ? -Math.random() * 1.2
          : -Math.random() * 0.5,

      size:
        0.65 +
        Math.random() * 0.75,

      colour:
        Math.random() < 0.45
          ? "#d8ad45"
          : Math.random() < 0.7
            ? "#e5bd54"
            : "#f0d06c"
    });
  }
}


/* =========================================================
   TERRAIN COLLISION
========================================================= */

function terrainBlocked(
  x,
  y,
  radius
) {

  const minX =
    Math.floor(
      (x - radius) / CELL
    );

  const maxX =
    Math.floor(
      (x + radius) / CELL
    );

  const minY =
    Math.floor(
      (y - radius) / CELL
    );

  const maxY =
    Math.floor(
      (y + radius) / CELL
    );

  for (
    let ty = minY;
    ty <= maxY;
    ty++
  ) {

    for (
      let tx = minX;
      tx <= maxX;
      tx++
    ) {

      if (
        getTerrain(tx, ty) === AIR
      ) {
        continue;
      }

      const left =
        tx * CELL;

      const right =
        left + CELL;

      const top =
        ty * CELL;

      const bottom =
        top + CELL;

      const nearestX =
        Math.max(
          left,
          Math.min(x, right)
        );

      const nearestY =
        Math.max(
          top,
          Math.min(y, bottom)
        );

      const dx =
        x - nearestX;

      const dy =
        y - nearestY;

      if (
        dx * dx +
        dy * dy <=
        radius * radius
      ) {

        return true;
      }
    }
  }

  return false;
}


/* =========================================================
   SAND COLLISION
========================================================= */

function sandCollision(
  particle,
  particleIndex,
  proposedX,
  proposedY
) {

  const searchRadius = 7;

  const minHX =
    Math.floor(
      (proposedX - searchRadius) /
      SAND_HASH_SIZE
    );

  const maxHX =
    Math.floor(
      (proposedX + searchRadius) /
      SAND_HASH_SIZE
    );

  const minHY =
    Math.floor(
      (proposedY - searchRadius) /
      SAND_HASH_SIZE
    );

  const maxHY =
    Math.floor(
      (proposedY + searchRadius) /
      SAND_HASH_SIZE
    );

  for (
    let hy = minHY;
    hy <= maxHY;
    hy++
  ) {

    for (
      let hx = minHX;
      hx <= maxHX;
      hx++
    ) {

      const bucket =
        sandHash.get(
          hx + "," + hy
        );

      if (!bucket) {
        continue;
      }

      for (
        const otherIndex of bucket
      ) {

        if (
          otherIndex === particleIndex
        ) {
          continue;
        }

        const other =
          sandParticles[
            otherIndex
          ];

        if (!other) {
          continue;
        }

        const dx =
          proposedX - other.x;

        const dy =
          proposedY - other.y;

        const minimumDistance =
          particle.size +
          other.size +
          0.55;

        if (
          dx * dx +
          dy * dy <
          minimumDistance *
          minimumDistance
        ) {

          return true;
        }
      }
    }
  }

  return false;
}


/* =========================================================
   CAN SAND MOVE
========================================================= */

function canSandMove(
  particle,
  particleIndex,
  x,
  y
) {

  if (
    terrainBlocked(
      x,
      y,
      particle.size
    )
  ) {

    return false;
  }

  if (
    sandCollision(
      particle,
      particleIndex,
      x,
      y
    )
  ) {

    return false;
  }

  return true;
}


/* =========================================================
   SAND PHYSICS
========================================================= */

function updateSand() {

  if (
    sandParticles.length === 0
  ) {
    return;
  }

  /*
    Process lower grains first.
  */

  sandParticles.sort(
    (a, b) =>
      b.y - a.y
  );

  buildSandHash();

  for (
    let i = 0;
    i < sandParticles.length;
    i++
  ) {

    const particle =
      sandParticles[i];

    particle.vy += 0.20;

    particle.vy =
      Math.min(
        particle.vy,
        4.5
      );

    particle.vx *= 0.985;

    const nextX =
      particle.x +
      particle.vx;

    const nextY =
      particle.y +
      particle.vy;

    if (
      canSandMove(
        particle,
        i,
        nextX,
        nextY
      )
    ) {

      particle.x = nextX;
      particle.y = nextY;

      continue;
    }

    particle.vy *= -0.05;

    const slide =
      0.7 +
      Math.random() * 0.55;

    const leftX =
      particle.x - slide;

    const rightX =
      particle.x + slide;

    const slideY =
      particle.y + 0.7;

    const canLeft =
      canSandMove(
        particle,
        i,
        leftX,
        slideY
      );

    const canRight =
      canSandMove(
        particle,
        i,
        rightX,
        slideY
      );

    if (
      canLeft &&
      canRight
    ) {

      if (
        Math.random() < 0.5
      ) {

        particle.x =
          leftX;

      } else {

        particle.x =
          rightX;
      }

    } else if (canLeft) {

      particle.x =
        leftX;

    } else if (canRight) {

      particle.x =
        rightX;

    } else {

      particle.vx *= 0.25;
      particle.vy = 0;
    }

    if (
      Math.abs(
        particle.vx
      ) < 0.05
    ) {

      particle.vx =
        (Math.random() - 0.5) *
        0.08;
    }

    particle.x =
      Math.max(
        1,
        Math.min(
          WORLD_WIDTH * CELL - 1,
          particle.x
        )
      );
  }
}


/* =========================================================
   INVENTORY
========================================================= */

const inventory = {

  type: null,

  amount: 0,

  capacity:
    INVENTORY_CAPACITY
};


function updateInventoryUI() {

  const element =
    document.getElementById(
      "inventory"
    );

  if (!inventory.type) {

    element.textContent =
      "Inventory: Empty";

    return;
  }

  element.textContent =
    "Sand × " +
    inventory.amount +
    " / " +
    inventory.capacity;
}


/* =========================================================
   ACTION MODES
========================================================= */

let currentMode =
  "mine";


const hints = {

  mine:
    "Mine exposed ground",

  collect:
    "Collect a wider area of sand",

  drop:
    "Drop a pile of held sand",

  pan:
    "Drag to move around the map"
};


const actionButtons =
  document.querySelectorAll(
    ".action"
  );


actionButtons.forEach(
  button => {

    button.addEventListener(
      "click",
      event => {

        event.preventDefault();

        setMode(
          button.dataset.mode
        );
      }
    );
  }
);


function setMode(mode) {

  currentMode =
    mode;

  actionButtons.forEach(
    button => {

      button.classList.toggle(
        "selected",
        button.dataset.mode === mode
      );
    }
  );

  document.getElementById(
    "hint"
  ).textContent =
    hints[mode];
}


/* =========================================================
   MINING
========================================================= */

let dirtConversion = 0;


function isExposed(x, y) {

  if (
    !insideWorld(x, y)
  ) {
    return false;
  }

  return (

    getTerrain(x + 1, y) === AIR ||

    getTerrain(x - 1, y) === AIR ||

    getTerrain(x, y + 1) === AIR ||

    getTerrain(x, y - 1) === AIR
  );
}


function mineCircular(
  centerX,
  centerY
) {

  const radius =
    MINING_RADIUS;

  const minX =
    Math.floor(
      centerX - radius
    );

  const maxX =
    Math.ceil(
      centerX + radius
    );

  const minY =
    Math.floor(
      centerY - radius
    );

  const maxY =
    Math.ceil(
      centerY + radius
    );

  for (
    let y = minY;
    y <= maxY;
    y++
  ) {

    for (
      let x = minX;
      x <= maxX;
      x++
    ) {

      if (
        !insideWorld(x, y)
      ) {
        continue;
      }

      const dx =
        x - centerX;

      const dy =
        y - centerY;

      if (
        dx * dx +
        dy * dy >
        radius * radius
      ) {
        continue;
      }

      mineBlock(x, y);
    }
  }

  refreshGrass();
}


function mineBlock(x, y) {

  const material =
    getTerrain(x, y);

  if (
    material === AIR
  ) {
    return;
  }

  /*
    Only exposed material can be mined.
  */

  if (
    !isExposed(x, y)
  ) {
    return;
  }


  /* DIRT */

  if (
    material === DIRT
  ) {

    setTerrain(
      x,
      y,
      AIR
    );

    grass[index(x, y)] = 0;

    dirtConversion++;

    if (
      dirtConversion >=
      DIRT_TO_SAND
    ) {

      dirtConversion -=
        DIRT_TO_SAND;

      spawnSand(
        x,
        y,
        SAND_GRAINS_PER_CONVERSION,
        true
      );
    }

    return;
  }


  /* STONE */

  if (
    material === STONE
  ) {

    setTerrain(
      x,
      y,
      AIR
    );

    grass[index(x, y)] = 0;

    spawnStoneDust(x, y);
  }
}


/* =========================================================
   GRASS
========================================================= */

function refreshGrass() {

  grass.fill(0);

  for (
    let x = 0;
    x < WORLD_WIDTH;
    x++
  ) {

    for (
      let y = 0;
      y < WORLD_HEIGHT;
      y++
    ) {

      if (
        getTerrain(x, y) !== DIRT
      ) {
        continue;
      }

      if (
        getTerrain(x, y - 1) === AIR
      ) {

        grass[index(x, y)] = 1;

        break;
      }
    }
  }
}


/* =========================================================
   STONE DUST
========================================================= */

const stoneDust = [];


function spawnStoneDust(x, y) {

  for (let i = 0; i < 6; i++) {

    stoneDust.push({

      x:
        x * CELL +
        CELL / 2 +
        (Math.random() - 0.5) * 8,

      y:
        y * CELL +
        CELL / 2 +
        (Math.random() - 0.5) * 8,

      vx:
        (Math.random() - 0.5) * 0.9,

      vy:
        -Math.random() * 0.9,

      life:
        20 +
        Math.random() * 20
    });
  }
}


function updateStoneDust() {

  for (
    let i =
      stoneDust.length - 1;

    i >= 0;

    i--
  ) {

    const particle =
      stoneDust[i];

    particle.x +=
      particle.vx;

    particle.y +=
      particle.vy;

    particle.vy +=
      0.04;

    particle.life--;

    if (
      particle.life <= 0
    ) {

      stoneDust.splice(
        i,
        1
      );
    }
  }
}


/* =========================================================
   COLLECT
========================================================= */

function collectSand(
  worldX,
  worldY
) {

  if (
    inventory.type &&
    inventory.type !== "sand"
  ) {
    return;
  }

  if (
    inventory.amount >=
    inventory.capacity
  ) {
    return;
  }

  const targetX =
    worldX * CELL +
    CELL / 2;

  const targetY =
    worldY * CELL +
    CELL / 2;

  const radius =
    COLLECT_RADIUS;

  const radiusSquared =
    radius * radius;

  const collected = [];

  for (
    let i = 0;
    i < sandParticles.length;
    i++
  ) {

    const particle =
      sandParticles[i];

    const dx =
      particle.x -
      targetX;

    const dy =
      particle.y -
      targetY;

    if (
      dx * dx +
      dy * dy <=
      radiusSquared
    ) {

      collected.push(i);
    }
  }

  const available =
    inventory.capacity -
    inventory.amount;

  const amountToCollect =
    Math.min(
      COLLECT_PER_TAP,
      available,
      collected.length
    );

  if (
    amountToCollect <= 0
  ) {
    return;
  }

  collected.sort(
    (a, b) => {

      const pa =
        sandParticles[a];

      const pb =
        sandParticles[b];

      const dax =
        pa.x - targetX;

      const day =
        pa.y - targetY;

      const dbx =
        pb.x - targetX;

      const dby =
        pb.y - targetY;

      return (
        dax * dax +
        day * day
      ) - (
        dbx * dbx +
        dby * dby
      );
    }
  );

  const removeSet =
    new Set(
      collected.slice(
        0,
        amountToCollect
      )
    );

  for (
    let i =
      sandParticles.length - 1;

    i >= 0;

    i--
  ) {

    if (
      removeSet.has(i)
    ) {

      sandParticles.splice(
        i,
        1
      );
    }
  }

  inventory.type = "sand";

  inventory.amount +=
    amountToCollect;

  updateInventoryUI();
}


/* =========================================================
   DROP
========================================================= */

function dropSand(
  worldX,
  worldY
) {

  if (
    inventory.type !== "sand"
  ) {
    return;
  }

  if (
    inventory.amount <= 0
  ) {
    return;
  }

  spawnSand(
    worldX,
    worldY,
    DROP_GRAINS,
    false
  );

  if (
    inventory.amount >= 10
  ) {

    spawnSand(
      worldX,
      worldY,
      10,
      false
    );
  }

  inventory.amount--;

  if (
    inventory.amount <= 0
  ) {

    inventory.type = null;
    inventory.amount = 0;
  }

  updateInventoryUI();
}


/* =========================================================
   CAMERA
========================================================= */

let cameraX = 0;
let cameraY = 0;
let zoom = 1;


function clampCamera() {

  const worldW =
    WORLD_WIDTH * CELL;

  const worldH =
    WORLD_HEIGHT * CELL;

  const visibleW =
    screenW / zoom;

  const visibleH =
    screenH / zoom;

  cameraX =
    Math.max(
      0,
      Math.min(
        cameraX,
        Math.max(
          0,
          worldW - visibleW
        )
      )
    );

  cameraY =
    Math.max(
      0,
      Math.min(
        cameraY,
        Math.max(
          0,
          worldH - visibleH
        )
      )
    );
}


function screenToWorld(
  screenX,
  screenY
) {

  return {

    x:
      Math.floor(
        (
          cameraX +
          screenX / zoom
        ) / CELL
      ),

    y:
      Math.floor(
        (
          cameraY +
          screenY / zoom
        ) / CELL
      )
  };
}


/* =========================================================
   POINTER INPUT
========================================================= */

let pointerDown = false;
let dragging = false;

let lastPointerX = 0;
let lastPointerY = 0;


canvas.addEventListener(
  "pointerdown",
  event => {

    pointerDown = true;
    dragging = false;

    lastPointerX =
      event.clientX;

    lastPointerY =
      event.clientY;

    canvas.setPointerCapture(
      event.pointerId
    );
  }
);


canvas.addEventListener(
  "pointermove",
  event => {

    if (!pointerDown) {
      return;
    }

    const dx =
      event.clientX -
      lastPointerX;

    const dy =
      event.clientY -
      lastPointerY;

    if (
      Math.abs(dx) > 3 ||
      Math.abs(dy) > 3
    ) {

      dragging = true;
    }

    if (
      currentMode === "pan" &&
      dragging
    ) {

      cameraX -=
        dx / zoom;

      cameraY -=
        dy / zoom;

      clampCamera();
    }

    lastPointerX =
      event.clientX;

    lastPointerY =
      event.clientY;
  }
);


canvas.addEventListener(
  "pointerup",
  event => {

    if (
      currentMode !== "pan" &&
      !dragging
    ) {

      handleActionTap(
        event.clientX,
        event.clientY
      );
    }

    pointerDown = false;
    dragging = false;
  }
);


/* =========================================================
   PINCH ZOOM
========================================================= */

let pinchStart = null;
let pinchZoom = 1;


canvas.addEventListener(
  "touchstart",
  event => {

    if (
      event.touches.length === 2
    ) {

      pinchStart =
        distance(
          event.touches[0],
          event.touches[1]
        );

      pinchZoom = zoom;
    }
  },
  {
    passive: false
  }
);


canvas.addEventListener(
  "touchmove",
  event => {

    if (
      event.touches.length === 2
    ) {

      event.preventDefault();

      const current =
        distance(
          event.touches[0],
          event.touches[1]
        );

      if (pinchStart) {

        zoom =
          pinchZoom *
          (
            current /
            pinchStart
          );

        zoom =
          Math.max(
            0.7,
            Math.min(
              3,
              zoom
            )
          );

        clampCamera();
      }
    }
  },
  {
    passive: false
  }
);


function distance(a, b) {

  const dx =
    a.clientX -
    b.clientX;

  const dy =
    a.clientY -
    b.clientY;

  return Math.sqrt(
    dx * dx +
    dy * dy
  );
}


/* =========================================================
   ACTION TAP
========================================================= */

function handleActionTap(
  screenX,
  screenY
) {

  const position =
    screenToWorld(
      screenX,
      screenY
    );

  switch (currentMode) {

    case "mine":

      mineCircular(
        position.x,
        position.y
      );

      break;

    case "collect":

      collectSand(
        position.x,
        position.y
      );

      break;

    case "drop":

      dropSand(
        position.x,
        position.y
      );

      break;
  }
}


/* =========================================================
   RENDER
========================================================= */

function render() {

  /* SKY */

  const sky =
    ctx.createLinearGradient(
      0,
      0,
      0,
      screenH
    );

  sky.addColorStop(
    0,
    "#65b8e9"
  );

  sky.addColorStop(
    0.7,
    "#a5daf3"
  );

  sky.addColorStop(
    1,
    "#cceaf5"
  );

  ctx.fillStyle = sky;

  ctx.fillRect(
    0,
    0,
    screenW,
    screenH
  );


  ctx.save();

  ctx.scale(
    zoom,
    zoom
  );

  ctx.translate(
    -cameraX,
    -cameraY
  );


  const startX =
    Math.max(
      0,
      Math.floor(
        cameraX / CELL
      )
    );

  const startY =
    Math.max(
      0,
      Math.floor(
        cameraY / CELL
      )
    );

  const endX =
    Math.min(
      WORLD_WIDTH,
      Math.ceil(
        (
          cameraX +
          screenW / zoom
        ) / CELL
      )
    );

  const endY =
    Math.min(
      WORLD_HEIGHT,
      Math.ceil(
        (
          cameraY +
          screenH / zoom
        ) / CELL
      )
    );


  /* =======================================================
     TERRAIN
  ======================================================= */

  for (
    let y = startY;
    y < endY;
    y++
  ) {

    for (
      let x = startX;
      x < endX;
      x++
    ) {

      const material =
        getTerrain(x, y);

      if (
        material === AIR
      ) {
        continue;
      }

      const px =
        x * CELL;

      const py =
        y * CELL;

      const seed =
        (
          x * 928371 +
          y * 523123
        ) & 255;


      /* DIRT */

      if (
        material === DIRT
      ) {

        ctx.fillStyle =
          "#986640";

        ctx.fillRect(
          px,
          py,
          CELL,
          CELL
        );

        if (
          seed % 7 === 0
        ) {

          ctx.fillStyle =
            "#875a38";

          ctx.fillRect(
            px + 2,
            py + 5,
            2,
            2
          );
        }

        if (
          seed % 11 === 0
        ) {

          ctx.fillStyle =
            "#ae774a";

          ctx.fillRect(
            px + 7,
            py + 3,
            2,
            2
          );
        }

        if (
          seed % 19 === 0
        ) {

          ctx.fillStyle =
            "#7f5435";

          ctx.fillRect(
            px + 5,
            py + 9,
            2,
            1
          );
        }


        /* GRASS */

        if (
          grass[index(x, y)]
        ) {

          ctx.fillStyle =
            "#57943b";

          ctx.fillRect(
            px,
            py,
            CELL,
            3
          );

          if (
            seed % 3 === 0
          ) {

            ctx.fillStyle =
              "#6baa46";

            ctx.fillRect(
              px + 2,
              py,
              2,
              2
            );
          }

          if (
            seed % 5 === 0
          ) {

            ctx.fillStyle =
              "#467f32";

            ctx.fillRect(
              px + 8,
              py + 1,
              2,
              2
            );
          }
        }


      /* STONE */

      } else if (
        material === STONE
      ) {

        ctx.fillStyle =
          "#686d72";

        ctx.fillRect(
          px,
          py,
          CELL,
          CELL
        );

        if (
          seed % 5 === 0
        ) {

          ctx.fillStyle =
            "#575c61";

          ctx.fillRect(
            px + 2,
            py + 3,
            3,
            2
          );
        }

        if (
          seed % 8 === 0
        ) {

          ctx.fillStyle =
            "#7b8084";

          ctx.fillRect(
            px + 7,
            py + 7,
            2,
            2
          );
        }


      /* BEDROCK */

      } else if (
        material === BEDROCK
      ) {

        ctx.fillStyle =
          "#282b2f";

        ctx.fillRect(
          px,
          py,
          CELL,
          CELL
        );

        if (
          seed % 7 === 0
        ) {

          ctx.fillStyle =
            "#35393d";

          ctx.fillRect(
            px + 3,
            py + 3,
            2,
            2
          );
        }
      }
    }
  }


  /* =======================================================
     SAND
  ======================================================= */

  for (
    const particle of sandParticles
  ) {

    if (
      particle.x <
        cameraX - 10 ||

      particle.x >
        cameraX +
        screenW / zoom +
        10 ||

      particle.y <
        cameraY - 10 ||

      particle.y >
        cameraY +
        screenH / zoom +
        10
    ) {

      continue;
    }

    ctx.fillStyle =
      particle.colour;

    ctx.beginPath();

    ctx.arc(
      particle.x,
      particle.y,
      particle.size,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }


  /* =======================================================
     STONE DUST
  ======================================================= */

  for (
    const particle of stoneDust
  ) {

    ctx.fillStyle =
      `rgba(
        210,
        210,
        210,
        ${particle.life / 40}
      )`;

    ctx.fillRect(
      particle.x,
      particle.y,
      2,
      2
    );
  }


  ctx.restore();
}


/* =========================================================
   GAME LOOP
========================================================= */

function gameLoop() {

  updateSand();
  updateSand();

  updateStoneDust();

  render();

  requestAnimationFrame(
    gameLoop
  );
}


/* =========================================================
   START
========================================================= */

updateInventoryUI();

setMode("mine");

requestAnimationFrame(
  gameLoop
);