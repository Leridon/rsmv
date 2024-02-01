import {clamp, identity} from "lodash";

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
        export function add(...a: Vector2[]): Vector2 {
            return {
                x: a.map(v => v.x).reduce((c, d) => c + d, 0),
                y: a.map(v => v.y).reduce((c, d) => c + d, 0),
            }
        }

        export function sub(a: Vector2, b: Vector2): Vector2 {
            return {
                x: a.x - b.x,
                y: a.y - b.y
            }
        }

        export function mul(a: Vector2, b: Vector2): Vector2 {
            return {
                x: a.x * b.x,
                y: a.y * b.y
            }
        }

        export function neg(a: Vector2): Vector2 {
            return {
                x: -a.x,
                y: -a.y
            }
        }

        export function scale(f: number, v: Vector2): Vector2 {
            return {
                x: v.x * f,
                y: v.y * f
            }
        }

        export function length(a: Vector2): number {
            return Math.sqrt(lengthSquared(a))
        }

        export function lengthSquared(a: Vector2): number {
            return a.x * a.x + a.y * a.y
        }

        export function normalize(a: Vector2): Vector2 {
            return scale(1 / length(a), a)
        }

        export function sign(a: Vector2): Vector2 {
            return {
                x: Math.sign(a.x),
                y: Math.sign(a.y)
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

        export function min_axis(a: Vector2): number {
            return Math.min(Math.abs(a.x), Math.abs(a.y))
        }

        export function copy(c: Vector2): Vector2 {
            return {
                x: c.x,
                y: c.y
            }
        }

        export function snap(c: Vector2, grid: number = 1): Vector2 {
            return {x: Math.round(c.x / grid) * grid, y: Math.round(c.y / grid) * grid}
        }

        /**
         * Transforms a Vector2 by the given transform, interpreting the Vector as a direction.
         */
        export function transform(a: Vector2, trans: Transform): Vector2 {
            let r = Transform.apply(trans, [a.x, a.y, 0])

            return {x: r[0], y: r[1]}
        }

        /**
         * Transforms a Vector2 by the given transform, interpreting the Vector as a point in space.
         */
        export function transform_point(a: Vector2, trans: Transform): Vector2 {
            let r = Transform.apply(trans, [a.x, a.y, 1])

            return snap({x: r[0], y: r[1]}, 0.5)
        }

        export function abs(a: Vector2): Vector2 {
            return {x: Math.abs(a.x), y: Math.abs(a.y)}
        }

        export function toString(a: Vector2): string {
            return `${a.x}|${a.y}`
        }

        export function hash(c: Vector2, mod: number = 64): number {
            return Math.floor(Math.abs((c.x ^ c.y) % mod))
        }
    }

    export type Transform = Transform.Matrix

    export namespace Transform {
        export type Vector3 = [number, number, number]
        export type Matrix = [Vector3, Vector3, Vector3]

        export namespace Vector3 {
            export function toVector2(a: Vector3): Vector2 {
                return {x: a[0], y: a[1]}
            }

            export function position(a: Vector2): Vector3 {
                return [a.x, a.y, 1]
            }

            export function direction(a: Vector2): Vector3 {
                return [a.x, a.y, 0]
            }
        }

        function mul(a: Vector3, b: Vector3): number {
            return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
        }

        export function translation(offset: Vector2): Transform {
            return [
                [1, 0, offset.x],
                [0, 1, offset.y],
                [0, 0, 1]
            ]
        }

        export function rotation(rot: number): Transform {
            let theta = rot * Math.PI / 2

            return [
                [Math.cos(theta), -Math.sin(theta), 0],
                [Math.sin(theta), Math.cos(theta), 0],
                [0, 0, 1]
            ]
        }

        export function scale(scale: Vector2): Transform {
            return [
                [scale.x, 0, 0],
                [0, scale.y, 0],
                [0, 0, 1]
            ]
        }

        export function mirror_x(): Transform {
            return [
                [-1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ]
        }

        export function mirror_y(): Transform {
            return [
                [1, 0, 0],
                [0, -1, 0],
                [0, 0, 1]
            ]
        }

        export function row(a: Transform, n: 0 | 1 | 2): Vector3 {
            return a[n]
        }

        export function col(a: Transform, n: 0 | 1 | 2): Vector3 {
            return [a[0][n], a[1][n], a[2][n]]
        }

        export function mult(a: Transform, b: Transform): Transform {
            return [0, 1, 2].map((r) =>
                                     [0, 1, 2].map((c) =>
                                                       mul(row(a, r as 0 | 1 | 2), col(b, c as 0 | 1 | 2))
                                     )
            ) as Matrix
        }

        export function apply(a: Transform, b: Vector3): Vector3 {
            return [
                mul(row(a, 0), b),
                mul(row(a, 1), b),
                mul(row(a, 2), b),
            ]
        }

        export function identity(): Transform {
            return [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ]
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

    export type Rectangle = { topleft: Vector2, botright: Vector2 }

    export namespace Rectangle {
        export function from(...points: Vector2[]): Rectangle | null {
            points = points.filter(identity)

            if (points.length == 0) return null

            return {
                topleft: {x: Math.min(...points.map(v => v.x)), y: Math.max(...points.map(v => v.y))},
                botright: {x: Math.max(...points.map(v => v.x)), y: Math.min(...points.map(v => v.y))},
            }
        }

        export function containsTile(box: Rectangle, tile: Vector2) {
            return box.topleft.x - 0.5 <= tile.x
                && box.topleft.y + 0.5 >= tile.y
                && box.botright.x + 0.5 >= tile.x
                && box.botright.y - 0.5 <= tile.y
        }

        export function contains(box: Rectangle, tile: Vector2) {
            return box.topleft.x <= tile.x
                && box.topleft.y >= tile.y
                && box.botright.x >= tile.x
                && box.botright.y <= tile.y
        }

        export function extend(box: Rectangle, padding: number): Rectangle {
            return {
                topleft: Vector2.add(box.topleft, {x: -padding, y: padding}),
                botright: Vector2.add(box.botright, {x: padding, y: -padding}),
            }
        }

        export function clampInto(pos: Vector2, area: Rectangle): Vector2 {
            return {
                x: clamp(pos.x, area.topleft.x, area.botright.x),
                y: clamp(pos.y, area.botright.y, area.topleft.y),
            }
        }

        export function center(box: Rectangle, snap: boolean = true): Vector2 {
            let c = {
                x: (box.topleft.x + box.botright.x) / 2,
                y: (box.topleft.y + box.botright.y) / 2
            }

            if (snap) return Vector2.snap(c)
            else return c
        }

        export function left(rect: Rectangle): Rectangle {
            return {
                topleft: {x: rect.topleft.x, y: rect.topleft.y},
                botright: {x: rect.topleft.x, y: rect.botright.y}
            }
        }

        export function right(rect: Rectangle): Rectangle {
            return {
                topleft: {x: rect.botright.x, y: rect.topleft.y},
                botright: {x: rect.botright.x, y: rect.botright.y}
            }
        }

        export function top(rect: Rectangle): Rectangle {
            return {
                topleft: {x: rect.topleft.x, y: rect.topleft.y},
                botright: {x: rect.botright.x, y: rect.topleft.y}
            }
        }

        export function bottom(rect: Rectangle): Rectangle {
            return {
                topleft: {x: rect.topleft.x, y: rect.botright.y},
                botright: {x: rect.botright.x, y: rect.botright.y}
            }
        }

        export function topRight(rect: Rectangle): Vector2 {
            return {x: rect.botright.x, y: rect.topleft.y}
        }

        export function bottomLeft(rect: Rectangle): Vector2 {
            return {x: rect.topleft.x, y: rect.botright.y}
        }

        export function tileWidth(rect: Rectangle): number {
            return rect.botright.x - rect.topleft.x + 1
        }

        export function tileHeight(rect: Rectangle): number {
            return rect.topleft.y - rect.botright.y + 1
        }

        export function width(rect: Rectangle): number {
            return rect.botright.x - rect.topleft.x
        }

        export function height(rect: Rectangle): number {
            return rect.topleft.y - rect.botright.y
        }

        export function extendTo(rect: Rectangle, tile: Vector2): Rectangle {
            return {
                topleft: {
                    x: Math.min(rect.topleft.x, tile.x),
                    y: Math.max(rect.topleft.y, tile.y)
                },
                botright: {
                    x: Math.max(rect.botright.x, tile.x),
                    y: Math.min(rect.botright.y, tile.y)
                }
            }
        }

        export function extendToRect(rect: Rectangle, other: Rectangle): Rectangle {
            return extendTo(extendTo(rect, other.topleft), other.botright)
        }

        export function combine(...rects: Rectangle[]): Rectangle | null {
            return Rectangle.from(...rects.flatMap(r => r ? [r.topleft, r.botright] : []))
        }

        export function translate(rect: Rectangle, off: Vector2): Rectangle {
            return {
                topleft: Vector2.add(rect.topleft, off),
                botright: Vector2.add(rect.botright, off)
            }
        }

        export function transform(rect: Rectangle, trans: Transform): Rectangle | null {
            return Rectangle.from(
                Vector2.transform_point(rect.topleft, trans),
                Vector2.transform_point(rect.botright, trans),
            )
        }

        export function overlaps(a: Rectangle, b: Rectangle): boolean {
            return (a.topleft.x <= b.botright.x && a.botright.x >= b.topleft.x) &&
                (a.botright.y <= b.topleft.y && a.topleft.y >= b.botright.y)
        }

        export function centeredOn(center: Vector2, radius: number): Rectangle {
            return {
                topleft: Vector2.add(center, {x: -radius, y: radius}),
                botright: Vector2.add(center, {x: radius, y: -radius}),
            }
        }
    }
}