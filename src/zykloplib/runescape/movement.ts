import {TileCoordinates} from "./coordinates";
import * as lodash from "lodash"
import {Rectangle, Transform, Vector2} from "../math";
import * as pako from "pako"

type TileMovementData = number

namespace TileMovementData {
    export function free(tile: TileMovementData, d: direction): boolean {
        const t = [1, 2, 4, 8, 16, 32, 64, 128]

        return (Math.floor(tile / t[d - 1]) % 2) != 0
    }
}

export type PlayerPosition = {
    tile: TileCoordinates,
    direction: direction
}

export namespace PlayerPosition {
    export function eq(a: PlayerPosition, b: PlayerPosition) {
        return TileCoordinates.eq(a.tile, b.tile) && a.direction == b.direction
    }
}

interface MapData {
    getTile(coordinate: TileCoordinates): Promise<TileMovementData>
}

type file = Uint8Array

export class HostedMapData implements MapData {

    meta = {
        chunks_per_file: 20,
        chunks_x: 100,
        chunks_z: 200,
        chunk_size: 64
    }

    chunks: (file | Promise<file>)[][]

    private async fetch(file_x: number, file_z: number, floor: number): Promise<Uint8Array> {
        let a = await fetch(`map/collision-${file_x}-${file_z}-${floor}.bin`)

        return new Uint8Array(pako.inflate(await a.arrayBuffer()))
    }

    private constructor() {
        // For every floor (0 to 3), create enough slots in the data cache.
        this.chunks = [null, null, null, null].map(() => Array(this.meta.chunks_x * this.meta.chunks_z / (this.meta.chunks_per_file * this.meta.chunks_per_file)))
    }

    private static _instance: HostedMapData = new HostedMapData()

    static get() {
        return HostedMapData._instance
    }

    async getTile(coordinate: TileCoordinates): Promise<TileMovementData> {
        let floor = coordinate.level || 0

        let file_x = Math.floor(coordinate.x / (this.meta.chunk_size * this.meta.chunks_per_file))
        let file_y = Math.floor(coordinate.y / (this.meta.chunk_size * this.meta.chunks_per_file))
        let file_i = file_y * this.meta.chunks_per_file + file_x

        if (!this.chunks[floor][file_i]) {

            let promise = this.fetch(file_x, file_y, floor)

            this.chunks[floor][file_i] = promise

            promise.then((a) => {
                this.chunks[floor][file_i] = a
            })
        }

        let tile_x = coordinate.x % (this.meta.chunk_size * this.meta.chunks_per_file)
        let tile_y = coordinate.y % (this.meta.chunk_size * this.meta.chunks_per_file)
        let tile_i = tile_y * (this.meta.chunk_size * this.meta.chunks_per_file) + tile_x

        return (await this.chunks[floor][file_i])[tile_i]
    }
}

export class ClearMapData implements MapData {
    getTile(coordinate: TileCoordinates): Promise<TileMovementData> {
        return Promise.resolve(255);
    }
}

export type direction = direction.none | direction.cardinal | direction.ordinal

export namespace direction {
    export type cardinal = 1 | 2 | 3 | 4
    export type ordinal = 5 | 6 | 7 | 8
    export type none = 0

    export const cardinals: cardinal[] = [1, 2, 3, 4]
    export const ordinals: ordinal[] = [5, 6, 7, 8]
    export const all: (cardinal | ordinal)[] = [1, 2, 3, 4, 5, 6, 7, 8]

    const vectors: Vector2[] = [
        {x: 0, y: 0},   // 0 center
        {x: -1, y: 0},  // 1 left
        {x: 0, y: 1},   // 2 top
        {x: 1, y: 0},   // 3 right
        {x: 0, y: -1},  // 4 bottom
        {x: -1, y: 1},  // 5 topleft
        {x: 1, y: 1},   // 6 topright
        {x: 1, y: -1},  // 7 botright
        {x: -1, y: -1}, // 8 botleft
    ]

    export function invert(d: cardinal): cardinal
    export function invert(d: ordinal): ordinal
    export function invert(d: none): none
    export function invert(d: direction): direction
    export function invert(d: direction): direction {
        return [0, 3, 4, 1, 2, 7, 8, 5, 6][d] as direction
    }

    export function isCardinal(dir: direction): dir is cardinal {
        return dir >= 1 && dir <= 4
    }

    export function isOrdinal(dir: direction): dir is ordinal {
        return dir >= 5
    }

    export function toVector(d: direction): Vector2 {
        return vectors[d]
    }

    export function fromDelta(v: Vector2): direction {
        return [
            [8, 4, 7],
            [1, 0, 3],
            [5, 2, 6],
        ][v.y + 1][v.x + 1] as direction
    }

