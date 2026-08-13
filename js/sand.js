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


/*
 * Spatial hash used only for finding nearby grains.
 *
 * IMPORTANT:
 * Buckets contain PARTICLE OBJECTS, not array indexes.
 *
 * This means sorting the sand array can never invalidate
 * the collision information.
 */

const HASH_SIZE = 6;

const buckets = new Map();


function bucketKey(
    x,
    y
) {

    return (
        Math.floor(x / HASH_SIZE) +
        "," +
        Math.floor(y / HASH_SIZE)
    );
}


function rebuildBuckets() {

    buckets.clear();


    for (
        const particle of sand
    ) {

        const key =
            bucketKey(
                particle.x,
                particle.y
            );


        let bucket =
            buckets.get(key);


        if (!bucket) {

            bucket = [];

            buckets.set(
                key,
                bucket
            );
        }


        bucket.push(
            particle
        );
    }
}


/* =========================================================
   TERRAIN COLLISION
========================================================= */

function terrainAtPixel(
    x,
    y
) {

    return getTerrain(
        Math.floor(
            x / CELL
        ),
        Math.floor(
            y / CELL
        )
    );
}


function hitsTerrain(
    particle,
    x,
    y
) {

    const r =
        particle.r;


    /*
     * Check the bottom edge and lower corners.
     *
     * This is intentionally conservative so grains cannot
     * pass through terrain between simulation steps.
     */

    return (

        terrainAtPixel(
            x - r,
            y + r
        ) !== 0 ||

        terrainAtPixel(
            x,
            y + r
        ) !== 0 ||

        terrainAtPixel(
            x + r,
            y + r
        ) !== 0
    );
}


/*
 * Find the terrain directly underneath a particle.
 */

function terrainSupportY(
    particle
) {

    const bottom =
        particle.y +
        particle.r;


    const cellY =
        Math.floor(
            bottom / CELL
        );


    const leftX =
        Math.floor(
            (
                particle.x -
                particle.r
            ) / CELL
        );


    const centreX =
        Math.floor(
            particle.x / CELL
        );


    const rightX =
        Math.floor(
            (
                particle.x +
                particle.r
            ) / CELL
        );


    const cells = [
        [leftX, cellY],
        [centreX, cellY],
        [rightX, cellY]
    ];


    let highestTop =
        Infinity;


    for (
        const [
            x,
            y
        ] of cells
    ) {

        if (
            getTerrain(
                x,
                y
            ) !== 0
        ) {

            const top =
                y * CELL;


            highestTop =
                Math.min(
                    highestTop,
                    top
                );
        }
    }


    return highestTop === Infinity
        ? null
        : highestTop;
}


/*
 * If a particle is intersecting the top of terrain,
 * put it exactly on the surface rather than leaving a
 * visible sub-pixel gap.
 */

function settleOnTerrain(
    particle
) {

    const top =
        terrainSupportY(
            particle
        );


    if (
        top === null
    ) {

        return false;
    }


    const desiredY =
        top -
        particle.r;


    if (
        particle.y >=
        desiredY - 0.5
    ) {

        particle.y =
            desiredY;

        particle.vy =
            0;

        return true;
    }


    return false;
}


/* =========================================================
   SAND COLLISION
========================================================= */


/*
 * Find a grain that is directly underneath the proposed
 * position.
 *
 * Unlike the old implementation, this returns the actual
 * particle rather than an array index.
 */

function supportingSand(
    particle,
    x,
    y
) {

    const range =
        5;


    const minX =
        Math.floor(
            (
                x -
                range
            ) /
            HASH_SIZE
        );


    const maxX =
        Math.floor(
            (
                x +
                range
            ) /
            HASH_SIZE
        );


    const minY =
        Math.floor(
            (
                y -
                range
            ) /
            HASH_SIZE
        );


    const maxY =
        Math.floor(
            (
                y +
                range
            ) /
            HASH_SIZE
        );


    let best =
        null;


    let bestDistance =
        Infinity;


    for (
        let by = minY;
        by <= maxY;
        by++
    ) {

        for (
            let bx = minX;
            bx <= maxX;
            bx++
        ) {

            const bucket =
                buckets.get(
                    bx + "," + by
                );


            if (!bucket) {
                continue;
            }


            for (
                const other
                of bucket
            ) {

                if (
                    other ===
                    particle
                ) {

                    continue;
                }


                /*
                 * We only want a grain that is genuinely
                 * underneath this particle.
                 */

                if (
                    other.y <=
                    particle.y
                ) {

                    continue;
                }


                const dx =
                    Math.abs(
                        x -
                        other.x
                    );


                if (
                    dx >
                    particle.r +
                    other.r
                ) {

                    continue;
                }


                const desiredY =
                    other.y -
                    particle.r -
                    other.r;


                const distance =
                    Math.abs(
                        y -
                        desiredY
                    );


                if (
                    distance <
                    bestDistance
                ) {

                    best =
                        other;

                    bestDistance =
                        distance;
                }
            }
        }
    }


    return best;
}


/*
 * Check whether the proposed position overlaps another
 * grain.
 */

