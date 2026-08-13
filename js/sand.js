import {
    CELL,
    MAX_SAND,
    SAND_GRAIN_SIZE,
    SAND_GRAVITY,
    SAND_MAX_FALL_SPEED,
    COLLECT_RADIUS
} from "./config.js";

import {
    getTerrain
} from "./world.js";

import {
    addSand
} from "./inventory.js";


export const sand = [];


/* =========================================================
   SPATIAL HASH
========================================================= */

const HASH_SIZE = 8;
const buckets = new Map();


function bucketKey(x, y) {
    return (
        Math.floor(x / HASH_SIZE) +
        "," +
        Math.floor(y / HASH_SIZE)
    );
}


function rebuildBuckets() {
    buckets.clear();

    for (const particle of sand) {
        const key = bucketKey(
            particle.x,
            particle.y
        );

        let bucket = buckets.get(key);

        if (!bucket) {
            bucket = [];
            buckets.set(key, bucket);
        }

        bucket.push(particle);
    }
}


function nearbyParticles(x, y, range) {
    const results = [];

    const minX =
        Math.floor((x - range) / HASH_SIZE);

    const maxX =
        Math.floor((x + range) / HASH_SIZE);

    const minY =
        Math.floor((y - range) / HASH_SIZE);

    const maxY =
        Math.floor((y + range) / HASH_SIZE);

    for (let by = minY; by <= maxY; by++) {
        for (let bx = minX; bx <= maxX; bx++) {
            const bucket =
                buckets.get(bx + "," + by);

            if (!bucket) {
                continue;
            }

            for (const particle of bucket) {
                results.push(particle);
            }
        }
    }

    return results;
}


/* =========================================================
   TERRAIN
========================================================= */

function terrainAtPixel(x, y) {
    return getTerrain(
        Math.floor(x / CELL),
        Math.floor(y / CELL)
    );
}


/*
 * Test whether a circular grain overlaps solid terrain
 * at a proposed position.
 */
function hitsTerrain(particle, x, y) {
    const r = particle.r;

    return (
        terrainAtPixel(x - r, y - r) !== 0 ||
        terrainAtPixel(x + r, y - r) !== 0 ||
        terrainAtPixel(x - r, y + r) !== 0 ||
        terrainAtPixel(x + r, y + r) !== 0
    );
}


/*
 * Find the top surface of terrain immediately underneath
 * a grain.
 */
function terrainSupportY(particle, x = particle.x) {
    const bottom =
        particle.y + particle.r;

    const cellY =
        Math.floor(bottom / CELL);

    const leftX =
        Math.floor(
            (x - particle.r) / CELL
        );

    const centreX =
        Math.floor(x / CELL);

    const rightX =
        Math.floor(
            (x + particle.r) / CELL
        );

    const cells = [
        [leftX, cellY],
        [centreX, cellY],
        [rightX, cellY]
    ];

    let highestTop = Infinity;

    for (const [cellX, y] of cells) {
        if (getTerrain(cellX, y) !== 0) {
            highestTop =
                Math.min(
                    highestTop,
                    y * CELL
                );
        }
    }

    return highestTop === Infinity
        ? null
        : highestTop;
}


/* =========================================================
   SAND COLLISION
========================================================= */


/*
 * Find a grain directly underneath the proposed position.
 */
function grainSupportY(particle, x, y) {
    const diameter =
        particle.r * 2;

    let best = null;
    let bestY = Infinity;

    for (
        const other of nearbyParticles(
            x,
            y,
            diameter * 2
        )
    ) {
        if (other === particle) {
            continue;
        }

        const dx =
            Math.abs(x - other.x);

        /*
         * The two grains need horizontal overlap.
         */
        if (
            dx >
            particle.r + other.r
        ) {
            continue;
        }

        /*
         * Only grains below us can provide support.
         */
        if (
            other.y <= particle.y
        ) {
            continue;
        }

        const top =
            other.y - other.r;

        if (top < bestY) {
            best = other;
            bestY = top;
        }
    }

    return best;
}


/*
 * Does a grain overlap another grain at this position?
 */
function overlapsSand(
    particle,
    x,
    y
) {
    const range =
        particle.r * 2.2;

    for (
        const other of nearbyParticles(
            x,
            y,
            range
        )
    ) {
        if (other === particle) {
            continue;
        }

        const dx =
            x - other.x;

        const dy =
            y - other.y;

        const minimum =
            particle.r +
            other.r;

        if (
            dx * dx +
            dy * dy <
            minimum * minimum
        ) {
            return true;
        }
    }

    return false;
}


/* =========================================================
   SETTLING
========================================================= */


/*
 * Find the exact Y position at which a grain can rest at X.
 */
function findRestingY(
    particle,
    x,
    currentY
) {
    /*
     * Terrain support.
     */
    const terrainY =
        terrainSupportY(
            particle,
            x
        );

    let supportY =
        terrainY === null
            ? Infinity
            : terrainY - particle.r;


    /*
     * Sand support.
     */
    const grain =
        grainSupportY(
            particle,
            x,
            currentY
        );

    if (grain) {
        supportY =
            Math.min(
                supportY,
                grain.y -
                grain.r -
                particle.r
            );
    }


    if (
        supportY === Infinity
    ) {
        return null;
    }


    /*
     * The proposed resting position must actually be
     * collision-free.
     */
    if (
        hitsTerrain(
            particle,
            x,
            supportY - 0.01
        )
    ) {
        return null;
    }


    if (
        overlapsSand(
            particle,
            x,
            supportY
        )
    ) {
        return null;
    }


    return supportY;
}


/*
 * Try to settle the grain one diameter to either side.
 *
 * We only accept the move if the new position has a real
 * support underneath it. This is what makes the pile stable
 * instead of jittery.
 */
