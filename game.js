"use strict";

/*
============================================================
SANDWORKS
============================================================
Touch-focused 2D digging / sand physics game

VERSION
============================================================
*/

const GAME_VERSION = "v0.5.0";

document.getElementById("version").textContent = GAME_VERSION;


/*
============================================================
CONFIG
============================================================
*/

const CELL = 12;

const WORLD_WIDTH = 140;
const WORLD_HEIGHT = 200;

const DIRT_TO_SAND = 2;

const MINING_RADIUS = 2.35;

const MAX_SAND_PARTICLES = 9000;

const INVENTORY_CAPACITY = 500;

const SAND_GRAINS_PER_CONVERSION = 24;

const COLLECT_RADIUS = 27;

const COLLECT_PER_ACTION = 8;

const DROP_GRAINS_PER_ACTION = 10;

const PHYSICS_STEPS = 4;


/*
============================================================
CANVAS
============================================================
*/

const canvas =
    document.getElementById("game");

const ctx =
    canvas.getContext("2d");

ctx.imageSmoothingEnabled = true;

let screenW = 0;
let screenH = 0;


function resize() {

    screenW =
        window.innerWidth;

    screenH =
        window.innerHeight;

    canvas.width =
        screenW;

    canvas.height =
        screenH;
}


window.addEventListener(
    "resize",
    resize
);

resize();


/*
============================================================
MATERIALS
============================================================
*/

const AIR = 0;
const DIRT = 1;
const STONE = 2;
const BEDROCK = 3;


/*
============================================================
TERRAIN
============================================================
*/

const terrain =
    new Uint8Array(
        WORLD_WIDTH *
        WORLD_HEIGHT
    );

const grass =
    new Uint8Array(
        WORLD_WIDTH *
        WORLD_HEIGHT
    );


function index(x, y) {

    return (
        y * WORLD_WIDTH +
        x
    );
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

    terrain[index(x, y)] =
        material;
}


/*
============================================================
DETERMINISTIC TERRAIN NOISE
============================================================
*/

function noise2D(x, y) {

    let n =
        x * 374761393 +
        y * 668265263;

    n =
        (n ^ (n >> 13)) *
        1274126177;

    n ^=
        n >> 16;

    return (
        (n >>> 0) /
        4294967295
    );
}


/*
============================================================
TERRAIN GENERATION
============================================================
*/

const surfaceHeights =
    new Int16Array(
        WORLD_WIDTH
    );


for (
    let x = 0;
    x < WORLD_WIDTH;
    x++
) {

    const broad =
        Math.sin(
            x * 0.055
        ) * 3.5;

    const medium =
        Math.sin(
            x * 0.13
        ) * 1.4;

    const small =
        Math.sin(
            x * 0.31
        ) * 0.55;

    const irregular =
        (
            noise2D(x, 100) -
            0.5
        ) * 0.9;

    surfaceHeights[x] =
        Math.round(
            22 +
            broad +
            medium +
            small +
            irregular
        );
}


for (
    let x = 0;
    x < WORLD_WIDTH;
    x++
) {

    const surface =
        surfaceHeights[x];

    for (
        let y = 0;
        y < WORLD_HEIGHT;
        y++
    ) {

        if (y < surface) {

            setTerrain(
                x,
                y,
                AIR
            );

        } else if (
            y < surface + 22
        ) {

            setTerrain(
                x,
                y,
                DIRT
            );

        } else if (
            y < WORLD_HEIGHT - 7
        ) {

            setTerrain(
                x,
                y,
                STONE
            );

        } else {

            setTerrain(
                x,
                y,
                BEDROCK
            );
        }
    }

    grass[
        index(x, surface)
    ] = 1;
}


/*
============================================================
SAND PARTICLES
============================================================
*/

const sandParticles = [];


/*
============================================================
SAND HASH
============================================================
*/

const sandHash =
    new Map();

const SAND_HASH_SIZE = 8;