    export function fromVector(v: Vector2): direction {
        // There is most likely a better solution, but this is enough for now
        // It's an 23 by 23 box where real click are clamped into.
        const lookup_table = [
            [5, 5, 5, 5, 5, 5, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 6, 6, 6, 6, 6, 6],
            [5, 5, 5, 5, 5, 5, 5, 2, 2, 2, 2, 2, 2, 2, 2, 2, 6, 6, 6, 6, 6, 6, 6],
            [5, 5, 5, 5, 5, 5, 5, 5, 2, 2, 2, 2, 2, 2, 2, 6, 6, 6, 6, 6, 6, 6, 6],
            [5, 5, 5, 5, 5, 5, 5, 5, 2, 2, 2, 2, 2, 2, 2, 6, 6, 6, 6, 6, 6, 6, 6],
            [5, 5, 5, 5, 5, 5, 5, 5, 5, 2, 2, 2, 2, 2, 6, 6, 6, 6, 6, 6, 6, 6, 6],
            [5, 5, 5, 5, 5, 5, 5, 5, 5, 2, 2, 2, 2, 2, 6, 6, 6, 6, 6, 6, 6, 6, 6],
            [1, 5, 5, 5, 5, 5, 5, 5, 5, 2, 2, 2, 2, 2, 6, 6, 6, 6, 6, 6, 6, 6, 3],
            [1, 1, 5, 5, 5, 5, 5, 5, 5, 5, 2, 2, 2, 6, 6, 6, 6, 6, 6, 6, 6, 3, 3],
            [1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 2, 2, 2, 6, 6, 6, 6, 6, 6, 3, 3, 3, 3],
            [1, 1, 1, 1, 1, 1, 1, 5, 5, 5, 5, 2, 6, 6, 6, 6, 3, 3, 3, 3, 3, 3, 3],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 5, 2, 6, 6, 3, 3, 3, 3, 3, 3, 3, 3, 3],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 4, 7, 7, 3, 3, 3, 3, 3, 3, 3, 3, 3],
            [1, 1, 1, 1, 1, 1, 1, 8, 8, 8, 8, 4, 7, 7, 7, 7, 3, 3, 3, 3, 3, 3, 3],
            [1, 1, 1, 1, 8, 8, 8, 8, 8, 8, 4, 4, 4, 7, 7, 7, 7, 7, 7, 3, 3, 3, 3],
            [1, 1, 8, 8, 8, 8, 8, 8, 8, 8, 4, 4, 4, 7, 7, 7, 7, 7, 7, 7, 7, 3, 3],
            [1, 8, 8, 8, 8, 8, 8, 8, 8, 4, 4, 4, 4, 4, 7, 7, 7, 7, 7, 7, 7, 7, 3],
            [8, 8, 8, 8, 8, 8, 8, 8, 8, 4, 4, 4, 4, 4, 7, 7, 7, 7, 7, 7, 7, 7, 7],
            [8, 8, 8, 8, 8, 8, 8, 8, 8, 4, 4, 4, 4, 4, 7, 7, 7, 7, 7, 7, 7, 7, 7],
            [8, 8, 8, 8, 8, 8, 8, 8, 4, 4, 4, 4, 4, 4, 4, 7, 7, 7, 7, 7, 7, 7, 7],
            [8, 8, 8, 8, 8, 8, 8, 8, 4, 4, 4, 4, 4, 4, 4, 7, 7, 7, 7, 7, 7, 7, 7],
            [8, 8, 8, 8, 8, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4, 7, 7, 7, 7, 7, 7, 7],
            [8, 8, 8, 8, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 7, 7, 7, 7, 7, 7],
        ]

        // TODO: Clamping probably isnt correct and also weird.

        // Clamp vector into bounds
        let v2 = Rectangle.clampInto(v, {
            topleft: {x: -11, y: 11},
            botright: {x: 11, y: -11},
        })

        return lookup_table[11 - v2.y][v2.x + 11] as direction
    }

    export function toString(dir: direction): string {
        return [
            "Center",
            "West",
            "North",
            "East",
            "South",
            "North-West",
            "North-East",
            "South-East",
            "South-West"
        ][dir]
    }

    export function toShortString(dir: direction): string {
        return [
            "C",
            "W",
            "N",
            "E",
            "S",
            "NW",
            "NE",
            "SE",
            "SW"
        ][dir]
    }

    export const center: none = 0
    export const west: cardinal = 1
    export const north: cardinal = 2
    export const east: cardinal = 3
    export const south: cardinal = 4
    export const northwest: ordinal = 5
    export const northeast: ordinal = 6
    export const southeast: ordinal = 7
    export const southwest: ordinal = 8

    export function transform(direction: direction, transform: Transform): direction {
        return fromVector(Vector2.snap(Vector2.transform(toVector(direction), transform)))
    }

    export function split(dir: ordinal): [cardinal, cardinal] {
        return ([
            [north, west],
            [north, east],
            [south, east],
            [south, west]
        ] as [cardinal, cardinal][]) [dir - 5]
    }

    export function rotate(dir: ordinal, quarters: number): ordinal
    export function rotate(dir: cardinal, quarters: number): cardinal
    export function rotate(dir: direction, quarters: number): direction {
        if (dir == center) return center

        return (dir - 1 + quarters) % 4 + 1 + Math.floor(dir / 5) * 4 as direction
    }
}