function trySettleSideways(particle) {
    const step =
        particle.r * 2;

    const directions =
        Math.random() < 0.5
            ? [-1, 1]
            : [1, -1];

    for (const direction of directions) {
        const x =
            particle.x +
            direction * step;

        /*
         * The candidate must be clear at its current height.
         */
        if (
            hitsTerrain(
                particle,
                x,
                particle.y
            )
        ) {
            continue;
        }

        if (
            overlapsSand(
                particle,
                x,
                particle.y
            )
        ) {
            continue;
        }

        /*
         * There must be something below this new position.
         */
        const restingY =
            findRestingY(
                particle,
                x,
                particle.y + CELL
            );

        if (
            restingY === null
        ) {
            continue;
        }

        /*
         * Don't allow a sideways move to jump upward.
         */
        if (
            restingY >
            particle.y + particle.r * 2
        ) {
            continue;
        }

        particle.x = x;
        particle.y = restingY;
        particle.vy = 0;
        particle.supported = true;

        return true;
    }

    return false;
}


/* =========================================================
   SPAWNING
========================================================= */

export function spawnSand(
    cellX,
    cellY,
    amount
) {
    if (
        sand.length >= MAX_SAND
    ) {
        return;
    }

    amount =
        Math.min(
            amount,
            MAX_SAND - sand.length
        );

    const x =
        cellX * CELL +
        CELL / 2;

    const y =
        cellY * CELL +
        CELL / 2;

    for (
        let i = 0;
        i < amount;
        i++
    ) {
        sand.push({
            x:
                x +
                (
                    Math.random() - 0.5
                ) * 0.8,

            y:
                y +
                (
                    Math.random() - 0.5
                ) * 0.8,

            vx: 0,

            vy: 0,

            r:
                SAND_GRAIN_SIZE +
                (
                    Math.random() - 0.5
                ) * 0.08,

            supported: false
        });
    }
}


/* =========================================================
   PHYSICS
========================================================= */

export function updateSand() {
    if (!sand.length) {
        return;
    }

    const STEPS = 4;


    for (
        let step = 0;
        step < STEPS;
        step++
    ) {
        rebuildBuckets();


        /*
         * Process bottom grains first.
         *
         * Once a lower grain has settled, grains above it
         * can use it as support during the same update.
         */
        sand.sort(
            (a, b) =>
                b.y - a.y
        );


        for (const particle of sand) {

            /*
             * Supported grains are deliberately left alone.
             *
             * This is important: settled grains should not
             * continually re-evaluate their position and jitter.
             */
            if (
                particle.supported
            ) {
                continue;
            }


            /*
             * Gravity.
             */
            particle.vy =
                Math.min(
                    particle.vy +
                    SAND_GRAVITY,
                    SAND_MAX_FALL_SPEED
                );


            const nextY =
                particle.y +
                particle.vy;


            /* -------------------------------------------------
               FREE FALL
            ------------------------------------------------- */

            if (
                !hitsTerrain(
                    particle,
                    particle.x,
                    nextY
                ) &&
                !overlapsSand(
                    particle,
                    particle.x,
                    nextY
                )
            ) {
                particle.y =
                    nextY;

                continue;
            }


            /* -------------------------------------------------
               OBSTACLE — TRY TO FLOW AROUND IT
            ------------------------------------------------- */

            if (
                trySettleSideways(
                    particle
                )
            ) {
                continue;
            }


            /* -------------------------------------------------
               SETTLE ON TERRAIN
            ------------------------------------------------- */

            const terrainY =
                terrainSupportY(
                    particle,
                    particle.x
                );

            if (
                terrainY !== null
            ) {
                particle.y =
                    terrainY -
                    particle.r;

                particle.vy = 0;
                particle.supported = true;

                continue;
            }


            /* -------------------------------------------------
               SETTLE ON ANOTHER GRAIN
            ------------------------------------------------- */

            const grain =
                grainSupportY(
                    particle,
                    particle.x,
                    nextY
                );

            if (grain) {
                particle.y =
                    grain.y -
                    grain.r -
                    particle.r;

                particle.vy = 0;
                particle.supported = true;

                continue;
            }


            /*
             * If we reached this point, don't let the particle
             * accumulate energy while stuck.
             */
            particle.vy = 0;
        }
    }


    rebuildBuckets();
}


/* =========================================================
   COLLECTION
========================================================= */

export function collectSand(
    worldX,
    worldY
) {
    const cx =
        worldX * CELL +
        CELL / 2;

    const cy =
        worldY * CELL +
        CELL / 2;

    const candidates = [];

    for (
        let i = 0;
        i < sand.length;
        i++
    ) {
        const particle =
            sand[i];

        const dx =
            particle.x - cx;

        const dy =
            particle.y - cy;

        const distanceSquared =
            dx * dx +
            dy * dy;

        if (
            distanceSquared <=
            COLLECT_RADIUS *
            COLLECT_RADIUS
        ) {
            candidates.push({
                index: i,
                distance: distanceSquared
            });
        }
    }


    candidates.sort(
        (a, b) =>
            a.distance -
            b.distance
    );


    const amount =
        Math.min(
            25,
            candidates.length
        );


    if (!amount) {
        return;
    }


    /*
     * Remove highest indexes first so that removing one
     * particle doesn't invalidate the remaining indexes.
     */
    for (
        let i = amount - 1;
        i >= 0;
        i--
    ) {
        sand.splice(
            candidates[i].index,
            1
        );
    }


    addSand(amount);
}


/* =========================================================
   DROPPING
========================================================= */

export function dropSand(
    worldX,
    worldY,
    amount = 20
) {
    spawnSand(
        worldX,
        worldY,
        amount
    );
}