import {
    CELL,
    MAX_SAND,
    SAND_GRAIN_SIZE,
    SAND_GRAVITY,
    SAND_MAX_FALL_SPEED,
    COLLECT_RADIUS
} from "./config.js";

import { getTerrain } from "./world.js";
import { addSand } from "./inventory.js";


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
    const result = [];

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
                buckets.get(
                    bx + "," + by
                );

            if (!bucket) {
                continue;
            }

            result.push(...bucket);
        }
    }

    return result;
}


/* =========================================================
   TERRAIN
========================================================= */

function terrainAt(x, y) {
    return getTerrain(
        Math.floor(x / CELL),
        Math.floor(y / CELL)
    );
}

function hitsTerrain(particle, x, y) {
    const r = particle.r;

    return (
        terrainAt(x - r, y - r) !== 0 ||
        terrainAt(x + r, y - r) !== 0 ||
        terrainAt(x - r, y + r) !== 0 ||
        terrainAt(x + r, y + r) !== 0
    );
}


/*
 * Find the highest terrain surface beneath a grain.
 */
function terrainSupportY(particle, x) {
    const bottom =
        particle.y + particle.r;

    const cellY =
        Math.floor(bottom / CELL);

    const left =
        Math.floor(
            (x - particle.r) / CELL
        );

    const centre =
        Math.floor(x / CELL);

    const right =
        Math.floor(
            (x + particle.r) / CELL
        );

    let top = Infinity;

    for (const cellX of [left, centre, right]) {
        if (
            getTerrain(cellX, cellY) !== 0
        ) {
            top = Math.min(
                top,
                cellY * CELL
            );
        }
    }

    return top === Infinity
        ? null
        : top - particle.r;
}


/* =========================================================
   SAND SUPPORT
========================================================= */


/*
 * Find a grain that can support this grain at X.
 *
 * The horizontal distance must be less than or equal to
 * exactly one grain diameter.
 */
function grainSupportY(
    particle,
    x
) {
    const diameter =
        particle.r * 2;

    let support = null;
    let supportY = Infinity;

    for (
        const other of nearbyParticles(
            x,
            particle.y,
            diameter + 1
        )
    ) {
        if (other === particle) {
            continue;
        }

        const dx =
            Math.abs(
                x - other.x
            );

        if (dx > diameter) {
            continue;
        }

        /*
         * Only consider grains below us.
         */
        if (
            other.y <= particle.y
        ) {
            continue;
        }

        const y =
            other.y -
            other.r -
            particle.r;

        if (y < supportY) {
            supportY = y;
            support = other;
        }
    }

    return support
        ? supportY
        : null;
}


/*
 * Test whether the proposed centre overlaps another grain.
 */
function overlapsSand(
    particle,
    x,
    y
) {
    const diameter =
        particle.r * 2;

    for (
        const other of nearbyParticles(
            x,
            y,
            diameter + 1
        )
    ) {
        if (other === particle) {
            continue;
        }

        const dx =
            x - other.x;

        const dy =
            y - other.y;

        /*
         * A tiny overlap is deliberately allowed.
         *
         * This avoids visible one-pixel gaps caused by
         * floating-point positioning and canvas antialiasing.
         */
        const minimum =
            particle.r +
            other.r -
            0.05;

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
   SUPPORT
========================================================= */


/*
 * Determine whether a settled grain is still supported.
 */
function hasSupport(particle) {
    const terrainY =
        terrainSupportY(
            particle,
            particle.x
        );

    if (
        terrainY !== null &&
        Math.abs(
            terrainY - particle.y
        ) < 0.15
    ) {
        return true;
    }

    const grainY =
        grainSupportY(
            particle,
            particle.x
        );

    if (
        grainY !== null &&
        Math.abs(
            grainY - particle.y
        ) < 0.15
    ) {
        return true;
    }

    return false;
}


/*
 * Put a grain exactly onto its support.
 */
function settle(particle, x) {
    const terrainY =
        terrainSupportY(
            particle,
            x
        );

    const grainY =
        grainSupportY(
            particle,
            x
        );

    let y = Infinity;

    if (terrainY !== null) {
        y = Math.min(
            y,
            terrainY
        );
    }

    if (grainY !== null) {
        y = Math.min(
            y,
            grainY
        );
    }

    if (y === Infinity) {
        return false;
    }

    particle.x = x;
    particle.y = y;

    particle.vx = 0;
    particle.vy = 0;

    particle.supported = true;

    return true;
}


/* =========================================================
   SIDEWAYS SETTLING
========================================================= */


/*
 * Try to move one grain diameter left or right.
 *
 * We do not continuously slide the grain. It either finds
 * a valid resting position or stays where it is.
 */
function trySidewaysSettle(particle) {
    const diameter =
        particle.r * 2;

    const directions =
        Math.random() < 0.5
            ? [-1, 1]
            : [1, -1];

    for (
        const direction of directions
    ) {
        const x =
            particle.x +
            direction * diameter;

        /*
         * The candidate position itself must be clear.
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
         * A sideways move is only allowed if the grain
         * can immediately settle at the new position.
         */
        if (
            settle(
                particle,
                x
            )
        ) {
            return true;
        }
    }

    return false;
}


/* =========================================================
   SPAWN
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
                    Math.random() -
                    0.5
                ) * 0.5,

            y:
                y +
                (
                    Math.random() -
                    0.5
                ) * 0.5,

            vx: 0,
            vy: 0,

            /*
             * IMPORTANT:
             * Every grain has exactly the same radius.
             */
            r: SAND_GRAIN_SIZE,

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
         * Process lower grains first.
         */
        sand.sort(
            (a, b) =>
                b.y - a.y
        );

        for (const particle of sand) {

            /*
             * A supported grain is completely stationary.
             *
             * This is the main change that removes jitter.
             */
            if (particle.supported) {
                if (hasSupport(particle)) {
                    continue;
                }

                particle.supported = false;
                particle.vy = 0;
            }


            /* -------------------------------------------------
               GRAVITY
            ------------------------------------------------- */

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
               TRY TO FLOW LEFT/RIGHT
            ------------------------------------------------- */

            if (
                trySidewaysSettle(
                    particle
                )
            ) {
                continue;
            }


            /* -------------------------------------------------
               SETTLE VERTICALLY
            ------------------------------------------------- */

            if (
                settle(
                    particle,
                    particle.x
                )
            ) {
                continue;
            }


            /*
             * We are blocked but couldn't find an exact
             * support position. Stop the particle rather than
             * letting it repeatedly bounce.
             */
            particle.vy = 0;
        }
    }
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
     * Remove highest indexes first.
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
   DROP
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