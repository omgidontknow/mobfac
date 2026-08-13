import {
    INVENTORY_CAPACITY
} from "./config.js";


export const inventory = {

    type: null,

    amount: 0,

    capacity:
        INVENTORY_CAPACITY
};


let inventoryElement = null;


export function initialiseInventory(element) {

    inventoryElement =
        element;

    updateInventory();
}


export function hasSpace() {

    return (
        inventory.amount <
        inventory.capacity
    );
}


export function addSand(amount) {

    if (
        inventory.type &&
        inventory.type !== "sand"
    ) {
        return 0;
    }


    const added =
        Math.min(
            amount,
            inventory.capacity -
            inventory.amount
        );


    if (
        added <= 0
    ) {
        return 0;
    }


    inventory.type =
        "sand";

    inventory.amount +=
        added;


    updateInventory();

    return added;
}


export function removeSand(amount) {

    if (
        inventory.type !==
        "sand"
    ) {
        return 0;
    }


    const removed =
        Math.min(
            amount,
            inventory.amount
        );


    inventory.amount -=
        removed;


    if (
        inventory.amount <= 0
    ) {

        inventory.amount = 0;

        inventory.type = null;
    }


    updateInventory();

    return removed;
}


export function updateInventory() {

    if (!inventoryElement) {
        return;
    }


    if (
        !inventory.type ||
        inventory.amount <= 0
    ) {

        inventoryElement.textContent =
            "Inventory: Empty";

        return;
    }


    inventoryElement.textContent =
        "Sand × " +
        inventory.amount +
        " / " +
        inventory.capacity;
}