function hashKey(x, y) {

    return (
        Math.floor(
            x / SAND_HASH_SIZE
        ) +
        "," +
        Math.floor(
            y / SAND_HASH_SIZE
        )
    );
}


function buildSandHash() {

    sandHash.clear();

    for (
        let i = 0;
        i < sandParticles.length;
        i++
    ) {

        const p =
            sandParticles[i];

        const key =
            hashKey(
                p.x,
                p.y
            );

        let bucket =
            sandHash.get(key);

        if (!bucket) {

            bucket = [];

            sandHash.set(
                key,
                bucket
            );
        }

        bucket.push(i);
    }
}


/*
============================================================
CREATE SAND
============================================================
*/

function spawnSand(
    worldX,
    worldY,
    amount
) {

    if (
        sandParticles.length >=
        MAX_SAND_PARTICLES
    ) {
        return;
    }


    amount =
        Math.min(
            amount,
            MAX_SAND_PARTICLES -
            sandParticles.length
        );


    const baseX =
        worldX * CELL +
        CELL * 0.5;

    const baseY =
        worldY * CELL +
        CELL * 0.5;


    for (
        let i = 0;
        i < amount;
        i++
    ) {

        /*
        IMPORTANT:

        No visible burst.

        Grains start essentially at rest and
        gravity takes over on the very next
        physics substep.
        */

        sandParticles.push({

            x:
                baseX +
                (
                    Math.random() -
                    0.5
                ) * 2.0,

            y:
                baseY +
                (
                    Math.random() -
                    0.5
                ) * 2.0,

            vx:
                (
                    Math.random() -
                    0.5
                ) * 0.08,

            vy: 0,

            size:
                0.72 +
                Math.random() * 0.42,

            settled: false,

            shade:
                Math.random()
        });
    }
}


/*
============================================================
COLLISION
============================================================
*/

function solidAtPixel(
    x,
    y
) {

    const tx =
        Math.floor(
            x / CELL
        );

    const ty =
        Math.floor(
            y / CELL
        );

    return (
        getTerrain(
            tx,
            ty
        ) !== AIR
    );
}


function sandHitsGround(
    p,
    proposedY
) {

    return solidAtPixel(
        p.x,
        proposedY +
        p.size +
        0.5
    );
}


function sandHitsSide(
    p,
    proposedX,
    proposedY
) {

    const r =
        p.size;

    return (
        solidAtPixel(
            proposedX - r,
            proposedY
        ) ||

        solidAtPixel(
            proposedX + r,
            proposedY
        )
    );
}


function sandHitsSand(
    p,
    particleIndex,
    proposedX,
    proposedY
) {

    const radius = 6;

    const minX =
        Math.floor(
            (
                proposedX -
                radius
            ) /
            SAND_HASH_SIZE
        );

    const maxX =
        Math.floor(
            (
                proposedX +
                radius
            ) /
            SAND_HASH_SIZE
        );

    const minY =
        Math.floor(
            (
                proposedY -
                radius
            ) /
            SAND_HASH_SIZE
        );

    const maxY =
        Math.floor(
            (
                proposedY +
                radius
            ) /
            SAND_HASH_SIZE
        );


    for (
        let hy = minY;
        hy <= maxY;
        hy++
    ) {

        for (
            let hx = minX;
            hx <= maxX;
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
                    otherIndex ===
                    particleIndex
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
                    proposedX -
                    other.x;

                const dy =
                    proposedY -
                    other.y;

                const distanceSquared =
                    dx * dx +
                    dy * dy;

                const minimum =
                    p.size +
                    other.size +
                    0.3;


                if (
                    distanceSquared <
                    minimum * minimum
                ) {

                    return true;
                }
            }
        }
    }

    return false;
}


/*
============================================================
SAND PHYSICS
============================================================
*/

