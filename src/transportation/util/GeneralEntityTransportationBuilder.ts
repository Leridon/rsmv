import {Transportation} from "../../zykloplib/runescape/transportation";
import GeneralEntityTransportation = Transportation.GeneralEntityTransportation;
import {objects} from "../../../generated/objects";
import {LocUtil} from "./LocUtil";
import {TileRectangle} from "../../zykloplib/runescape/coordinates";
import LocWithUsages = LocUtil.LocWithUsages;
import EntityAction = Transportation.EntityAction;
import {TileArea} from "../../zykloplib/runescape/coordinates/TileArea";
import {Path} from "../../zykloplib/runescape/pathing";
import CursorType = Path.CursorType;
import getAction = LocUtil.getAction;
import {MovementBuilder} from "./MovementBuilder";
import getActions = LocUtil.getActions;
import {TileTransform} from "../../zykloplib/runescape/coordinates/TileTransform";
import {Transform, Vector2} from "../../zykloplib/math";
import EntityTransportation = Transportation.EntityTransportation;

export class EntityActionBuilder {

    constructor(public value: EntityAction) {

    }

    movement(...movement: MovementBuilder[]): this {
        this.value.movement.push(...movement.map(m => m.done()))

        return this
    }
}

export class EntityTransportationBuilder {
    private plane_offset = 0

    constructor(public underlying: {
                    loc: objects,
                    usage: LocWithUsages["uses"][number]
                },
                public value: EntityTransportation) {}

    planeOffset(offset: number): this {
        this.plane_offset = offset

        return this
    }

    finish() {
        let transport = this.value
        let use = this.underlying.usage

        // Apply rotation
        if (use.rotation != 0) {
            transport = Transportation.transform(transport, TileTransform.normalize(
                Transform.rotation((4 - use.rotation) % 4), // Cache rotation is clockwise, while Transform.rotation is counterclockwise
            ))
        }

        const current_origin = transport.type == "entity"
            ? TileRectangle.bl(transport.clickable_area)
            : transport.position

        transport = Transportation.transform(transport,
            TileTransform.translation(Vector2.sub(use.origin, current_origin), use.plane + this.plane_offset),
        )

        if (transport.type == "entity") {
            transport.clickable_area = TileRectangle.extend(transport.clickable_area, 0.5)
        }
        this.value = transport
    }
}

export class GeneralEntityTransportationBuilder extends EntityTransportationBuilder {
    constructor(
        public underlying: {
            loc: objects,
            usage: LocWithUsages["uses"][number]
        },
        public value: GeneralEntityTransportation) {

        super(underlying, value)
    }

    action(override: {
        index?: number,
        cursor?: CursorType,
        name?: string,
        interactive_area?: TileArea,
    } = {}, ...movements: MovementBuilder[]) {

        const action =
            override.index != null
                ? getAction(this.underlying.loc, override.index)!
                : getActions(this.underlying.loc)[0]

        const a = new EntityActionBuilder({
            name: override.name ?? action?.name ?? "Unnamed Action",
            cursor: override.cursor ?? action.cursor ?? "generic",
            interactive_area: override.interactive_area ?? undefined,
            movement: [],
        })

        a.movement(...movements)

        this.value.actions.push(a.value)

        return this
    }
}

export namespace EntityTransportationBuilder {
    import LocWithUsages = LocUtil.LocWithUsages;

    export function from(entity: objects, use: LocWithUsages["uses"][number]): GeneralEntityTransportationBuilder {
        const transport: Transportation.EntityTransportation = {
            type: "entity",
            entity: {name: entity.name!!, kind: "static"},
            clickable_area: TileRectangle.from(
                {x: 0, y: 0, level: 0},
                {x: (entity.width ?? 1) - 1, y: (entity.length ?? 1) - 1, level: 0},
            ),
            actions: [],
        }

        return new GeneralEntityTransportationBuilder({
            loc: entity, usage: use
        }, transport)
    }
}