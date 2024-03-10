import {TileArea} from "../../zykloplib/runescape/coordinates/TileArea"
import {objects} from "../../../generated/objects"
import {TileCoordinates, TileRectangle} from "../../zykloplib/runescape/coordinates"
import {Transportation} from "../../zykloplib/runescape/transportation"
import {TileTransform} from "../../zykloplib/runescape/coordinates/TileTransform"
import {Transform, Vector2} from "../../zykloplib/math"
import {Path} from "../../zykloplib/runescape/pathing"
import {LocUtil} from "./LocUtil"
import {TransportParser} from "../TransportParser"

export namespace ParserConstructors {

    import LocWithUsages = LocUtil.LocWithUsages

    export function parser<ExtraData>(parser: TransportParser<ExtraData>): TransportParser<ExtraData> {
        return parser
    }

    import EntityActionMovement = Transportation.EntityActionMovement
    import CursorType = Path.CursorType
    import getAction = LocUtil.getAction
    export type BasicEntityParserOptions = {
        name?: string,
        plane_offset?: number,
        actions: {
            cache_index?: number,
            movement: EntityActionMovement[],
            interactive_area?: TileArea,
            name?: string,
            cursor?: CursorType
        }[]
    }

    export function basic_entity_parser(options: BasicEntityParserOptions): (loc: objects, use: LocWithUsages["uses"][number]) => Transportation.Transportation {
        return (entity, use) => {
            const origin = TileRectangle.bl(use.box)

            let transport: Transportation.EntityTransportation = {
                type: "entity",
                entity: {name: options.name ?? entity.name!!, kind: "static"},
                clickable_area: TileRectangle.from(
                    {x: 0, y: 0, level: 0},
                    {x: (entity.width ?? 1) - 1, y: (entity.length ?? 1) - 1, level: 0},
                ),
                actions:
                    options.actions.filter(a => !!a).map(a => {
                        const action = getAction(entity, a.cache_index ?? 0)!

                        return {
                            name: a.name ?? action?.name ?? "Unnamed Action",
                            cursor: a.cursor ?? action.cursor ?? "generic",
                            interactive_area: a.interactive_area ?? undefined,
                            movement: a.movement,
                        }
                    }),
            }

            // Apply rotation
            if (use.rotation != 0) {
                transport = Transportation.transform(transport, TileTransform.normalize(
                    Transform.rotation((4 - use.rotation) % 4), // Cache rotation is clockwise, while Transform.rotation is counterclockwise
                ))
            }

            transport = Transportation.transform(transport,
                                                 TileTransform.translation(Vector2.sub(origin, TileRectangle.bl(transport.clickable_area)), use.plane + (options.plane_offset ?? 0)),
            )

            transport.clickable_area = TileRectangle.extend(transport.clickable_area, 0.5)

            return transport
        }
    }

    export function ignore(name: string, ...loc_ids: number[]): TransportParser<undefined> {
        return {
            name: `(Ignore) ${name}`,
            variants: [{
                for: loc_ids,
            }],
            instance: null,
        }
    }

    function simple_entrance_parser(data: {
        loc: number,
        usages: {
            origin: TileCoordinates,
            target: TileCoordinates
        }[]
    }[]): TransportParser<any> {


        return parser<{
            origin: TileCoordinates,
            target: TileCoordinates
        }[]>({
                 variants: data.map(o => ({for: [o.loc], extra: o.usages})),

                 instance: (loc, extra) =>
                     basic_entity_parser({
                                             actions: [{

                                                 movement: [],
                                                 // movement: [MovementBuilder.fixed(null).done()],
                                             },
                                             ],
                                         }),
             })

    }

}