import {
    AIR,
    DIRT,
    BEDROCK,
    MINING_RADIUS
} from "./config.js";

import {
    getTerrain,
    setTerrain,
    isExposed
} from "./world.js";

import {
    spawnSand
} from "./sand.js";


let dirtCounter = 0;


export function mineCircle(
    cx,
    cy
) {

    for (
        let y =
            Math.floor(
                cy -
                MINING_RADIUS
            );

        y <=
            Math.ceil(
                cy +
                MINING_RADIUS
            );

        y++
    ) {

        for (
            let x =
                Math.floor(
                    cx -
                    MINING_RADIUS
                );

            x <=
                Math.ceil(
                    cx +
                    MINING_RADIUS
                );

            x++
        ) {

            const dx =
                x - cx;

            const dy =
                y - cy;


            if (
                dx * dx +
                dy * dy >
                MINING_RADIUS *
                MINING_RADIUS
            ) {
                continue;
            }


            mineCell(
                x,
                y
            );
        }
    }
}


function mineCell(
    x,
    y
) {

    const material =
        getTerrain(
            x,
            y
        );


    if (
        material === AIR ||
        material === BEDROCK
    ) {
        return;
    }


    /*
    Only exposed material can be mined.
    */

    if (
        !isExposed(
            x,
            y
        )
    ) {
        return;
    }


    setTerrain(
        x,
        y,
        AIR
    );


    /*
    Dirt converts to sand at 2:1.
    */

    if (
        material === DIRT
    ) {

        dirtCounter++;


        if (
            dirtCounter >= 2
        ) {

            dirtCounter -= 2;


            /*
            Spawn directly into physics.
            No clump sitting in the air.
            */

            spawnSand(
                x,
                y,
                18
            );
        }
    }
}
