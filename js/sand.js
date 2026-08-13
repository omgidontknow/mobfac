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


function terrainAtPixel(x, y) {

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


/* Add newly mined/dropped sand */

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


/* Sand physics */

export function updateSand() {

    if (!sand.length) {
        return;
    }


    for (
        let step = 0;
        step < 4;
        step++
    ) {

        rebuildBuckets();


        /*
        Bottom grains first.
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


            p.vy =
                Math.min(
                    p.vy +
                    SAND_GRAVITY,
                    SAND_MAX_FALL_SPEED
                );


            const nextY =
                p.y +
                p.vy;


            const blockedByTerrain =
                hitsTerrain(
                    p,
                    p.x,
                    nextY
                );


            const blockedBySand =
                nearbySand(
                    p,
                    p.x,
                    nextY,
                    i
                );


            if (
                !blockedByTerrain &&
                !blockedBySand
            ) {

                p.y =
                    nextY;

                p.supported =
                    false;

                continue;
            }


            /*
            Try to slide sideways.

            The increasing distances make piles
            noticeably more conical.
            */

            p.vy = 0;


            const directions =
                Math.random() < 0.5
                    ? [-1, 1]
                    : [1, -1];


            let moved = false;


            for (
                const direction
                of directions
            ) {

                for (
                    const distance
                    of [1.5, 2.5, 3.5]
                ) {

                    const testX =
                        p.x +
                        direction *
                        distance;

                    const testY =
                        p.y +
                        0.8;


                    if (
                        !hitsTerrain(
                            p,
                            testX,
                            testY
                        ) &&
                        !nearbySand(
                            p,
                            testX,
                            testY,
                            i
                        )
                    ) {

                        p.x =
                            testX;

                        p.y =
                            testY;

                        p.supported =
                            false;

                        moved = true;

                        break;
                    }
                }


                if (moved) {
                    break;
                }
            }


            if (!moved) {

                p.supported =
                    true;
            }
        }
    }


    /*
    Safety pass.

    No grain gets to remain permanently suspended.
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


/* Collect a wider area */

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


    /*
    Large inventory, wide collection.
    */

    const amount =
        Math.min(
            25,
            candidates.length
        );


    if (!amount) {
        return;
    }


    /*
    Remove from the end so indexes remain valid.
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


    /*
    If inventory was full, this should ideally be
    checked before removal. We'll keep it safe by
    returning grains if necessary in future versions.
    */

    addSand(amount);
}


/* Drop sand */

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
