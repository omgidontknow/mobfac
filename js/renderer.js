import {
    CELL,
    WORLD_WIDTH,
    WORLD_HEIGHT
} from "./config.js";

import {
    getTerrain,
    findSurfaceY,
    noise
} from "./world.js";

import {
    sand
} from "./sand.js";


export function createCamera(
    canvas
) {

    return {

        x: 0,

        y: 0,

        zoom: 1,

        cell: CELL,

        clamp() {

            const worldW =
                WORLD_WIDTH *
                CELL;

            const worldH =
                WORLD_HEIGHT *
                CELL;


            const visibleW =
                canvas.width /
                this.zoom;

            const visibleH =
                canvas.height /
                this.zoom;


            this.x =
                Math.max(
                    0,
                    Math.min(
                        this.x,
                        Math.max(
                            0,
                            worldW -
                            visibleW
                        )
                    )
                );


            this.y =
                Math.max(
                    0,
                    Math.min(
                        this.y,
                        Math.max(
                            0,
                            worldH -
                            visibleH
                        )
                    )
                );
        }
    };
}


export function render(
    canvas,
    ctx,
    camera
) {

    renderSky(
        canvas,
        ctx
    );


    ctx.save();


    ctx.scale(
        camera.zoom,
        camera.zoom
    );


    ctx.translate(
        -camera.x,
        -camera.y
    );


    renderTerrain(
        canvas,
        ctx,
        camera
    );


    renderSand(
        canvas,
        ctx,
        camera
    );


    ctx.restore();
}


/* =========================================================
   SKY
========================================================= */