export function move(pos: TileCoordinates, off: Vector2) {
    return {
        x: pos.x + off.x,
        y: pos.y + off.y,
        level: pos.level
    }
}

export async function canMove(data: MapData, pos: TileCoordinates, d: direction): Promise<boolean> {
    // Data is preprocessed so for every tile there are 8 bit signalling in which directions the player can move.
    return TileMovementData.free(await data.getTile(pos), d)
}

export namespace MovementAbilities {
    export type movement_ability = "surge" | "dive" | "escape" | "barge"

    async function dive_internal(data: MapData, position: TileCoordinates, target: TileCoordinates): Promise<PlayerPosition | null> {
        // This function does not respect any max distances and expects the caller to handle that.

        if (position.level != target.level) return null

        let dia = Vector2.sign(Vector2.sub(target, position))

        let bound = Rectangle.from(position, target)

        let choices: { delta: Vector2, dir: direction }[] = []

        /* Repeat until tile found or out of bounds, only consider if not out of bounds:
         1. Move towards the target tile diagonally. Only if diagonal walk is permitted.
         (E.g. in an attempt to move 1 tile north-east, you actually move 1 tile east, then north due to a wall = doesn't count.)
         2. Move towards the target tile on X-axis.
         3. Move towards the target tile on Y-axis.
         */
        if (dia.x != 0 && dia.y != 0) choices.push({delta: dia, dir: direction.fromDelta(dia)})
        if (dia.x != 0) choices.push({delta: {x: dia.x, y: 0}, dir: direction.fromDelta({x: dia.x, y: 0})})
        if (dia.y != 0) choices.push({delta: {x: 0, y: dia.y}, dir: direction.fromDelta({x: 0, y: dia.y})})

        while (true) {
            if (Vector2.eq(position, target)) return {
                tile: position,
                direction: direction.fromVector(Vector2.sub(target, position))
            }

            let next: TileCoordinates | null = null

            for (let choice of choices) {
                let candidate = move(position, choice.delta)

                if (Rectangle.containsTile(bound, candidate) && (await canMove(data, position, choice.dir))) {
                    next = candidate
                    break
                }
            }

            if (!next) return null

            position = next
        }
    }

    async function dive_far_internal(data: MapData, start: TileCoordinates, dir: direction, max_distance: number): Promise<PlayerPosition | null> {
        let d = direction.toVector(dir)

        /*
         If clicked more than max distance:
         Check each tile, take the maximum
         */
        // Is there a way to optimize this so not every tile has to be checked?
        for (let i = max_distance; i > 0; i--) {
            let t = await dive_internal(data, start, move(start, Vector2.scale(i, d)))

            if (t) return t
        }

        return null
    }

    export async function dive(position: TileCoordinates, target: TileCoordinates, data: MapData = HostedMapData.get()): Promise<PlayerPosition | null> {

        let delta = Vector2.sub(target, position)

        if (Vector2.max_axis(delta) > 10) {
            let dir = direction.fromVector(delta)

            // This ignores the fact that dive is always consumed, even if diving a distance of 0 tiles.
            return await dive_far_internal(data, position, dir, 10)
        } else return dive_internal(data, position, target);
    }

    export async function barge(position: TileCoordinates, target: TileCoordinates, data: MapData = HostedMapData.get()): Promise<PlayerPosition | null> {
        return dive(position, target, data) // Barge is the same logic as dive
    }

    export async function surge(position: PlayerPosition, data: MapData = HostedMapData.get()): Promise<PlayerPosition | null> {
        return dive_far_internal(data, position.tile, position.direction, 10)
    }

    export async function escape(position: PlayerPosition, data: MapData = HostedMapData.get()): Promise<PlayerPosition | null> {
        let res = await dive_far_internal(data, position.tile, direction.invert(position.direction), 7)

        if (!res) return null
        else return {
            tile: res.tile,
            direction: position.direction
        }
    }

    export async function generic(data: MapData, ability: movement_ability, position: TileCoordinates, target: TileCoordinates): Promise<PlayerPosition | null> {
        switch (ability) {
        case "surge":
            return surge({tile: position, direction: direction.fromVector(Vector2.sub(target, position))}, data);
        case "dive":
            return dive(position, target, data);
        case "escape":
            return escape({tile: position, direction: direction.fromVector(Vector2.sub(position, target))}, data);
        case "barge":
            return barge(position, target, data);
        }
    }

    export function cooldown(ability: MovementAbilities.movement_ability, powerburst: boolean, mobile: boolean): number {
        switch (ability) {
        case "surge":
            return (powerburst ? 2 : (mobile ? 17 : 34))
        case "dive":
            return (powerburst ? 2 : (mobile ? 17 : 34))
        case "escape":
            return mobile ? 17 : 34 // Powerburst does not affect escape
        case "barge":
            return 34;
        }
    }
}