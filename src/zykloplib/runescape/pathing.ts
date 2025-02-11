import {direction, MovementAbilities} from "./movement";
import movement_ability = MovementAbilities.movement_ability;
import {Teleports} from "./teleports";
import {TileCoordinates} from "./coordinates";
import {Transportation} from "./transportation"

export namespace Path {
    import EntityTransportation = Transportation.EntityTransportation
    export type CursorType =
        "generic"
        | "chop"
        | "talk"
        | "open"
        | "enter"
        | "spellonentity"
        | "agility"
        | "ladderdown"
        | "ladderup"
        | "read"
        | "fish"
        | "search"
        | "attack"
        | "craft"
        | "build"
        | "mine"
        | "trade"
        | "use"
        | "cook"
        | "divine"
        | "loot"
        | "picklock"
        | "shovel"
        | "equip"
        | "hunt"
        | "discover"
        | "smith"
        | "herblore"
        | "burn"
        | "pray"
        | "runecraft"
        | "thieve"
        | "disassemble"
        | "farm"
        | "jump"
    // TODO: Archaelogy

    export type PathAssumptions = {
        double_surge?: boolean,
        double_escape?: boolean,
        mobile_perk?: boolean,
    }

    export namespace CursorType {
        export type Meta = { type: CursorType, icon_url: string, description: string, short_icon: string }

        export function all(): Meta[] {
            return [
                {type: "generic", icon_url: "assets/icons/cursor_generic.png", description: "Click", short_icon: "cursor_generic"},
                {type: "chop", icon_url: "assets/icons/cursor_chop.png", description: "Chop", short_icon: "cursor_chop"},
                {type: "talk", icon_url: "assets/icons/cursor_talk.png", description: "Talk to", short_icon: "cursor_talk"},
                {type: "open", icon_url: "assets/icons/cursor_open.png", description: "Open", short_icon: "cursor_open"},
                {type: "enter", icon_url: "assets/icons/cursor_enter.png", description: "Enter", short_icon: "cursor_enter"},
                {type: "spellonentity", icon_url: "assets/icons/cursor_alchemy.png", description: "Use spell", short_icon: "cursor_spell"},
                {type: "agility", icon_url: "assets/icons/cursor_agility.png", description: "Use", short_icon: "cursor_agility"},
                {type: "ladderdown", icon_url: "assets/icons/cursor_ladderdown.png", description: "Climb down ladder", short_icon: "cursor_ladderdown"},
                {type: "ladderup", icon_url: "assets/icons/cursor_ladderup.png", description: "Climb up ladder", short_icon: "cursor_ladderup"},
                {type: "read", icon_url: "assets/icons/cursor_read.png", description: "Read", short_icon: "cursor_read"},
                {type: "fish", icon_url: "assets/icons/cursor_fish.png", description: "Fish", short_icon: "cursor_fish"},
                {type: "search", icon_url: "assets/icons/cursor_search.png", description: "Search", short_icon: "cursor_search"},
                {type: "attack", icon_url: "assets/icons/cursor_attack.png", description: "Attack", short_icon: "cursor_attack"},
                {type: "craft", icon_url: "assets/icons/cursor_craft.png", description: "Craft at", short_icon: "cursor_craft"},
                {type: "build", icon_url: "assets/icons/cursor_build.png", description: "Build", short_icon: "cursor_build"},
                {type: "mine", icon_url: "assets/icons/cursor_mine.png", description: "Mine", short_icon: "cursor_mine"},
                {type: "trade", icon_url: "assets/icons/cursor_trade.png", description: "Trade", short_icon: "cursor_trade"},
                {type: "use", icon_url: "assets/icons/cursor_use.png", description: "Use", short_icon: "cursor_use"},
                {type: "cook", icon_url: "assets/icons/cursor_cook.png", description: "Cook", short_icon: "cursor_cook"},
                {type: "divine", icon_url: "assets/icons/cursor_divine.png", description: "Divine", short_icon: "cursor_divine"},
                {type: "loot", icon_url: "assets/icons/cursor_loot.png", description: "Loot", short_icon: "cursor_loot"},
                {type: "picklock", icon_url: "assets/icons/cursor_picklock.png", description: "Pick Lock", short_icon: "cursor_picklock"},
                {type: "shovel", icon_url: "assets/icons/cursor_shovel.png", description: "Shovel", short_icon: "cursor_shovel"},
                {type: "equip", icon_url: "assets/icons/cursor_equip.png", description: "Equip", short_icon: "cursor_equip"},
                {type: "discover", icon_url: "assets/icons/cursor_discover.png", description: "Discover", short_icon: "cursor_discover"},
                {type: "smith", icon_url: "assets/icons/cursor_smith.png", description: "Smith", short_icon: "cursor_smith"},
                {type: "herblore", icon_url: "assets/icons/cursor_herblore.png", description: "Herblore", short_icon: "cursor_herblore"},
                {type: "hunt", icon_url: "assets/icons/cursor_hunt.png", description: "Hunt", short_icon: "cursor_hunt"},
                {type: "burn", icon_url: "assets/icons/cursor_burn.png", description: "Burn", short_icon: "cursor_burn"},
                {type: "pray", icon_url: "assets/icons/cursor_pray.png", description: "Pray", short_icon: "cursor_pray"},
                {type: "runecraft", icon_url: "assets/icons/cursor_runecraft.png", description: "Runecraft", short_icon: "cursor_runecraft"},
                {type: "thieve", icon_url: "assets/icons/cursor_thieve.png", description: "Thieve", short_icon: "cursor_thieve"},
                {type: "disassemble", icon_url: "assets/icons/cursor_invention.png", description: "Disassemble", short_icon: "cursor_invention"},
                {type: "farm", icon_url: "assets/icons/cursor_farm.png", description: "Forage", short_icon: "cursor_farm"},
                {type: "jump", icon_url: "assets/icons/cursor_jump.png", description: "Jump", short_icon: "cursor_jump"},
            ]
        }

