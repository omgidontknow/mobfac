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


/* SKY */

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
    Subtle non-repeating cloud-like texture.
    */

    ctx.globalAlpha =
        0.035;


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


/* TERRAIN */

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
    Main terrain body.
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
    Current terrain surface.

    There is deliberately NO old surface array here.
    */

    const points = [];


    for (
        let x = startX;
        x <= endX;
        x++
    ) {

        points.push({

            x:
                x * CELL,

            y:
                findSurfaceY(x) *
                CELL
        });
    }


    /*
    Soft top surface.
    */

    if (
        points.length > 1
    ) {

        ctx.beginPath();


        ctx.moveTo(
            points[0].x,
            points[0].y
        );


        for (
            let i = 1;
            i < points.length;
            i++
        ) {

            const previous =
                points[i - 1];

            const current =
                points[i];


            const midX =
                (
                    previous.x +
                    current.x
                ) / 2;

            const midY =
                (
                    previous.y +
                    current.y
                ) / 2;


            ctx.quadraticCurveTo(
                previous.x,
                previous.y,
                midX,
                midY
            );
        }


        const last =
            points[
                points.length - 1
            ];


        ctx.lineTo(
            last.x,
            last.y + 5
        );


        ctx.lineTo(
            points[0].x,
            points[0].y + 5
        );


        ctx.closePath();


        ctx.fillStyle =
            "#4f7f38";

        ctx.globalAlpha =
            0.8;

        ctx.fill();

        ctx.globalAlpha =
            1;
    }


    /*
    Dynamic grass.

    Only appears where the CURRENT surface is dirt.
    */

    for (
        let x = startX;
        x <= endX;
        x++
    ) {

        const surface =
            findSurfaceY(x);


        if (
            surface >=
            WORLD_HEIGHT
        ) {
            continue;
        }


        const material =
            getTerrain(
                x,
                surface
            );


        if (
            material !== 1
        ) {
            continue;
        }


        const n =
            noise(
                x,
                777
            );


        ctx.strokeStyle =
            n > 0.5
                ? "#6da247"
                : "#5a8f3d";


        ctx.lineWidth =
            1.5;


        ctx.beginPath();

        ctx.moveTo(
            x * CELL,
            surface * CELL + 1
        );

        ctx.lineTo(
            x * CELL +
            CELL * 0.45,
            surface * CELL -
            (
                1 +
                n * 2
            )
        );

        ctx.stroke();
    }
}


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
            83 + n * 18;


        return `rgb(
            ${value},
            ${value + 2},
            ${value + 3}
        )`;
    }


    return "#292b2d";
}


/* SAND */

function renderSand(
    canvas,
    ctx,
    camera
) {

    /*
    Tiny individual grains.
    */

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


        ctx.fillStyle =
            "#dfb95b";


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
    Soft density shading.

    This makes piles visibly pronounced without turning
    the grains into large squares.
    */

    const cells =
        new Map();


    for (
        const p of sand
    ) {

        const key =
            Math.floor(p.x / 8) +
            "," +
            Math.floor(p.y / 8);


        cells.set(
            key,
            (
                cells.get(key) ||
                0
            ) + 1
        );
    }


    for (
        const [
            key,
            density
        ] of cells
    ) {

        if (
            density < 7
        ) {
            continue;
        }


        const [
            sx,
            sy
        ] =
            key.split(",");


        const x =
            Number(sx) * 8 + 4;

        const y =
            Number(sy) * 8 + 4;


        const radius =
            Math.min(
                7,
                2 +
                density * 0.12
            );


        const gradient =
            ctx.createRadialGradient(
                x - radius * 0.25,
                y - radius * 0.35,
                0,
                x,
                y,
                radius
            );


        gradient.addColorStop(
            0,
            "rgba(244,210,120,0.22)"
        );

        gradient.addColorStop(
            0.72,
            "rgba(223,185,91,0.12)"
        );

        gradient.addColorStop(
            1,
            "rgba(157,117,42,0)"
        );


        ctx.fillStyle =
            gradient;


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
}
