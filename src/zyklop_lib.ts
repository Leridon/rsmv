
export type Vector2 = { x: number, y: number }

export namespace Vector2 {
    export function add(a: Vector2, b: Vector2): Vector2 {
        return {
            x: a.x + b.x,
            y: a.y + b.y
        }
    }

    export function sub(a: Vector2, b: Vector2): Vector2 {
        return {
            x: a.x - b.x,
            y: a.y - b.y
        }
    }

    export function scale(f: number, v: Vector2): Vector2 {
        return {
            x: v.x * f,
            y: v.y * f
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
}

export type direction = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export namespace direction {
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

    export function invert(d: direction): direction {
        // Could do something smart here, but a lookup table is easier and faster
        return [0, 3, 4, 1, 2, 7, 8, 5, 6][d] as direction
    }

    export function toVector(d: direction): Vector2 {
        return vectors[d]
    }

    export function fromDelta(v: Vector2): direction {
        return vectors.findIndex((c) => Vector2.eq(c, v)) as direction
    }
}
