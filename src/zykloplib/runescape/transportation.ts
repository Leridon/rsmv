import {Rectangle, Vector2} from "../math"
import {TileRectangle} from "./coordinates"
import {TileCoordinates} from "./coordinates"
import {direction} from "./movement"
import {TileArea} from "./coordinates/TileArea"
import {TileTransform} from "./coordinates/TileTransform"
import {Path} from "./pathing"

export namespace Transportation {
    import EntityName = Path.EntityName
    import CursorType = Path.CursorType
    export type transportation_base = { type: string, source_loc?: number }

    export type EntityActionMovement = {
        valid_from?: TileArea, // Default: Entire interactive area
        offset?: Vector2 & { level: number },
        fixed_target?: { target: TileCoordinates, relative?: boolean },
        orientation?: "bymovement" | "toentitybefore" | "toentityafter" | "keep" | "forced", // Default: "bymovement"
        forced_orientation?: { dir: direction, relative?: boolean },
        time: number,
    }

    export type EntityAction = {
        cursor?: CursorType,
        name: string,
        movement: EntityActionMovement[],
        interactive_area?: TileArea, // Default: clickable area extended by 1
    }

    export type GeneralEntityTransportation = transportation_base & {
        type: "entity",
        entity: EntityName,
        clickable_area: TileRectangle,
        actions: EntityAction[]
    }

    export type DoorTransportation = transportation_base & {
        type: "door",
        position: TileCoordinates,
        direction: direction,
        name: string,
    }

    export type EntityTransportation = GeneralEntityTransportation | DoorTransportation

    export type Transportation = GeneralEntityTransportation | DoorTransportation

    export namespace EntityAction {
        export function findApplicable(action: EntityAction, tile: TileCoordinates): EntityActionMovement {
            return action.movement.find(movement => {
                return !movement.valid_from || TileArea.contains(movement.valid_from, tile)
            })!!
        }
    }

    /**
     * Coalesces all shortcuts into the general entity_shortcut.
     * More specifically, it transforms door shortcuts into an equivalent {@link entity_transportation} to allow unified handling across the code base.
     * Doors are modelled differently in case their handling for pathing is ever changed from the current, hacky variant.
     * @param shortcut
     */
    export function normalize(shortcut: Transportation): EntityTransportation {
        if (shortcut.type == "entity") return shortcut

        const off = direction.toVector(shortcut.direction)

        const other = TileCoordinates.move(shortcut.position, off)

        return {
            type: "entity",
            source_loc: shortcut.source_loc,
            entity: {kind: "static", name: shortcut.name},
            clickable_area: TileRectangle.extend(TileRectangle.from(TileCoordinates.move(shortcut.position, Vector2.scale(0.5, off))), 0.5),
            actions: [{
                cursor: "open",
                interactive_area: TileArea.fromRect(TileRectangle.from(shortcut.position, other)),

                name: `Cross ${direction.toString(shortcut.direction)}`,
                movement: [
                    {
                        time: 1,
                        offset: {...off, level: 0},
                        valid_from: {origin: shortcut.position},
                    },
                    {
                        time: 1,
                        offset: {...direction.toVector(direction.invert(shortcut.direction)), level: 0},
                        valid_from: {origin: other},
                    },
                ],
            }],
        }
    }

    export function bounds(shortcut: Transportation): TileRectangle {
        switch (shortcut.type) {
        case "entity":
            return TileRectangle.lift(Rectangle.combine(
                shortcut.clickable_area,
                //...shortcut.actions.map(a => a.interactive_area)
            ), shortcut.clickable_area.level)
        case "door":
            return TileRectangle.from(shortcut.position, TileCoordinates.move(shortcut.position, direction.toVector(shortcut.direction)))
        }
    }

    export function position(shortcut: Transportation): TileCoordinates {
        switch (shortcut.type) {
        case "entity":
            return TileRectangle.center(shortcut.clickable_area)
        case "door":
            return TileCoordinates.move(shortcut.position, Vector2.scale(0.5, direction.toVector(shortcut.direction)))
        }
    }

    export function name(shortcut: Transportation): string {
        switch (shortcut.type) {
        case "entity":
            return shortcut.entity.name
        case "door":
            return shortcut.name
        }
    }

    export function transform(transport: Transportation.GeneralEntityTransportation, transform: TileTransform): Transportation.GeneralEntityTransportation
    export function transform(transport: Transportation.EntityTransportation, transform: TileTransform): Transportation.EntityTransportation
    export function transform(transport: Transportation.DoorTransportation, transform: TileTransform): Transportation.DoorTransportation
    export function transform(transport: Transportation, transform: TileTransform): Transportation {
        switch (transport.type) {
        case "door":
            return {
                type: "door",
                name: transport.name,
                position: TileCoordinates.transform(transport.position, transform),
                direction: direction.transform(transport.direction, transform.matrix),
            }
        case "entity":
            return {
                type: "entity",
                entity: transport.entity,
                clickable_area: TileRectangle.transform(transport.clickable_area, transform),
                actions: transport.actions.map((a): EntityAction => ({
                    cursor: a.cursor,
                    interactive_area: a.interactive_area ? TileArea.transform(a.interactive_area, transform) : undefined,
                    name: a.name,
                    movement:
                        a.movement.map(movement => {
                            return {
                                time: movement.time,
                                valid_from: movement.valid_from
                                    ? TileArea.transform(movement.valid_from, transform)
                                    : undefined,
                                offset: movement.offset ? {
                                    ...Vector2.snap(Vector2.transform(movement.offset, transform.matrix)),
                                    level: movement.offset.level,
                                } : undefined,
                                fixed_target: movement.fixed_target
                                    ? (movement.fixed_target.relative
                                        ? {target: TileCoordinates.transform(movement.fixed_target.target, transform), relative: true}
                                        : movement.fixed_target)
                                    : undefined,
                                orientation: movement.orientation,
                                forced_orientation: movement.forced_orientation
                                    ? (movement.forced_orientation.relative ? {
                                        dir: direction.transform(movement.forced_orientation.dir, transform.matrix),
                                        relative: true,
                                    } : movement.forced_orientation)
                                    : undefined,
                            }
                        }),
                })),
            }


        }

    }
}
