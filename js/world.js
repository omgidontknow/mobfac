import {
    WORLD_WIDTH,
    WORLD_HEIGHT,
    AIR,
    DIRT,
    STONE,
    BEDROCK
} from "./config.js";


export const terrain = new Uint8Array(
    WORLD_WIDTH * WORLD_HEIGHT
);


function index(x, y) {
    return y * WORLD_WIDTH + x;
}


export function inside(x, y) {

    return (
        x >= 0 &&
        x < WORLD_WIDTH &&
        y >= 0 &&
        y < WORLD_HEIGHT
    );
}


export function getTerrain(x, y) {

    if (!inside(x, y)) {
        return BEDROCK;
    }

    return terrain[index(x, y)];
}


export function setTerrain(x, y, material) {

    if (!inside(x, y)) {
        return;
    }

    terrain[index(x, y)] = material;
}


/* Deterministic noise */

export function noise(x, y) {

    let n =
        x * 374761393 +
        y * 668265263;

    n =
        (n ^ (n >> 13)) *
        1274126177;

    n ^= n >> 16;

    return (
        (n >>> 0) /
        4294967295
    );
}


/* Generate terrain */

export function generateWorld() {

    const surface = [];


    for (
        let x = 0;
        x < WORLD_WIDTH;
        x++
    ) {

        const broad =
            Math.sin(
                x * 0.045
            ) * 5;

        const medium =
            Math.sin(
                x * 0.12
            ) * 2;

        const small =
            Math.sin(
                x * 0.32
            ) * 0.7;

        const random =
            (
                noise(x, 1000) -
                0.5
            ) * 1.5;


        surface[x] =
            Math.round(
                23 +
                broad +
                medium +
                small +
                random
            );
    }


    for (
        let x = 0;
        x < WORLD_WIDTH;
        x++
    ) {

        const surfaceY =
            surface[x];


        for (
            let y = 0;
            y < WORLD_HEIGHT;
            y++
        ) {

            if (
                y < surfaceY
            ) {

                setTerrain(
                    x,
                    y,
                    AIR
                );

            } else if (
                y < surfaceY + 23
            ) {

                setTerrain(
                    x,
                    y,
                    DIRT
                );

            } else if (
                y < WORLD_HEIGHT - 8
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
    }
}


/*
Find the ACTUAL current surface.

This changes immediately when terrain is mined.
*/

export function findSurfaceY(x) {

    for (
        let y = 0;
        y < WORLD_HEIGHT;
        y++
    ) {

        if (
            getTerrain(x, y) !== AIR
        ) {

            return y;
        }
    }


    return WORLD_HEIGHT;
}


/*
A material can only be mined if it is exposed to air.
*/

export function isExposed(x, y) {

    if (!inside(x, y)) {
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
