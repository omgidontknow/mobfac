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
const HASH_SIZE = 6;
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
/* =========================================================
   TERRAIN COLLISION
========================================================= */
function terrainAtPixel(x, y) {
    return getTerrain(
        Math.floor(x / CELL),
        Math.floor(y / CELL)
    );
}
function hitsTerrain(particle, x, y) {
    const r = particle.r;
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
function terrainSupportY(particle) {
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
    let highestTop = Infinity;
    for (const [x, y] of cells) {
        if (
            getTerrain(x, y) !== 0
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
/* =========================================================
   SAND COLLISION
========================================================= */
/*
 * Find a grain that would support the particle at x/y.
 */
function supportingSand(
    particle,
    x,
    y
) {
    const range = 5;
    const minX =
        Math.floor(
            (x - range) / HASH_SIZE
        );
    const maxX =
        Math.floor(
            (x + range) / HASH_SIZE
        );
    const minY =
        Math.floor(
            (y - range) / HASH_SIZE
        );
    const maxY =
        Math.floor(
            (y + range) / HASH_SIZE
        );
    let best = null;
    let bestDistance = Infinity;
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
            for (const other of bucket) {
                if (other === particle) {
                    continue;
                }
                /*
                 * The supporting grain must be below us.
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
                    best = other;
                    bestDistance = distance;
                }
            }
        }
    }
    return best;
}
/*
 * Return another grain overlapping the proposed position.
 */
function sandCollision(
    particle,
    x,
    y
) {
    const range = 6;
    const minX =
        Math.floor(
            (x - range) / HASH_SIZE
        );
    const maxX =
        Math.floor(
            (x + range) / HASH_SIZE
        );
    const minY =
        Math.floor(
            (y - range) / HASH_SIZE
        );
    const maxY =
        Math.floor(
            (y + range) / HASH_SIZE
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
            for (const other of bucket) {
                if (
                    other === particle
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
                    minimum * minimum
                ) {
                    return other;
                }
            }
        }
    }
    return null;
}
/* =========================================================
   SLIDING
========================================================= */
/*
 * Try to move a grain around an obstacle.
 *
 * The grain only moves sideways when it has something
 * underneath it. This keeps falling grains vertical while
 * allowing piles to spread naturally once they land.
 */
function trySlide(
    particle,
    direction
) {
    const horizontalStep =
        particle.r * 1.8;
    const diagonalX =
        particle.x +
        direction *
        horizontalStep;
    /*
     * Move slightly downward while sliding.
     */
    const diagonalY =
        particle.y +
        Math.max(
            0.5,
            particle.r * 0.35
        );
    /*
     * Don't slide through terrain.
     */
    if (
        hitsTerrain(
            particle,
            diagonalX,
            diagonalY
        )
    ) {
        return false;
    }
    /*
     * Don't slide through another grain.
     */
    if (
        sandCollision(
            particle,
            diagonalX,
            diagonalY
        )
    ) {
        return false;
    }
    particle.x = diagonalX;
    particle.y = diagonalY;
    particle.vy = Math.max(
        particle.vy * 0.35,
        0.25
    );
    particle.supported = false;
    return true;
}
/*
 * Try both sides in a random order.
 *
 * Randomising the preferred side prevents a large group of
 * grains from always forming a bias in one direction.
 */
function trySlideBothWays(
    particle
) {
    const first =
        Math.random() < 0.5
            ? -1
            : 1;
    if (
        trySlide(
            particle,
            first
        )
    ) {
        return true;
    }
    return trySlide(
        particle,
        -first
    );
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
    if (!sand.length) {
        return;
    }
    /*
     * Multiple small steps keep the simulation stable and
     * prevent grains from passing through terrain.
     */
    const STEPS = 5;
    for (
        let step = 0;
        step < STEPS;
        step++
    ) {
        /*
         * The hash must represent the current positions before
         * collision tests.
         */
        rebuildBuckets();
        /*
         * Process lower grains first so the bottom of a pile
         * settles before grains above it are handled.
         */
        sand.sort(
            (a, b) =>
                b.y - a.y
        );
        for (const particle of sand) {
            /*
             * A supported grain may become unsupported if the
             * terrain or grain beneath it has moved/disappeared.
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
                    particle.vy = 0.5;
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
            const nextY =
                particle.y +
                particle.vy;
            /* -------------------------------------------------
               TERRAIN
            ------------------------------------------------- */
            if (
                hitsTerrain(
                    particle,
                    particle.x,
                    nextY
                )
            ) {
                /*
                 * We have hit the ground or a wall.
                 *
                 * First try to slide around the obstacle.
                 */
                if (
                    trySlideBothWays(
                        particle
                    )
                ) {
                    continue;
                }
                /*
                 * No room to slide, so settle on terrain.
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
                particle.vy = 0;
                particle.supported = true;
                continue;
            }
            /* -------------------------------------------------
               OTHER SAND
            ------------------------------------------------- */
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
                 * A grain below us is blocking the fall.
                 *
                 * Try to flow around it before settling.
                 */
                if (
                    blockingGrain.y >
                    particle.y
                ) {
                    if (
                        trySlideBothWays(
                            particle
                        )
                    ) {
                        continue;
                    }
                    /*
                     * No route around the grain.
                     * Rest directly on it.
                     */
                    particle.y =
                        blockingGrain.y -
                        blockingGrain.r -
                        particle.r;
                    particle.vy = 0;
                    particle.supported = true;
                    continue;
                }
            }
            /* -------------------------------------------------
               FREE FALL
            ------------------------------------------------- */
            particle.y =
                nextY;
            particle.supported =
                false;
        }
    }
    /*
     * Final support pass.
     */
    rebuildBuckets();
    for (const particle of sand) {
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
    if (!amount) {
        return;
    }
    /*
     * Remove from highest index downward so earlier indexes
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