function physicsStep() {

    if (
        sandParticles.length === 0
    ) {
        return;
    }


    /*
    Build collision map from the current state.
    */

    buildSandHash();


    /*
    Bottom-most grains first.
    */

    sandParticles.sort(
        (a, b) =>
            b.y - a.y
    );


    for (
        let i = 0;
        i < sandParticles.length;
        i++
    ) {

        const p =
            sandParticles[i];


        /*
        Gravity.

        Small increments are used because the physics
        now runs several times per rendered frame.
        */

        p.vy += 0.24;

        p.vy =
            Math.min(
                p.vy,
                4.2
            );


        p.vx *= 0.985;


        const nextY =
            p.y + p.vy;


        /*
        ----------------------------------------------------
        FREE FALL
        ----------------------------------------------------
        */

        const ground =
            sandHitsGround(
                p,
                nextY
            );

        const otherSand =
            sandHitsSand(
                p,
                i,
                p.x,
                nextY
            );


        if (
            !ground &&
            !otherSand
        ) {

            p.y =
                nextY;

            p.settled =
                false;

            continue;
        }


        /*
        ----------------------------------------------------
        LANDED
        ----------------------------------------------------
        */

        p.vy = 0;


        /*
        Try to move sideways.

        The direction alternates naturally, which avoids
        creating perfectly symmetrical artificial piles.
        */

        const direction =
            Math.random() < 0.5
                ? -1
                : 1;


        const slide =
            0.7 +
            Math.random() * 1.3;


        let moved = false;


        for (
            const dir of [
                direction,
                -direction
            ]
        ) {

            const testX =
                p.x +
                dir * slide;

            const testY =
                p.y +
                0.45;


            const blocked =
                sandHitsSide(
                    p,
                    testX,
                    testY
                ) ||

                sandHitsSand(
                    p,
                    i,
                    testX,
                    testY
                );


            if (!blocked) {

                p.x =
                    testX;

                p.y =
                    testY;

                p.settled =
                    false;

                moved = true;

                break;
            }
        }


        if (!moved) {

            p.settled =
                true;

            p.vx *= 0.15;

            p.vy = 0;
        }
    }


    /*
    Keep particles inside world.
    */

    for (
        const p of sandParticles
    ) {

        p.x =
            Math.max(
                1,
                Math.min(
                    WORLD_WIDTH *
                    CELL - 1,
                    p.x
                )
            );

        p.y =
            Math.max(
                1,
                Math.min(
                    WORLD_HEIGHT *
                    CELL - 2,
                    p.y
                )
            );
    }
}


function updateSand() {

    /*
    Several tiny physics steps means newly created
    sand begins falling essentially immediately rather
    than appearing as a static clump for a frame.
    */

    for (
        let step = 0;
        step < PHYSICS_STEPS;
        step++
    ) {

        physicsStep();
    }
}


/*
============================================================
INVENTORY
============================================================
*/

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


/*
============================================================
ACTION MODES
============================================================
*/

let currentMode =
    "mine";


const hints = {

    mine:
        "Hold and drag to mine",

    collect:
        "Hold and drag across sand to collect",

    drop:
        "Hold and drag to drop sand",

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
                button.dataset.mode ===
                mode
            );
        }
    );


    document.getElementById(
        "hint"
    ).textContent =
        hints[mode];
}


/*
============================================================
MINING
============================================================
*/

let dirtConversion = 0;


function isExposed(x, y) {

    if (
        !insideWorld(x, y)
    ) {
        return false;
    }


    return (

        getTerrain(
            x + 1,
            y
        ) === AIR ||

        getTerrain(
            x - 1,
            y
        ) === AIR ||

        getTerrain(
            x,
            y + 1
        ) === AIR ||

        getTerrain(
            x,
            y - 1
        ) === AIR
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


            mineBlock(
                x,
                y
            );
        }
    }


    refreshGrass();
}


