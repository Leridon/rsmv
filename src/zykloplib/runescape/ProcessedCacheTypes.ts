import {Path} from "./pathing";
import {Vector2} from "../math";
import {npcs} from "../../../generated/npcs";
import {objects} from "../../../generated/objects";
import {TileCoordinates} from "./coordinates";
import * as lodash from "lodash"
import {act} from "react-dom/test-utils";

export namespace ProcessedCacheTypes {

    import CursorType = Path.CursorType;
    export type cache = { type: "npc", id: PrototypeID.NPC, data: npcs } | { type: "loc", id: PrototypeID.Loc, data: objects }

    type Action = [string, CursorType, number]

    export namespace Action {
        export function fromCache(cache: cache): Action[] {
            return [0, 1, 2, 3, 4].map(i => {
                const action = cache.data[`actions_${i}`] ?? cache.data[`members_action_${i + 1}`]

                let exists = !!action

                if (!exists) return undefined

                const cursor = cache.data[`action_cursors_${i}`]

                return [action as string, CursorType.fromCacheCursor(cursor), cursor] satisfies Action
            }).filter(a => a != null).map(a => a!)
        }
    }

    export type Prototype = Prototype.Loc | Prototype.Npc


    export namespace Prototype {
        type base = {
            id: PrototypeID;
            size: Vector2,
            actions: Action[],
            name: string,
        }

        export type Loc = base & {
            raw?: objects,
            id: PrototypeID.Loc,
        }

        export type Npc = base & {
            raw?: npcs,
            id: PrototypeID.NPC
        }

        export function isLoc(prototype: Prototype): prototype is Loc {
            return prototype.id[0] == "loc"
        }

        export function fromCache(cache: cache & { type: "loc" }): Prototype.Loc
        export function fromCache(cache: cache & { type: "npc" }): Prototype.Npc
        export function fromCache(cache: cache): Prototype {
            switch (cache.type) {
                case "npc":
                    return {
                        id: cache.id,
                        name: cache.data.name ?? "",
                        actions: Action.fromCache(cache),
                        size: {x: 1, y: 1}
                    } satisfies Prototype.Npc

                case "loc":
                    return {
                        id: cache.id,
                        name: cache.data.name ?? "",
                        actions: Action.fromCache(cache),
                        size: {x: cache.data.width ?? 1, y: cache.data.length ?? 1}
                    } satisfies Prototype.Loc
            }
        }
    }

    export type PrototypeID = PrototypeID.NPC | PrototypeID.Loc

    export namespace PrototypeID {
        export type NPC = ["npc", number]
        export type Loc = ["loc", number]

        export function hash(id: PrototypeID): string {
            return id[0] + ":" + id[1]
        }
    }

    export type Instance = Instance.Loc | Instance.NPC

    export namespace Instance {
        type base = {
            id: PrototypeID,
            rotation: number,
            position: TileCoordinates
        }

        export type Loc = base & {id: PrototypeID.Loc} & {}
        export type NPC = base & {id: PrototypeID.NPC} & {}
    }

    export type GroupedInstanceData = GroupedInstanceData.Loc | GroupedInstanceData.NPC

    export namespace GroupedInstanceData {
        export type base = { id: PrototypeID, instances: Instance[] }
        export type Loc = base & { id: PrototypeID.Loc, instances: Instance.Loc[] }
        export type NPC = base & { id: PrototypeID.NPC, instances: Instance.NPC[] }

        export function combine(...data: GroupedInstanceData[][]): GroupedInstanceData[] {
            const combined: Record<string, GroupedInstanceData> = {}

            data.forEach(group => group.forEach(data => {
                const hash = PrototypeID.hash(data.id)
                if (!combined[hash]) combined[hash] = lodash.cloneDeep(data)
                else combined[hash].instances.push(...lodash.cloneDeep(data.instances))
            }))

            return Object.values(combined)
        }
    }

    type FileA = Prototype[]
    type FileB = GroupedInstanceData[]


    export class PrototypeIndex<Loc = Prototype.Loc, NPC = Prototype.Npc> {
        private lookup_table: {
            loc: Loc[],
            npc: NPC[]
        } = {
            loc: [],
            npc: []
        }

        constructor(data: (Loc | NPC)[], f: (_: Loc | NPC) => PrototypeID) {
            //todo()
        }

        static fromPrototypes(prototypes: Prototype[]): PrototypeIndex {
            return new PrototypeIndex(prototypes, p => p.id) as PrototypeIndex
        }

        lookup(id: PrototypeID.Loc): Loc
        lookup(id: PrototypeID.NPC): NPC
        lookup(id: PrototypeID): Loc | NPC {
            return this.lookup_table[id[0]][id[1]]
        }
    }

}