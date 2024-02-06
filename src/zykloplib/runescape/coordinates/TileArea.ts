import {TileCoordinates} from "./TileCoordinates"
import {Rectangle, Vector2} from "../../math"
import {base64ToBytes, bytesToBase64} from "byte-base64"
import {TileRectangle} from "./TileRectangle"
import {TileTransform} from "./TileTransform"

export type TileArea = {
    origin: TileCoordinates,
    size?: Vector2, // Default value {x: 1, y: 1}
    data?: string   // If not provided, the entire area is considered
    _loaded?: Uint8Array
}

export namespace TileArea {
    export function load(area: TileArea): TileArea {
        if (area.data) area._loaded = base64ToBytes(area.data)
        else area._loaded = new Uint8Array(area.size ? Math.ceil(area.size.x * area.size!.y / 8) : 1).fill(255)

        return area
    }

    export function save(area: TileArea): TileArea {
        if (area._loaded) {
            area.data = bytesToBase64(area._loaded)

            // TODO: Check if area is completely filled and set data to undefined if it is
            area._loaded = undefined
        }

        return area
    }

    function index(area: TileArea, tile: TileCoordinates): [number, number] {
        const off = Vector2.sub(tile, area.origin)

        // Assumes the input is valid and within bounds!

        const index = off.x + off.y * area.size!.x

        return [Math.floor(index / 8), index % 8]
    }

    export function set(area: TileArea, tile: TileCoordinates, value: boolean): TileArea {
        const [element, shift] = index(area, tile)

        if (value) area._loaded!![element] |= (1 << shift)
        else area._loaded!![element] &= 255 - (1 << shift)

        return area
    }

    export function add(area: TileArea, coords: TileCoordinates): TileArea {
        return set(area, coords, true)
    }

    export function remove(area: TileArea, coords: TileCoordinates): TileArea {
        return set(area, coords, false)
    }

    export function contains(area: TileArea, coords: TileCoordinates): boolean {
        const [element, shift] = index(area, coords)

        return ((area._loaded!![element] >> shift) & 1) != 0
    }

    function simplify(area: TileArea): TileArea {
        if (area.size && area.size.x == 1 && area.size.y == 1) {
            area.size = undefined
            area.data = undefined
        }

        return area
    }

    export function init(origin: TileCoordinates, size: Vector2 | undefined = undefined, filled: boolean = false): TileArea {
        return load(simplify({
                                 origin: origin,
                                 size: size,
                                 data: filled || (!filled && !size) ? undefined : bytesToBase64(new Uint8Array(size ? Math.ceil(size.x * size.y / 8) : 1).fill(255)),
                             }))
    }

    export function fromRect(rect: TileRectangle): TileArea {
        return init(TileRectangle.bl(rect), {x: Rectangle.width(rect), y: Rectangle.height(rect)}, true)
    }

    export function toRect(area: TileArea): TileRectangle {
        return TileRectangle.from(area.origin, TileCoordinates.move(area.origin, Vector2.add(area.size ? area.size : {x: 1, y: 1}, {x: -1, y: -1})))
    }

    export function transform(area: TileArea, transform: TileTransform): TileArea {

        return {
            origin: TileCoordinates.transform(area.origin, transform),
            size: area.size ? Vector2.abs(Vector2.snap(Vector2.transform(area.size, transform.matrix))) : undefined,
        }

        // TODO: Transform actual tiles!
    }
}