function mineBlock(
    x,
    y
) {

    const material =
        getTerrain(x, y);


    if (
        material === AIR
    ) {
        return;
    }


    if (
        !isExposed(x, y)
    ) {
        return;
    }


    if (
        material === DIRT
    ) {

        setTerrain(
            x,
            y,
            AIR
        );


        grass[
            index(x, y)
        ] = 0;


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
                SAND_GRAINS_PER_CONVERSION
            );
        }


        return;
    }


    if (
        material === STONE
    ) {

        setTerrain(
            x,
            y,
            AIR
        );


        grass[
            index(x, y)
        ] = 0;


        spawnStoneDust(
            x,
            y
        );
    }
}


/*
============================================================
GRASS
============================================================
*/

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
                getTerrain(x, y) !==
                DIRT
            ) {
                continue;
            }


            if (
                getTerrain(
                    x,
                    y - 1
                ) === AIR
            ) {

                grass[
                    index(x, y)
                ] = 1;

                break;
            }
        }
    }
}


/*
============================================================
STONE DUST
============================================================
*/

const stoneDust = [];


function spawnStoneDust(
    x,
    y
) {

    for (
        let i = 0;
        i < 6;
        i++
    ) {

        stoneDust.push({

            x:
                x * CELL +
                CELL / 2 +
                (
                    Math.random() -
                    0.5
                ) * 8,

            y:
                y * CELL +
                CELL / 2 +
                (
                    Math.random() -
                    0.5
                ) * 8,

            vx:
                (
                    Math.random() -
                    0.5
                ) * 0.9,

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

        const p =
            stoneDust[i];


        p.x +=
            p.vx;

        p.y +=
            p.vy;

        p.vy +=
            0.04;

        p.life--;


        if (
            p.life <= 0
        ) {

            stoneDust.splice(
                i,
                1
            );
        }
    }
}


/*
============================================================
COLLECT
============================================================
*/

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


    const candidates = [];


    for (
        let i = 0;
        i < sandParticles.length;
        i++
    ) {

        const p =
            sandParticles[i];


        const dx =
            p.x -
            targetX;

        const dy =
            p.y -
            targetY;


        if (
            dx * dx +
            dy * dy <=
            radiusSquared
        ) {

            candidates.push(i);
        }
    }


    const available =
        inventory.capacity -
        inventory.amount;


    const amount =
        Math.min(
            COLLECT_PER_ACTION,
            available,
            candidates.length
        );


    if (
        amount <= 0
    ) {
        return;
    }


    /*
    Take the nearest grains first.
    */

    candidates.sort(
        (a, b) => {

            const pa =
                sandParticles[a];

            const pb =
                sandParticles[b];


            const dax =
                pa.x -
                targetX;

            const day =
                pa.y -
                targetY;

            const dbx =
                pb.x -
                targetX;

            const dby =
                pb.y -
                targetY;


            return (
                dax * dax +
                day * day
            ) -
            (
                dbx * dbx +
                dby * dby
            );
        }
    );


    const remove =
        new Set(
            candidates.slice(
                0,
                amount
            )
        );


    for (
        let i =
            sandParticles.length - 1;
        i >= 0;
        i--
    ) {

        if (
            remove.has(i)
        ) {

            sandParticles.splice(
                i,
                1
            );
        }
    }


    inventory.type =
        "sand";


    inventory.amount +=
        amount;


    updateInventoryUI();
}


/*
============================================================
DROP
============================================================
*/

function dropSand(
    worldX,
    worldY
) {

    if (
        inventory.type !==
        "sand"
    ) {
        return;
    }


    if (
        inventory.amount <= 0
    ) {
        return;
    }


    /*
    Each drag event adds a small number of grains.

    This creates a continuous stream rather than
    a visible block/clump.
    */

    const amount =
        Math.min(
            DROP_GRAINS_PER_ACTION,
            inventory.amount
        );


    spawnSand(
        worldX,
        worldY,
        amount
    );


    inventory.amount -=
        amount;


    if (
        inventory.amount <= 0
    ) {

        inventory.amount = 0;

        inventory.type = null;
    }


    updateInventoryUI();
}


/*
============================================================
CAMERA
============================================================
*/

let cameraX = 0;
let cameraY = 0;

let zoom = 1;


function clampCamera() {

    const worldW =
        WORLD_WIDTH *
        CELL;

    const worldH =
        WORLD_HEIGHT *
        CELL;


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
                    worldW -
                    visibleW
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
                    worldH -
                    visibleH
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
                ) /
                CELL
            ),

        y:
            Math.floor(
                (
                    cameraY +
                    screenY / zoom
                ) /
                CELL
            )
    };
}


