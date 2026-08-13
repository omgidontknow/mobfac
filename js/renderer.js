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


/* =========================================================
   CAMERA
========================================================= */

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
                WORLD_WIDTH * CELL;

            const worldH =
                WORLD_HEIGHT * CELL;

            const visibleW =
                canvas.width / this.zoom;

            const visibleH =
                canvas.height / this.zoom;


            this.x =
                Math.max(
                    0,
                    Math.min(
                        this.x,
                        Math.max(
                            0,
                            worldW - visibleW
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
                            worldH - visibleH
                        )
                    )
                );
        }
    };
}


/* =========================================================
   MAIN RENDER
========================================================= */

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
     * Very subtle irregular atmospheric texture.
     */

    ctx.globalAlpha =
        0.022;


    for (
        let i = 0;
        i < 90;
        i++
    ) {

        const x =
            noise(i, 4000) *
            canvas.width;

        const y =
            noise(i, 5000) *
            canvas.height *
            0.58;

        const radius =
            25 +
            noise(i, 6000) *
            80;


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


    ctx.globalAlpha = 1;
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
            ) - 3
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
            ) + 3
        );


    /*
     * Draw the actual terrain body.
     *
     * We deliberately don't draw individual cells anymore.
     * Instead, contiguous runs of material are rendered as
     * continuous shapes.
     */

    renderMaterialRuns(
        ctx,
        startX,
        endX
    );


    /*
     * Add irregular texture over the continuous terrain.
     */

    renderGroundTexture(
        ctx,
        startX,
        endX
    );


    /*
     * The visible grass follows the actual exposed surface.
     */

    renderGrass(
        ctx,
        startX,
        endX
    );
}


/* =========================================================
   CONTINUOUS MATERIAL RUNS
========================================================= */

function renderMaterialRuns(
    ctx,
    startX,
    endX
) {

    /*
     * Draw each horizontal material run as one shape.
     *
     * This removes the visible vertical grid seams.
     */

    for (
        let y = 0;
        y < WORLD_HEIGHT;
        y++
    ) {

        let runStart =
            startX;

        let material =
            getTerrain(
                startX,
                y
            );


        for (
            let x = startX + 1;
            x <= endX + 1;
            x++
        ) {

            const next =
                x <= endX
                    ? getTerrain(
                        x,
                        y
                    )
                    : -1;


            if (
                next !== material
            ) {

                if (
                    material !== 0
                ) {

                    drawMaterialRun(
                        ctx,
                        runStart,
                        x - 1,
                        y,
                        material
                    );
                }


                runStart =
                    x;

                material =
                    next;
            }
        }
    }


    /*
     * Smooth the exposed upper surface.
     *
     * This overlays a continuous terrain shape over the
     * stair-stepped cell tops while preserving holes below.
     */

    drawSurfaceBody(
        ctx,
        startX,
        endX
    );
}


/* =========================================================
   MATERIAL RUN
========================================================= */

function drawMaterialRun(
    ctx,
    startX,
    endX,
    y,
    material
) {

    const x =
        startX * CELL;

    const width =
        (
            endX -
            startX +
            1
        ) * CELL;


    ctx.fillStyle =
        baseMaterialColour(
            material
        );


    ctx.fillRect(
        x,
        y * CELL,
        width + 0.5,
        CELL + 0.5
    );
}


/* =========================================================
   SMOOTH SURFACE BODY
========================================================= */

function drawSurfaceBody(
    ctx,
    startX,
    endX
) {

    const points = [];


    /*
     * Generate a point at the centre of every terrain
     * column's exposed surface.
     */

    for (
        let x = startX;
        x <= endX;
        x++
    ) {

        const surfaceY =
            findSurfaceY(x);


        points.push({

            x:
                x * CELL,

            y:
                surfaceY * CELL
        });
    }


    if (
        points.length < 2
    ) {
        return;
    }


    /*
     * Use a smoothed curve through the surface points.
     */

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


        const midpointX =
            (
                previous.x +
                current.x
            ) / 2;

        const midpointY =
            (
                previous.y +
                current.y
            ) / 2;


        ctx.quadraticCurveTo(
            previous.x,
            previous.y,
            midpointX,
            midpointY
        );
    }


    const last =
        points[
            points.length - 1
        ];


    ctx.lineTo(
        last.x,
        WORLD_HEIGHT * CELL
    );


    ctx.lineTo(
        points[0].x,
        WORLD_HEIGHT * CELL
    );


    ctx.closePath();


    /*
     * The surface is dirt by default.
     *
     * Individual material regions underneath remain
     * responsible for their own appearance.
     */

    ctx.fillStyle =
        "#895b37";

    ctx.globalAlpha =
        0.16;

    ctx.fill();

    ctx.globalAlpha =
        1;
}