function renderSky(
    canvas,
    ctx
) {

    const gradient =
        ctx.createLinearGradient(
            0,
            0,
            0,
            canvas.height
        );


    gradient.addColorStop(
        0,
        "#5aaee0"
    );

    gradient.addColorStop(
        0.55,
        "#8bc9e8"
    );

    gradient.addColorStop(
        1,
        "#c6e5ef"
    );


    ctx.fillStyle =
        gradient;


    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    /*
     * Subtle irregular sky texture.
     */

    ctx.globalAlpha =
        0.025;


    for (
        let i = 0;
        i < 80;
        i++
    ) {

        const x =
            noise(i, 4000) *
            canvas.width;

        const y =
            noise(i, 5000) *
            canvas.height *
            0.55;

        const radius =
            20 +
            noise(i, 6000) *
            70;


        const glow =
            ctx.createRadialGradient(
                x,
                y,
                0,
                x,
                y,
                radius
            );


        glow.addColorStop(
            0,
            "#ffffff"
        );

        glow.addColorStop(
            1,
            "rgba(255,255,255,0)"
        );


        ctx.fillStyle =
            glow;


        ctx.beginPath();

        ctx.arc(
            x,
            y,
            radius,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }


    ctx.globalAlpha =
        1;
}


/* =========================================================
   TERRAIN
========================================================= */

function renderTerrain(
    canvas,
    ctx,
    camera
) {

    const startX =
        Math.max(
            0,
            Math.floor(
                camera.x / CELL
            ) - 2
        );


    const endX =
        Math.min(
            WORLD_WIDTH - 1,
            Math.ceil(
                (
                    camera.x +
                    canvas.width /
                    camera.zoom
                ) / CELL
            ) + 2
        );


    /*
     * Draw terrain.
     */

    for (
        let x = startX;
        x <= endX;
        x++
    ) {

        for (
            let y = 0;
            y < WORLD_HEIGHT;
            y++
        ) {

            const material =
                getTerrain(
                    x,
                    y
                );


            if (!material) {
                continue;
            }


            ctx.fillStyle =
                materialColour(
                    material,
                    x,
                    y
                );


            ctx.fillRect(
                x * CELL,
                y * CELL,
                CELL + 0.5,
                CELL + 0.5
            );
        }
    }


    /*
     * Grass is rendered ONLY at the current exposed
     * surface of each column.
     *
     * There is no filled green shape connecting
     * neighbouring terrain heights.
     */

    renderGrass(
        ctx,
        startX,
        endX
    );
}


/* =========================================================
   GRASS
========================================================= */

function renderGrass(
    ctx,
    startX,
    endX
) {

    for (
        let x = startX;
        x <= endX;
        x++
    ) {

        const surfaceY =
            findSurfaceY(x);


        if (
            surfaceY >=
            WORLD_HEIGHT
        ) {

            continue;
        }


        /*
         * Only dirt gets grass.
         */

        if (
            getTerrain(
                x,
                surfaceY
            ) !== 1
        ) {

            continue;
        }


        const baseX =
            x * CELL;

        const baseY =
            surfaceY * CELL;


        const n =
            noise(
                x,
                777
            );


        /*
         * Thin green surface edge.
         */

        ctx.fillStyle =
            "#4d7835";


        ctx.fillRect(
            baseX,
            baseY,
            CELL + 0.5,
            1.8
        );


        /*
         * Small irregular blades.
         */

        ctx.strokeStyle =
            n > 0.5
                ? "#6f9d47"
                : "#608d3e";


        ctx.lineWidth =
            1;


        ctx.beginPath();


        if (
            n > 0.25
        ) {

            ctx.moveTo(
                baseX + 2,
                baseY + 1
            );

            ctx.lineTo(
                baseX + 2.5,
                baseY -
                1.5 -
                n * 2
            );
        }


        if (
            n > 0.55
        ) {

            ctx.moveTo(
                baseX + 6,
                baseY + 1
            );

            ctx.lineTo(
                baseX + 5.5,
                baseY -
                1 -
                n * 2
            );
        }


        ctx.stroke();
    }
}


/* =========================================================
   MATERIAL COLOURS
========================================================= */

function materialColour(
    material,
    x,
    y
) {

    const n =
        noise(
            x * 17,
            y * 31
        );


    if (
        material === 1
    ) {

        return `rgb(
            ${137 + n * 17},
            ${92 + n * 12},
            ${55 + n * 9}
        )`;
    }


    if (
        material === 2
    ) {

        const value =
            83 +
            n * 18;


        return `rgb(
            ${value},
            ${value + 2},
            ${value + 3}
        )`;
    }


    return "#292b2d";
}


/* =========================================================
   SAND
========================================================= */

function renderSand(
    canvas,
    ctx,
    camera
) {

    /*
     * Sand grains are deliberately rendered as solid,
     * crisp circles.
     *
     * No radial gradients are used around individual
     * grains, so the edges don't become fuzzy.
     */

    ctx.fillStyle =
        "#dfb95b";


    for (
        const p of sand
    ) {

        if (
            p.x <
                camera.x - 10 ||
            p.x >
                camera.x +
                canvas.width /
                camera.zoom +
                10 ||
            p.y <
                camera.y - 10 ||
            p.y >
                camera.y +
                canvas.height /
                camera.zoom +
                10
        ) {

            continue;
        }


        ctx.beginPath();


        ctx.arc(
            p.x,
            p.y,
            p.r,
            0,
            Math.PI * 2
        );


        ctx.fill();
    }


    /*
     * Very subtle solid density shading.
     *
     * This gives dense piles a little depth without
     * producing fuzzy edges.
     */

    const cells =
        new Map();


    for (
        const p of sand
    ) {

        const key =
            Math.floor(p.x / 6) +
            "," +
            Math.floor(p.y / 6);


        cells.set(
            key,
            (
                cells.get(key) ||
                0
            ) + 1
        );
    }


    ctx.fillStyle =
        "rgba(145,105,38,0.10)";


    for (
        const [
            key,
            density
        ] of cells
    ) {

        if (
            density < 10
        ) {

            continue;
        }


        const [
            sx,
            sy
        ] =
            key.split(",");


        const x =
            Number(sx) * 6;

        const y =
            Number(sy) * 6;


        ctx.fillRect(
            x,
            y,
            6,
            6
        );
    }


    /*
     * Redraw grains over the density shading.
     *
     * This keeps the individual grains crisp.
     */

    ctx.fillStyle =
        "#dfb95b";


    for (
        const p of sand
    ) {

        if (
            p.x <
                camera.x - 10 ||
            p.x >
                camera.x +
                canvas.width /
                camera.zoom +
                10 ||
            p.y <
                camera.y - 10 ||
            p.y >
                camera.y +
                canvas.height /
                camera.zoom +
                10
        ) {

            continue;
        }


        ctx.beginPath();


        ctx.arc(
            p.x,
            p.y,
            p.r,
            0,
            Math.PI * 2
        );


        ctx.fill();
    }
}