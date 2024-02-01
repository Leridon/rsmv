export namespace ZyklopLib {
    export async function time<T>(name: string, f: () => T): Promise<T> {

        let timeStart = new Date().getTime()

        process.stdout.write(`Starting task ${name}: `)
        let res  = await f()
        const ms = (new Date().getTime() - timeStart)
        process.stdout.write(`${ms}ms\n`)

        return res
    }

    export type Vector2 = { x: number, y: number }

    export namespace Vector2 {
        export function add(a: Vector2, b: Vector2): Vector2 {
            return {
                x: a.x + b.x,
                y: a.y + b.y,
            }
        }

        export function sub(a: Vector2, b: Vector2): Vector2 {
            return {
                x: a.x - b.x,
                y: a.y - b.y,
            }
        }

        export function scale(f: number, v: Vector2): Vector2 {
            return {
                x: v.x * f,
                y: v.y * f,
            }
        }

        export function length(a: Vector2): number {
            return Math.sqrt(a.x * a.x + a.y * a.y)
        }

        export function normalize(a: Vector2): Vector2 {
            return scale(1 / length(a), a)
        }

        export function sign(a: Vector2): Vector2 {
            return {
                x: Math.sign(a.x),
                y: Math.sign(a.y),
            }
        }

        export function rotate(v: Vector2, angle_radians: number): Vector2 {
            let sin = Math.sin(angle_radians)
            let cos = Math.cos(angle_radians)

            return {
                x: cos * v.x - sin * v.y,
                y: sin * v.x + cos * v.y,
            }
        }

        export function eq(a: Vector2, b: Vector2): boolean {
            return a.x == b.x && a.y == b.y
        }

        export function manhatten(a: Vector2): number {
            return Math.abs(a.x) + Math.abs(a.y)
        }

        export function max_axis(a: Vector2): number {
            return Math.max(Math.abs(a.x), Math.abs(a.y))
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

        export function split(dir: ordinal): [cardinal, cardinal] {
            return ([
                [north, west],
                [north, east],
                [south, east],
                [south, west]
            ] as [cardinal, cardinal][]) [dir - 5]

        }
    }
}