function sandCollision(
    particle,
    x,
    y
) {

    const range =
        5;


    const minX =
        Math.floor(
            (
                x -
                range
            ) /
            HASH_SIZE
        );


    const maxX =
        Math.floor(
            (
                x +
                range
            ) /
            HASH_SIZE
        );


    const minY =
        Math.floor(
            (
                y -
                range
            ) /
            HASH_SIZE
        );


    const maxY =
        Math.floor(
            (
                y +
                range
            ) /
            HASH_SIZE
        );


    for (
        let by = minY;
        by <= maxY;
        by++
    ) {

        for (
            let bx = minX;
            bx <= maxX;
            bx++
        ) {

            const bucket =
                buckets.get(
                    bx + "," + by
                );


            if (!bucket) {
                continue;
            }


            for (
                const other
                of bucket
            ) {

                if (
                    other ===
                    particle
                ) {

                    continue;
                }


                const dx =
                    x -
                    other.x;


                const dy =
                    y -
                    other.y;


                const minimum =
                    particle.r +
                    other.r;


                if (
                    dx * dx +
                    dy * dy <
                    minimum *
                    minimum
                ) {

                    return other;
                }
            }
        }
    }


    return null;
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
        sand.length >=
        MAX_SAND
    ) {

        return;
    }


    amount =
        Math.min(
            amount,
            MAX_SAND -
            sand.length
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
                ) * 0.8,

            y:
                y +
                (
                    Math.random() -
                    0.5
                ) * 0.8,

            vx: 0,

            vy: 0,

            r:
                SAND_GRAIN_SIZE +
                (
                    Math.random() -
                    0.5
                ) * 0.08,

            supported: false
        });
    }
}


/* =========================================================
   PHYSICS
========================================================= */

export function updateSand() {

    if (
        !sand.length
    ) {

        return;
    }


    /*
     * Small simulation steps prevent grains from tunnelling
     * through terrain and make newly mined sand fall
     * immediately.
     */

    const STEPS = 5;


    for (
        let step = 0;
        step < STEPS;
        step++
    ) {

        /*
         * Rebuild using particle references.
         */

        rebuildBuckets();


        /*
         * Process lower grains first.
         *
         * This lets the bottom of a pile settle before the
         * grains above it are evaluated.
         */

        sand.sort(
            (a, b) =>
                b.y - a.y
        );


        for (
            const particle
            of sand
        ) {

            /*
             * Already resting grains still need to be checked.
             *
             * Terrain may have been mined away underneath them.
             */

            if (
                particle.supported
            ) {

                const terrainSupport =
                    terrainSupportY(
                        particle
                    );


                const grainSupport =
                    supportingSand(
                        particle,
                        particle.x,
                        particle.y + 1
                    );


                if (
                    terrainSupport === null &&
                    !grainSupport
                ) {

                    particle.supported =
                        false;

                    particle.vy =
                        0.5;
                }
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


            /*
             * Attempt vertical movement first.
             */

            const nextY =
                particle.y +
                particle.vy;


            /*
             * Terrain takes priority.
             */

            if (
                hitsTerrain(
                    particle,
                    particle.x,
                    nextY
                )
            ) {

                /*
                 * Snap directly onto the terrain surface.
                 */

                const top =
                    terrainSupportY(
                        particle
                    );


                if (
                    top !== null
                ) {

                    particle.y =
                        top -
                        particle.r;
                }


                particle.vy =
                    0;

                particle.supported =
                    true;


                /*
                 * We have landed. Do not immediately
                 * slide sideways in the same step.
                 *
                 * This is important for creating tall piles.
                 */

                continue;
            }


            /*
             * Check for another sand grain.
             */

            const blockingGrain =
                sandCollision(
                    particle,
                    particle.x,
                    nextY
                );


            if (
                blockingGrain
            ) {

                /*
                 * If the grain underneath us is genuinely
                 * below, snap to its surface.
                 */

                if (
                    blockingGrain.y >
                    particle.y
                ) {

                    particle.y =
                        blockingGrain.y -
                        blockingGrain.r -
                        particle.r;

                    particle.vy =
                        0;

                    particle.supported =
                        true;

                    continue;
                }
            }


            /*
             * Nothing stopped the fall.
             */

            particle.y =
                nextY;

            particle.supported =
                false;


            /*
             * No sideways movement while airborne.
             *
             * This is a major change from the previous
             * implementation.
             */

            continue;
        }
    }


    /*
     * Final safety pass.
     *
     * Anything with no real support and no terrain beneath
     * it is explicitly marked as falling.
     */

    rebuildBuckets();


    for (
        const particle
        of sand
    ) {

        const terrainSupport =
            terrainSupportY(
                particle
            );


        const grainSupport =
            supportingSand(
                particle,
                particle.x,
                particle.y + 1
            );


        if (
            terrainSupport === null &&
            !grainSupport
        ) {

            particle.supported =
                false;


            particle.vy =
                Math.max(
                    particle.vy,
                    0.5
                );
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
            particle.x -
            cx;


        const dy =
            particle.y -
            cy;


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

                distance:
                    distanceSquared
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


    if (
        !amount
    ) {

        return;
    }


    /*
     * Remove from highest index downward so the indexes
     * remain valid while splicing.
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


    addSand(
        amount
    );
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