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


const HASH_SIZE = 7;

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


    for (
        let i = 0;
        i < sand.length;
        i++
    ) {

        const p =
            sand[i];

        const key =
            bucketKey(
                p.x,
                p.y
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


        bucket.push(i);
    }
}


function terrainAtPixel(
    x,
    y
) {

    return getTerrain(
        Math.floor(x / CELL),
        Math.floor(y / CELL)
    );
}


function hitsTerrain(
    p,
    x,
    y
) {

    const r =
        p.r;


    return (

        terrainAtPixel(
            x - r,
            y + r
        ) !== 0 ||

        terrainAtPixel(
            x + r,
            y + r
        ) !== 0 ||

        terrainAtPixel(
            x - r,
            y
        ) !== 0 ||

        terrainAtPixel(
            x + r,
            y
        ) !== 0
    );
}


function nearbySand(
    p,
    x,
    y,
    ignoreIndex
) {

    const range = 6;


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
                const otherIndex
                of bucket
            ) {

                if (
                    otherIndex ===
                    ignoreIndex
                ) {
                    continue;
                }


                const other =
                    sand[
                        otherIndex
                    ];


                if (!other) {
                    continue;
                }


                const dx =
                    x - other.x;

                const dy =
                    y - other.y;


                const distance =
                    Math.sqrt(
                        dx * dx +
                        dy * dy
                    );


                if (
                    distance <
                    p.r +
                    other.r +
                    0.2
                ) {

                    return true;
                }
            }
        }
    }


    return false;
}


/*
 * Add newly mined or dropped sand.
 *
 * Grains are created directly as individual particles.
 * There is no temporary square/clump representation.
 */

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
                ) * 1.2,

            y:
                y +
                (
                    Math.random() -
                    0.5
                ) * 1.2,

            vx: 0,

            vy: 0,

            r:
                SAND_GRAIN_SIZE +
                (
                    Math.random() -
                    0.5
                ) * 0.12,

            supported: false
        });
    }
}


/*
 * Sand physics.
 *
 * The important behaviour here is:
 *
 * 1. Gravity is the dominant movement.
 * 2. Grains fall vertically whenever possible.
 * 3. When blocked, they only move a very small amount
 *    sideways.
 * 4. Large sideways searches have been removed.
 *
 * This allows sand to build vertically into pronounced
 * piles instead of immediately spreading into flat sheets.
 */

export function updateSand() {

    if (!sand.length) {
        return;
    }


    /*
     * Several small simulation steps per frame make
     * newly created sand start falling immediately.
     */

    for (
        let step = 0;
        step < 5;
        step++
    ) {

        rebuildBuckets();


        /*
         * Lower grains first.
         *
         * This helps the supporting part of a pile settle
         * before grains above it are processed.
         */

        sand.sort(
            (a, b) =>
                b.y - a.y
        );


        for (
            let i = 0;
            i < sand.length;
            i++
        ) {

            const p =
                sand[i];


            /*
             * Gravity.
             */

            p.vy =
                Math.min(
                    p.vy +
                    SAND_GRAVITY,
                    SAND_MAX_FALL_SPEED
                );


            /*
             * FIRST CHOICE:
             *
             * Always try to fall directly down.
             */

            const fallX =
                p.x;

            const fallY =
                p.y +
                p.vy;


            const terrainBlocked =
                hitsTerrain(
                    p,
                    fallX,
                    fallY
                );


            const sandBlocked =
                nearbySand(
                    p,
                    fallX,
                    fallY,
                    i
                );


            if (
                !terrainBlocked &&
                !sandBlocked
            ) {

                p.x =
                    fallX;

                p.y =
                    fallY;

                p.supported =
                    false;

                continue;
            }


            /*
             * The grain has reached the ground
             * or another grain.
             */

            p.vy = 0;


            /*
             * Only attempt a tiny sideways slide.
             *
             * Previously the physics searched several
             * pixels sideways, which encouraged the sand
             * to spread horizontally.
             */

            const directions =
                Math.random() < 0.5
                    ? [-1, 1]
                    : [1, -1];


            let moved =
                false;


            for (
                const direction
                of directions
            ) {

                const slideX =
                    p.x +
                    direction *
                    1.05;

                const slideY =
                    p.y +
                    0.45;


                if (
                    !hitsTerrain(
                        p,
                        slideX,
                        slideY
                    ) &&
                    !nearbySand(
                        p,
                        slideX,
                        slideY,
                        i
                    )
                ) {

                    p.x =
                        slideX;

                    p.y =
                        slideY;

                    p.supported =
                        false;

                    moved =
                        true;

                    break;
                }
            }


            /*
             * Nothing nearby can accept the grain.
             *
             * Leave it where it is. This is what allows
             * grains to stack and piles to become higher.
             */

            if (!moved) {

                p.supported =
                    true;
            }
        }
    }


    /*
     * Safety pass.
     *
     * If support disappeared underneath a grain,
     * make that grain fall again.
     */

    rebuildBuckets();


    for (
        let i = 0;
        i < sand.length;
        i++
    ) {

        const p =
            sand[i];


        if (
            !hasSupport(
                p,
                i
            )
        ) {

            p.supported =
                false;

            p.vy =
                Math.max(
                    p.vy,
                    0.8
                );
        }
    }
}


function hasSupport(
    p,
    index
) {

    if (
        hitsTerrain(
            p,
            p.x,
            p.y + 1
        )
    ) {

        return true;
    }


    return nearbySand(
        p,
        p.x,
        p.y + 1,
        index
    );
}


/*
 * Collect a wider area of sand.
 */

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

        const p =
            sand[i];


        const dx =
            p.x - cx;

        const dy =
            p.y - cy;


        if (
            dx * dx +
            dy * dy <=
            COLLECT_RADIUS *
            COLLECT_RADIUS
        ) {

            candidates.push({

                index: i,

                distance:
                    dx * dx +
                    dy * dy
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
     * Remove closest grains.
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


/*
 * Drop sand at a location.
 */

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