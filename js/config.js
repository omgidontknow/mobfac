export const VERSION = "v0.7.1";


/* WORLD */

export const WORLD_WIDTH = 150;
export const WORLD_HEIGHT = 190;

export const CELL = 12;


/* MATERIALS */

export const AIR = 0;
export const DIRT = 1;
export const STONE = 2;
export const BEDROCK = 3;


/* MINING */

export const MINING_RADIUS = 2.7;


/* SAND */

export const MAX_SAND = 10000;

/*
 * Tiny but clearly visible grains.
 */
export const SAND_GRAIN_SIZE = 0.85;

/*
 * Slightly stronger gravity so freshly mined/dropped
 * sand begins falling immediately.
 */
export const SAND_GRAVITY = 0.38;

export const SAND_MAX_FALL_SPEED = 6;


/* INVENTORY */

export const INVENTORY_CAPACITY = 500;

export const COLLECT_RADIUS = 30;


/* CAMERA */

export const MIN_ZOOM = 0.7;
export const MAX_ZOOM = 3;
export const DEFAULT_ZOOM = 1;