/*
============================================================
TOUCH / POINTER INPUT
============================================================
*/

let pointerDown = false;

let dragging = false;

let lastPointerX = 0;
let lastPointerY = 0;

let lastActionWorldX = null;
let lastActionWorldY = null;


canvas.addEventListener(
    "pointerdown",
    event => {

        pointerDown = true;

        dragging = false;


        lastPointerX =
            event.clientX;

        lastPointerY =
            event.clientY;


        lastActionWorldX = null;
        lastActionWorldY = null;


        canvas.setPointerCapture(
            event.pointerId
        );


        /*
        Immediate action at the point where the
        finger first touches.
        */

        if (
            currentMode !==
            "pan"
        ) {

            performDragAction(
                event.clientX,
                event.clientY
            );
        }
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
            Math.abs(dx) > 2 ||
            Math.abs(dy) > 2
        ) {

            dragging = true;
        }


        if (
            currentMode ===
            "pan"
        ) {

            cameraX -=
                dx / zoom;

            cameraY -=
                dy / zoom;

            clampCamera();

        } else {

            /*
            THIS IS THE IMPORTANT CHANGE.

            While the finger remains down,
            collect/drop continuously as it moves.
            */

            performDragAction(
                event.clientX,
                event.clientY
            );
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

        pointerDown = false;

        dragging = false;

        lastActionWorldX = null;
        lastActionWorldY = null;
    }
);


canvas.addEventListener(
    "pointercancel",
    () => {

        pointerDown = false;

        dragging = false;

        lastActionWorldX = null;
        lastActionWorldY = null;
    }
);


/*
============================================================
CONTINUOUS ACTION
============================================================
*/

