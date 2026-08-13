import {
    MIN_ZOOM,
    MAX_ZOOM
} from "./config.js";

import {
    mineCircle
} from "./mining.js";

import {
    collectSand,
    dropSand
} from "./sand.js";


let canvas;
let camera;


let mode = "mine";

let pointerDown = false;

let lastX = 0;
let lastY = 0;

let previousWorldX = null;
let previousWorldY = null;


let pinchDistance = null;
let pinchInitialZoom = 1;


export function initialiseInput(
    targetCanvas,
    cameraObject
) {

    canvas =
        targetCanvas;

    camera =
        cameraObject;


    setupPointerInput();

    setupPinchZoom();
}


export function setMode(
    newMode
) {

    mode =
        newMode;

    previousWorldX = null;
    previousWorldY = null;
}


function screenToWorld(
    screenX,
    screenY
) {

    return {

        x: Math.floor(
            (
                camera.x +
                screenX /
                camera.zoom
            ) /
            camera.cell
        ),

        y: Math.floor(
            (
                camera.y +
                screenY /
                camera.zoom
            ) /
            camera.cell
        )
    };
}


function performAction(
    screenX,
    screenY
) {

    const pos =
        screenToWorld(
            screenX,
            screenY
        );


    if (
        mode === "pan"
    ) {
        return;
    }


    /*
    Prevent repeated processing of exactly the
    same terrain cell.
    */

    if (
        pos.x ===
            previousWorldX &&
        pos.y ===
            previousWorldY
    ) {
        return;
    }


    previousWorldX =
        pos.x;

    previousWorldY =
        pos.y;


    if (
        mode === "mine"
    ) {

        mineCircle(
            pos.x,
            pos.y
        );

    } else if (
        mode === "collect"
    ) {

        collectSand(
            pos.x,
            pos.y
        );

    } else if (
        mode === "drop"
    ) {

        dropSand(
            pos.x,
            pos.y,
            20
        );
    }
}


function setupPointerInput() {

    canvas.addEventListener(
        "pointerdown",
        event => {

            pointerDown =
                true;


            lastX =
                event.clientX;

            lastY =
                event.clientY;


            previousWorldX = null;
            previousWorldY = null;


            canvas.setPointerCapture(
                event.pointerId
            );


            performAction(
                event.clientX,
                event.clientY
            );
        }
    );


    canvas.addEventListener(
        "pointermove",
        event => {

            if (
                !pointerDown
            ) {
                return;
            }


            const dx =
                event.clientX -
                lastX;

            const dy =
                event.clientY -
                lastY;


            if (
                mode === "pan"
            ) {

                camera.x -=
                    dx /
                    camera.zoom;

                camera.y -=
                    dy /
                    camera.zoom;


                camera.clamp();

            } else {

                const distance =
                    Math.sqrt(
                        dx * dx +
                        dy * dy
                    );


                const steps =
                    Math.max(
                        1,
                        Math.ceil(
                            distance / 10
                        )
                    );


                for (
                    let i = 1;
                    i <= steps;
                    i++
                ) {

                    const x =
                        lastX +
                        dx *
                        (i / steps);

                    const y =
                        lastY +
                        dy *
                        (i / steps);


                    performAction(
                        x,
                        y
                    );
                }
            }


            lastX =
                event.clientX;

            lastY =
                event.clientY;
        }
    );


    const release =
        () => {

            pointerDown =
                false;

            previousWorldX = null;
            previousWorldY = null;
        };


    canvas.addEventListener(
        "pointerup",
        release
    );

    canvas.addEventListener(
        "pointercancel",
        release
    );
}


function setupPinchZoom() {

    canvas.addEventListener(
        "touchstart",
        event => {

            if (
                event.touches.length !== 2
            ) {
                return;
            }


            pinchDistance =
                distance(
                    event.touches[0],
                    event.touches[1]
                );


            pinchInitialZoom =
                camera.zoom;
        },
        {
            passive: false
        }
    );


    canvas.addEventListener(
        "touchmove",
        event => {

            if (
                event.touches.length !== 2
            ) {
                return;
            }


            event.preventDefault();


            if (
                pinchDistance === null
            ) {
                return;
            }


            const current =
                distance(
                    event.touches[0],
                    event.touches[1]
                );


            camera.zoom =
                pinchInitialZoom *
                (
                    current /
                    pinchDistance
                );


            camera.zoom =
                Math.max(
                    MIN_ZOOM,
                    Math.min(
                        MAX_ZOOM,
                        camera.zoom
                    )
                );


            camera.clamp();
        },
        {
            passive: false
        }
    );
}


function distance(a, b) {

    const dx =
        a.clientX -
        b.clientX;

    const dy =
        a.clientY -
        b.clientY;


    return Math.sqrt(
        dx * dx +
        dy * dy
    );
}
