import {Transportation} from "../../zykloplib/runescape/transportation"
import EntityActionMovement = Transportation.EntityActionMovement
import {TileCoordinates} from "../../zykloplib/runescape/coordinates"
import {Vector2} from "../../zykloplib/math";
import {off} from "process";
import {direction} from "../../zykloplib/runescape/movement";
import {TileArea} from "../../zykloplib/runescape/coordinates/TileArea";

export class MovementBuilder {

    constructor(public value: EntityActionMovement) {

    }

    time(t: number): this {
        this.value.time = t
        return this
    }

    restrict(area: TileArea) : this {
        this.value.valid_from = area

        return this
    }

    fixed(target: TileCoordinates, relative: boolean = false): this {
        this.value.fixed_target = relative ? {target: target, relative: true} : {target: target}

        this.value.offset = undefined

        return this
    }

    offset(offset: Vector2 & { level: number }): this {
        this.value.offset = offset
        this.value.fixed_target = undefined

        return this
    }

    orientation(orientation: "bymovement" | "toentitybefore" | "toentityafter" | "keep"): this {
        this.value.orientation = orientation
        this.value.forced_orientation = undefined

        return this
    }

    forcedOrientation(orientation: direction): this {
        this.value.orientation = "forced"
        this.value.forced_orientation = {dir: orientation}

        return this
    }

    done(): EntityActionMovement {
        return this.value
    }
}

export namespace MovementBuilder {
    export function init(): MovementBuilder {
        return move({time: 1})
    }

    export function move(value: EntityActionMovement): MovementBuilder {
        return new MovementBuilder(value)
    }

    export function offset(offset: Vector2 & { level: number }): MovementBuilder {
        return init().offset(offset)
    }

    export function fixed(target: TileCoordinates): MovementBuilder {
        return init().fixed(target)
    }
}