/* =========================================================
   GROUND TEXTURE
========================================================= */

function renderGroundTexture(
    ctx,
    startX,
    endX
) {

    /*
     * Sparse irregular marks rather than a repeating
     * tile/pattern.
     */

    const visibleWidth =
        (
            endX -
            startX +
            1
        ) * CELL;


    const count =
        Math.floor(
            visibleWidth / 4
        );


    for (
        let i = 0;
        i < count;
        i++
    ) {

        const worldX =
            startX +
            noise(
                i,
                8100
            ) *
            (
                endX -
                startX
            );


        const worldY =
            5 +
            noise(
                i,
                8200
            ) *
            (
                WORLD_HEIGHT - 10
            );


        const material =
            getTerrain(
                Math.floor(
                    worldX
                ),
                Math.floor(
                    worldY
                )
            );


        if (
            material === 0
        ) {

            continue;
        }


        const px =
            worldX * CELL;

        const py =
            worldY * CELL;


        const size =
            0.7 +
            noise(
                i,
                8300
            ) * 2.2;


        /*
         * Very subtle texture.
         */

        if (
            material === 1
        ) {

            ctx.fillStyle =
                noise(
                    i,
                    8400
                ) > 0.5
                    ? "rgba(75,45,27,0.09)"
                    : "rgba(235,177,105,0.08)";

        } else if (
            material === 2
        ) {

            ctx.fillStyle =
                noise(
                    i,
                    8400
                ) > 0.5
                    ? "rgba(20,22,23,0.12)"
                    : "rgba(220,225,225,0.08)";

        } else {

            ctx.fillStyle =
                "rgba(0,0,0,0.12)";
        }


        ctx.beginPath();

        ctx.ellipse(
            px,
            py,
            size * 1.8,
            size,
            noise(i, 8500) * Math.PI,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }


    /*
     * Larger, extremely faint irregular patches give the
     * dirt some natural variation without a repeating tile.
     */

    ctx.globalAlpha =
        0.045;


    for (
        let i = 0;
        i < 35;
        i++
    ) {

        const x =
            (
                startX +
                noise(i, 8600) *
                (
                    endX -
                    startX
                )
            ) * CELL;


        const y =
            (
                10 +
                noise(i, 8700) *
                (
                    WORLD_HEIGHT - 15
                )
            ) * CELL;


        const w =
            15 +
            noise(i, 8800) * 35;

        const h =
            6 +
            noise(i, 8900) * 18;


        ctx.fillStyle =
            noise(i, 9000) > 0.5
                ? "#4e3526"
                : "#d4a36e";


        ctx.beginPath();

        ctx.ellipse(
            x,
            y,
            w,
            h,
            noise(i, 9100),
            0,
            Math.PI * 2
        );

        ctx.fill();
    }


    ctx.globalAlpha =
        1;
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
         * Only actual exposed dirt gets grass.
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
         * Instead of a 12px rectangular green strip,
         * draw a very thin irregular surface stroke.
         */

        ctx.strokeStyle =
            "#557d39";

        ctx.lineWidth =
            2;


        ctx.beginPath();


        ctx.moveTo(
            baseX,
            baseY + 0.8
        );


        ctx.lineTo(
            baseX + CELL,
            baseY + 0.8
        );


        ctx.stroke();


        /*
         * Small individual blades.
         */

        ctx.strokeStyle =
            n > 0.5
                ? "#719b4d"
                : "#608b42";


        ctx.lineWidth =
            0.8;


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
                baseX + 7,
                baseY + 1
            );

            ctx.lineTo(
                baseX + 6.5,
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

function baseMaterialColour(
    material
) {

    if (
        material === 1
    ) {

        return "#895b37";
    }


    if (
        material === 2
    ) {

        return "#5d6263";
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
     * Crisp individual grains.
     *
     * No fuzzy gradients.
     */

    ctx.fillStyle =
        "#c47a24";


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