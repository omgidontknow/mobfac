import {
    VERSION
} from "./config.js";

import {
    generateWorld
} from "./world.js";

import {
    updateSand
} from "./sand.js";

import {
    initialiseInventory
} from "./inventory.js";

import {
    initialiseInput,
    setMode
} from "./input.js";

import {
    createCamera,
    render
} from "./renderer.js";


/* Elements */

const canvas =
    document.getElementById(
        "game"
    );

const ctx =
    canvas.getContext(
        "2d"
    );


/* Version */

document
    .getElementById("version")
    .textContent =
    VERSION;


/* Camera */

const camera =
    createCamera(
        canvas
    );


/* Resize */

function resize() {

    canvas.width =
        window.innerWidth;

    canvas.height =
        window.innerHeight;


    camera.clamp();
}


window.addEventListener(
    "resize",
    resize
);


resize();


/* World */

generateWorld();


/* Inventory */

initialiseInventory(
    document.getElementById(
        "inventory"
    )
);


/* Input */

initialiseInput(
    canvas,
    camera
);


/* UI */

const hint =
    document.getElementById(
        "hint"
    );


const hints = {

    mine:
        "Hold and drag to mine",

    collect:
        "Hold and drag across sand to collect",

    drop:
        "Hold and drag to drop sand",

    pan:
        "Drag to move around the map"
};


document
    .querySelectorAll(
        ".action"
    )
    .forEach(button => {

        button.addEventListener(
            "click",
            event => {

                event.preventDefault();


                const mode =
                    button.dataset.mode;


                setMode(mode);


                document
                    .querySelectorAll(
                        ".action"
                    )
                    .forEach(
                        other => {

                            other.classList.toggle(
                                "selected",
                                other ===
                                button
                            );
                        }
                    );


                hint.textContent =
                    hints[mode];
            }
        );
    });


/* Game loop */

function gameLoop() {

    updateSand();

    render(
        canvas,
        ctx,
        camera
    );


    requestAnimationFrame(
        gameLoop
    );
}


gameLoop();