        export function meta(type: CursorType): Meta {
            return all().find(s => s.type == type)!!
        }

        export function fromCacheCursor(id: number | null | undefined) {
            const table: Record<number, CursorType> = {
                0: "generic",
                5: "trade",
                42: "attack",
                44: "talk",
                46: "use",
                49: "open",
                51: "equip",
                52: "ladderup",
                53: "ladderdown",
                55: "jump",
                56: "search",
                57: "enter",
                58: "mine",
                59: "chop",
                60: "fish",
                61: "pray",
                63: "smith",
                64: "cook",
                171: "farm",
                173: "shovel",
                181: "agility",
                200: "divine",
                208: "discover",
            }

            return table[id ?? 0] || "generic"
        }

        export function iconSize(scale: number = 1): [number, number] {
            return [scale * 28, scale * 31]
        }

        export function iconAnchor(scale: number = 1, centered: boolean = false): [number, number] {
            return centered ? [scale * 14, scale * 16] : [scale * 3, 0]
        }

    }

    export type EntityName = {
        name: string,
        kind: EntityName.Kind
    }

    export namespace EntityName {
        export type Kind = "npc" | "static" | "item"
    }

    type step_base = {
        type: string,
        description?: string
    }

    export type step_orientation = step_base & {
        type: "orientation",
        direction: direction
    }

    export type step_ability = step_base & {
        type: "ability",
        ability: movement_ability,
        target?: EntityName,
        target_text?: string,
        from: TileCoordinates,
        to: TileCoordinates,
    }

    export type step_run = step_base & {
        type: "run",
        to_text?: string,
        waypoints: TileCoordinates[]
    }

    export type step_teleport = step_base & {
        type: "teleport",
        id: Teleports.full_teleport_id,
        spot_override?: TileCoordinates
    }

    export type step_interact = step_base & {
        type: "interaction",
        ticks: number,
        where: TileCoordinates,
        starts: TileCoordinates,
        ends_up: TileCoordinates,
        forced_direction: direction
        how: CursorType
    }

    export type step_shortcut = step_base & {
        type: "shortcut_v2",
        assumed_start: TileCoordinates,
        internal: EntityTransportation
    }

    export type step_redclick = step_base & {
        type: "redclick",
        target: EntityName,
        where: TileCoordinates,
        how: CursorType
    }

    export type step_powerburst = step_base & {
        type: "powerburst",
        where: TileCoordinates
    }

    export type step = step_orientation | step_ability | step_run | step_teleport | step_interact | step_redclick | step_powerburst | step_shortcut
}