function performDragAction(
    screenX,
    screenY
) {

    const position =
        screenToWorld(
            screenX,
            screenY
        );


    /*
    Don't repeatedly act on the same map cell.

    As the finger moves across the screen it naturally
    activates neighbouring cells.
    */

    if (
        position.x ===
            lastActionWorldX &&
        position.y ===
            lastActionWorldY
    ) {

        return;
    }


    lastActionWorldX =
        position.x;

    lastActionWorldY =
        position.y;


    switch (
        currentMode
    ) {

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


/*
============================================================
PINCH ZOOM
============================================================
*/

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

            pinchZoom =
                zoom;
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


/*
============================================================
SKY TEXTURE
============================================================
*/

function drawSkyTexture() {

    /*
    Very sparse, very low-opacity atmospheric variation.

    It is deliberately irregular rather than tiled.
    */

    ctx.save();


    ctx.globalAlpha = 0.045;


    for (
        let i = 0;
        i < 110;
        i++
    ) {

        const x =
            (
                noise2D(i, 600) *
                screenW
            );

        const y =
            (
                noise2D(i, 700) *
                screenH *
                0.62
            );


        const size =
            20 +
            noise2D(i, 800) *
            70;


        const gradient =
            ctx.createRadialGradient(
                x,
                y,
                0,
                x,
                y,
                size
            );


        gradient.addColorStop(
            0,
            "#ffffff"
        );

        gradient.addColorStop(
            1,
            "rgba(255,255,255,0)"
        );


        ctx.fillStyle =
            gradient;


        ctx.beginPath();

        ctx.arc(
            x,
            y,
            size,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }


    ctx.restore();
}


/*
============================================================
GROUND TEXTURE
============================================================
*/

function terrainColour(
    material,
    x,
    y
) {

    const n =
        noise2D(
            x,
            y
        );


    if (
        material === DIRT
    ) {

        /*
        Much narrower colour range than before.
        */

        const base =
            142 +
            Math.floor(
                n * 18
            );


        return `rgb(
            ${base + 12},
            ${base - 35},
            ${base - 62}
        )`;
    }


    if (
        material === STONE
    ) {

        const base =
            92 +
            Math.floor(
                n * 18
            );


        return `rgb(
            ${base},
            ${base + 2},
            ${base + 3}
        )`;
    }


    return "#292c2f";
}


/*
============================================================
RENDER TERRAIN
============================================================
*/

function renderTerrain(
    startX,
    endX,
    startY,
    endY
) {

    /*
    Draw material bodies first.

    We slightly overlap neighbouring cells so the
    underlying grid is much less visually apparent.
    */

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
                getTerrain(
                    x,
                    y
                );


            if (
                material === AIR
            ) {
                continue;
            }


            const px =
                x * CELL;

            const py =
                y * CELL;


            ctx.fillStyle =
                terrainColour(
                    material,
                    x,
                    y
                );


            ctx.fillRect(
                px - 0.25,
                py - 0.25,
                CELL + 0.5,
                CELL + 0.5
            );


            /*
            Irregular material texture.

            Each location is unique, so there is no obvious
            repeating pattern.
            */

            const n1 =
                noise2D(
                    x * 3 + 17,
                    y * 7 + 31
                );

            const n2 =
                noise2D(
                    x * 11 + 5,
                    y * 2 + 71
                );


            if (
                n1 > 0.78
            ) {

                ctx.globalAlpha =
                    0.12;

                ctx.fillStyle =
                    material === DIRT
                        ? "#d09a62"
                        : "#b0b2b0";


                ctx.beginPath();

                ctx.arc(
                    px +
                    n2 * CELL,
                    py +
                    (
                        1 -
                        n1
                    ) *
                    CELL,
                    0.7 +
                    n2 * 1.1,
                    0,
                    Math.PI * 2
                );

                ctx.fill();

                ctx.globalAlpha =
                    1;
            }
        }
    }


    /*
    --------------------------------------------------------
    SOFTEN THE SURFACE
    --------------------------------------------------------

    Rather than drawing a perfectly square grass edge,
    draw a continuous irregular green/brown surface.
    */

    ctx.beginPath();


    let first = true;


    for (
        let x = startX;
        x <= endX;
        x++
    ) {

        const surface =
            surfaceHeights[
                Math.max(
                    0,
                    Math.min(
                        WORLD_WIDTH - 1,
                        x
                    )
                )
            ];


        const px =
            x * CELL;


        const py =
            surface * CELL;


        if (first) {

            ctx.moveTo(
                px,
                py
            );

            first = false;

        } else {

            /*
            A slightly curved transition removes the
            hard staircase appearance.
            */

            const previous =
                surfaceHeights[
                    Math.max(
                        0,
                        x - 1
                    )
                ] * CELL;


            const midpoint =
                (
                    previous +
                    py
                ) / 2;


            ctx.quadraticCurveTo(
                px - CELL / 2,
                midpoint,
                px,
                py
            );
        }
    }


    for (
        let x = endX;
        x >= startX;
        x--
    ) {

        const surface =
            surfaceHeights[
                Math.max(
                    0,
                    Math.min(
                        WORLD_WIDTH - 1,
                        x
                    )
                )
            ];


        const px =
            x * CELL;

        const py =
            surface * CELL +
            3;


        ctx.lineTo(
            px,
            py
        );
    }


    ctx.closePath();


    ctx.fillStyle =
        "#57903e";

    ctx.globalAlpha =
        0.85;

    ctx.fill();

    ctx.globalAlpha =
        1;


    /*
    Small irregular surface highlights.
    */

    for (
        let x = startX;
        x < endX;
        x++
    ) {

        const surface =
            surfaceHeights[x];


        const n =
            noise2D(
                x,
                999
            );


        if (
            n > 0.42
        ) {

            ctx.fillStyle =
                n > 0.72
                    ? "#6da34b"
                    : "#4c8139";


            ctx.globalAlpha =
                0.45;


            ctx.beginPath();

            ctx.arc(
                x * CELL +
                n * CELL,
                surface * CELL +
                1 +
                n * 2,
                0.7 +
                n,
                0,
                Math.PI * 2
            );

            ctx.fill();

            ctx.globalAlpha =
                1;
        }
    }
}


/*
============================================================
SAND RENDERING
============================================================
*/

function renderSand() {

    /*
    Sand uses a very narrow colour range.

    The individual grain itself is almost the same colour.
    Pile shading comes from density/overlap rather than
    lots of different coloured pixels.
    */

    for (
        const p of sandParticles
    ) {

        if (
            p.x <
                cameraX - 10 ||
            p.x >
                cameraX +
                screenW / zoom +
                10 ||
            p.y <
                cameraY - 10 ||
            p.y >
                cameraY +
                screenH / zoom +
                10
        ) {

            continue;
        }


        ctx.fillStyle =
            p.shade > 0.5
                ? "#e3bd5d"
                : "#dfb956";


        ctx.beginPath();


        ctx.arc(
            p.x,
            p.y,
            p.size,
            0,
            Math.PI * 2
        );


        ctx.fill();
    }


    /*
    Very subtle pile-edge shadow.

    We only shade grains which are sitting against
    other grains, giving the pile a soft three-dimensional
    edge without making individual grains multicoloured.
    */

    ctx.globalAlpha =
        0.10;


    for (
        const p of sandParticles
    ) {

        if (
            !p.settled
        ) {
            continue;
        }


        ctx.fillStyle =
            "#9a742c";


        ctx.beginPath();

        ctx.arc(
            p.x,
            p.y + 0.7,
            p.size * 0.7,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }


    ctx.globalAlpha =
        1;
}


/*
============================================================
RENDER
============================================================
*/

function render() {

    /*
    SKY
    */

    const sky =
        ctx.createLinearGradient(
            0,
            0,
            0,
            screenH
        );


    sky.addColorStop(
        0,
        "#61b5e6"
    );

    sky.addColorStop(
        0.55,
        "#91d0ee"
    );

    sky.addColorStop(
        1,
        "#c5e7f3"
    );


    ctx.fillStyle =
        sky;


    ctx.fillRect(
        0,
        0,
        screenW,
        screenH
    );


    drawSkyTexture();


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
            ) - 1
        );


    const startY =
        Math.max(
            0,
            Math.floor(
                cameraY / CELL
            ) - 1
        );


    const endX =
        Math.min(
            WORLD_WIDTH,
            Math.ceil(
                (
                    cameraX +
                    screenW / zoom
                ) / CELL
            ) + 1
        );


    const endY =
        Math.min(
            WORLD_HEIGHT,
            Math.ceil(
                (
                    cameraY +
                    screenH / zoom
                ) / CELL
            ) + 1
        );


    renderTerrain(
        startX,
        endX,
        startY,
        endY
    );


    renderSand();


    /*
    Stone dust
    */

    for (
        const p of stoneDust
    ) {

        ctx.fillStyle =
            `rgba(
                210,
                210,
                210,
                ${p.life / 40}
            )`;


        ctx.beginPath();

        ctx.arc(
            p.x,
            p.y,
            1.2,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }


    ctx.restore();
}


/*
============================================================
GAME LOOP
============================================================
*/

function gameLoop() {

    updateSand();

    updateStoneDust();

    render();

    requestAnimationFrame(
        gameLoop
    );
}


/*
============================================================
START
============================================================
*/

updateInventoryUI();

setMode("mine");

requestAnimationFrame(
    gameLoop
);