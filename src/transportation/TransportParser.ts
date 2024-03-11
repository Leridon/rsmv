import {objects} from "../../generated/objects"
import {LocUtil} from "./util/LocUtil"
import LocWithUsages = LocUtil.LocWithUsages
import {Transportation} from "../zykloplib/runescape/transportation"
import {transportation_rectangle_blacklists} from "./parsers"
import {Rectangle} from "../zykloplib/math"
import {TileCoordinates, TileRectangle} from "../zykloplib/runescape/coordinates";
import {EntityTransportationBuilder, GeneralEntityTransportationBuilder} from "./util/GeneralEntityTransportationBuilder";
import {isArray} from "util";
import {direction} from "../zykloplib/runescape/movement";

export type TransportParser<ExtraData = undefined> = {
    name?: string,
    description?: string,
    for?: number[],
    variants?: {
        for: number[],
        extra?: ExtraData extends undefined ? undefined : ExtraData
    }[]
    instance: ((loc: objects, extra_data: ExtraData) => (loc: objects, use: LocWithUsages["uses"][number]) => Transportation.Transportation[] | Transportation.Transportation) | null
}

export abstract class TransportParser2<
    PerLocData,
    PerInstanceData
> {
    public _name: string = "Unnamed"
    private instance_data_required: boolean = false

    public locs: {
        for: number[],
        data?: PerLocData,
        instance_data: {
            instance: TileCoordinates,
            data: PerInstanceData
        }[]
    }[] = []

    constructor() {

    }

    requireInstanceData(): this {
        this.instance_data_required = true

        return this
    }

    gather(loc: LocWithUsages): Transportation.Transportation[] {
        const loc_data = this.locs.find(l => l.for.includes(loc.id))

        const results = loc.uses
            .filter(use =>
                !transportation_rectangle_blacklists.some(blacklist => Rectangle.contains(blacklist, use.box.topleft)),
            )
            .flatMap(use => {
                try {
                    const instance_data = loc_data?.instance_data.find(t => TileCoordinates.eq2(t.instance, use.origin))?.data

                    if (this.instance_data_required && instance_data == null) return []

                    let result =
                        this.apply(loc.location,
                            use, {
                                per_loc: loc_data?.data!!,
                                per_instance: instance_data!!,
                            },
                        )

                    if (!Array.isArray(result)) result = [result]

                    return result
                } catch (e) {
                    console.error(`Parser ${this._name} failed!`)
                    console.error(e)
                    return []
                }
            })

        results.forEach(s => s.source_loc = loc.id)

        return results
    }

    loc(data: PerLocData | undefined = undefined): (...loc: number[]) => (...instance_data: [TileCoordinates, PerInstanceData | undefined][]) => this {
        return (...loc: number[]) => (...instance_data: [TileCoordinates, PerInstanceData | undefined][]): this => {
            this.locs.push({
                for: loc,
                data: data,
                instance_data: instance_data.map(([instance, value]) => {
                    return {
                        instance: instance,
                        data: value!!
                    }
                })
            })

            return this
        }
    }

    perUse(loc: number, data: PerLocData | undefined = undefined): (...instance_data: [TileCoordinates, PerInstanceData][]) => this {

        return (...instance_data: [TileCoordinates, PerInstanceData][]): this => {
            this.locs.push({
                for: [loc],
                data: data,
                instance_data: instance_data.map(([instance, value]) => {
                    return {
                        instance: instance,
                        data: value
                    }
                })
            })

            return this
        }
    }

    name(name: string): this {
        this._name = name
        return this
    }

    abstract apply(loc: objects, usage: LocWithUsages["uses"][number], data: { per_loc: PerLocData, per_instance?: PerInstanceData }): Transportation.Transportation[]
}

export namespace TransportParser {

    export abstract class Simple<LocT, InstanceT, BuilderT extends EntityTransportationBuilder> extends TransportParser2<LocT & { plane_offset?: number }, InstanceT> {

        protected constructor(private f: HandlerFunction<LocT, InstanceT, BuilderT>) {super();}

        map(f: HandlerFunction<LocT, InstanceT, BuilderT>): this {

            const old = this.f

            this.f = (builder, data, loc, usage) => {
                old(builder, data, loc, usage)
                f(builder, data, loc, usage)
            }

            return this
        }

        apply(loc: objects, usage: LocWithUsages["uses"][number], data: { per_loc: LocT & { plane_offset?: number }; per_instance?: InstanceT }): Transportation.Transportation[] {
            const builder = this.instantiate(loc, usage, data)

            this.f(builder, data, loc, usage)

            builder.finish()

            if (data.per_loc?.plane_offset != null) {
                builder.planeOffset(data.per_loc.plane_offset)
            }

            return [builder.value]
        }

        protected abstract instantiate(loc: objects, usage: LocWithUsages["uses"][number], data: { per_loc: LocT & { plane_offset?: number }; per_instance?: InstanceT }): BuilderT
    }

    export function simple<LocT = undefined, InstanceT = undefined>(name: string = "Anonymous"): Simple<LocT, InstanceT, GeneralEntityTransportationBuilder> {
        return (new class extends Simple<LocT, InstanceT, GeneralEntityTransportationBuilder> {
            constructor() {super(() => {});}

            protected instantiate(loc: objects, usage: LocUtil.LocWithUsages["uses"][number]): GeneralEntityTransportationBuilder {
                return GeneralEntityTransportationBuilder.from(loc, usage);
            }
        }).name(name)
    }

    export function door<LocT = {}, InstanceT = {}>(name: string = "Anonymous"): Simple<LocT & {
        base_direction?: direction
    }, InstanceT, EntityTransportationBuilder> {
        return (new class extends Simple<LocT & { base_direction?: direction }, InstanceT, EntityTransportationBuilder> {
            constructor() {super(() => {});}

            protected instantiate(loc: objects, usage: LocUtil.LocWithUsages["uses"][number], data: {
                per_loc: LocT & { base_direction?: direction };
                per_instance?: InstanceT
            }): EntityTransportationBuilder {
                return new EntityTransportationBuilder({
                    loc: loc, usage: usage
                }, {
                    type: "door",
                    name: loc.name!!,
                    direction: data.per_loc.base_direction ?? direction.west,
                    position: {x: 0, y: 0, level: 0}
                })
            }
        }).name(name)
    }

    export type HandlerFunction<LocT, InstanceT, BuilderT extends EntityTransportationBuilder> = (
        transport: BuilderT,
        data: { per_loc: LocT; per_instance?: InstanceT },
        loc: objects,
        usage: LocWithUsages["uses"][number]
    ) => void

    export function ignore(name: string, ...locs: number[]): TransportParser2<any, any> {
        return (new class extends TransportParser2<any, any> {

            apply(loc: objects, usage: LocUtil.LocWithUsages["uses"][number], data: { per_loc: any; per_instance?: any }): Transportation.Transportation[] {
                return [];
            }
        })
            .loc()(...locs)()
            .name(name)
    }
}