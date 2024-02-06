import {TileCoordinates} from "./coordinates";
import {direction} from "./movement";

export namespace Teleports {
    export type teleport_group = {
        id: string
        name: string
        img: { url: string, width?: number, height?: number }
        can_be_in_pota?: boolean
        spots: teleport_spot[]
    }

    export type teleport_spot = {
        id: string
        spot: TileCoordinates
        facing?: direction
        code?: string
        name?: string
        menu_ticks: number
        animation_ticks: number
        img?: { url: string, width?: number, height?: number }
    }

    export type flat_teleport = {
        id: full_teleport_id,
        spot: TileCoordinates,
        icon: { url: string, width?: number, height?: number },
        code?: string,
        hover?: string,
        group: teleport_group,
        sub: teleport_spot,
        menu_ticks: number
        animation_ticks: number
    }

    type teleport_settings = {
        fairy_ring_favourites: string[],
        potas: {
            color: "red" | "purple" | "green" | "yellow",
            slots: string[],
            active: boolean
        }[]
    }

    export type full_teleport_id = {
        group: string,
        sub: string,
    }

    export namespace teleport_id {
        export function equals(a: full_teleport_id, b: full_teleport_id) {
            return a.group == b.group && a.sub == b.sub
        }
    }

    export function find(data: flat_teleport[], id: full_teleport_id): flat_teleport {
        return data.find((t) => teleport_id.equals(t.id, id))!!
    }

    export function flatten(data: teleport_group[]): flat_teleport[] {
        return flattenWithSettings(data, {
            fairy_ring_favourites: [],
            potas: []
        }, true)
    }

    export function flattenWithSettings(raw_data: teleport_group[], settings: teleport_settings, all_variants: boolean = false): flat_teleport[] {
        let data: flat_teleport[] = []

        for (let group of raw_data) {
            let pota = group.can_be_in_pota
                ? settings.potas.find((p) => p.active && p.slots.includes(group.id))
                : null

            let pota_prefix = pota ? `${pota.slots.indexOf(group.id) + 1},` : ""

            for (let sub of group.spots) {
                let hover = group.name || sub.name
                if (group.name && sub.name) hover = `${group.name} - ${sub.name}`

                let flat: flat_teleport = {
                    id: {
                        group: group.id,
                        sub: sub.id,
                    },
                    spot: sub.spot,
                    icon: sub.img || group.img,
                    code: sub.code,
                    hover: hover,
                    group: group,
                    sub: sub,
                    menu_ticks: sub.menu_ticks,
                    animation_ticks: sub.animation_ticks,
                }

                if (group.id == "fairyring") {
                    let index = settings.fairy_ring_favourites.indexOf(sub.id)
                    if (index >= 0) flat.code = ((index + 1) % 10).toString()
                }

                if (pota) {
                    flat.code = pota_prefix + flat.code
                    flat.icon = {url: `pota_${pota.color}.png`}
                }

                data.push(flat)

            }
        }

        return data
    }
}
