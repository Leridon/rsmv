import * as fs from 'fs'
import Jimp from "jimp"
import * as pako from "pako"
import {ChunkData, classicChunkSize, getMapsquareData, MapRect, mapsquareObjects, ParsemapOpts, parseMapsquare, rs2ChunkSize, TileGrid, TileProps} from "../3d/mapsquare"
import {EngineCache} from "../3d/modeltothree"
import {ScriptOutput} from "../scriptrunner"
import path from "path"
import {Vector2} from 'zykloplib/math/Vector2'
import {direction} from "../zykloplib/runescape/movement"
import center = direction.center
import east = direction.east
import south = direction.south
import west = direction.west
import north = direction.north
import southeast = direction.southeast
import southwest = direction.southwest
import northwest = direction.northwest
import northeast = direction.northeast
import {time} from "../zykloplib/util"
import {TileRectangle} from "../zykloplib/runescape/coordinates";
import tr = TileRectangle.tr;
import {classicModifyTileGrid} from "../3d/classicmap";

export async function parseMapsquares(engine: EngineCache, rect: MapRect, opts?: ParsemapOpts) {
    let chunkfloorpadding = (opts?.padfloor ? 20 : 0);//TODO same as max(blending kernel,max loc size), put this in a const somewhere
    let squareSize = (engine.classicData ? classicChunkSize : rs2ChunkSize);
    let chunkpadding = Math.ceil(chunkfloorpadding / squareSize);
    let grid = new TileGrid(engine, {
        x: rect.x * squareSize - chunkfloorpadding,
        z: rect.z * squareSize - chunkfloorpadding,
        xsize: rect.xsize * squareSize + chunkfloorpadding * 2,
        zsize: rect.zsize * squareSize + chunkfloorpadding * 2
    }, opts?.mask);
    let chunks: ChunkData[] = [];
    for (let z = -chunkpadding; z < rect.zsize + chunkpadding; z++) {
        for (let x = -chunkpadding; x < rect.xsize + chunkpadding; x++) {
            let chunk = await getMapsquareData(engine, rect.x + x, rect.z + z);
            if (!chunk) {
                continue;
            }
            grid.addMapsquare(chunk.tiles, chunk.nxttiles, chunk.tilerect, chunk.levelcount, !!opts?.collision);

            //only add the actual ones we need to the queue
            if (chunk.mapsquarex < rect.x || chunk.mapsquarex >= rect.x + rect.xsize) { continue; }
            if (chunk.mapsquarez < rect.z || chunk.mapsquarez >= rect.z + rect.zsize) { continue; }
            chunks.push(chunk);
        }
    }
    if (engine.classicData) {
        classicModifyTileGrid(grid);
    }
    grid.blendUnderlays();
    for (let chunk of chunks) {
        chunk.locs = await mapsquareObjects(engine, grid, chunk.rawlocs, chunk.tilerect.x, chunk.tilerect.z, !!opts?.collision);
    }

    return {grid, chunks};
}

function collisionOverLay(grid: TileGrid, floor: number): Jimp {
    let image = new Jimp(64, 64)

    for (let dz = 0; dz < 64; dz++) {
        for (let dx = 0; dx < 64; dx++) {

            let tile = grid.getTile(grid.xoffset + dx, grid.zoffset + dz, floor)

            if (!tile) {
                continue
            }

            let col = tile!.effectiveCollision!

            let center_blocked = col.walk[0] || col.sight[0]

            if (center_blocked) image.setPixelColor(Jimp.rgbaToInt(255, 0, 0, 255), dx, 64 - dz)
            else image.setPixelColor(0x00000000, dx, 64 - dz)
        }
    }

    return image
}

function simpleCollisionFile(grid: TileGrid, floor: number, square_size: number): Uint16Array {
    let file = new Uint16Array(square_size * square_size)

    for (let tile_y = 0; tile_y < square_size; tile_y++) {
        for (let tile_x = 0; tile_x < square_size; tile_x++) {

            let tile_i = tile_y * square_size + tile_x

            let tile = grid.getTile(grid.xoffset + tile_x, grid.zoffset + tile_y, floor)

            if (!tile) continue

            let col = tile!.effectiveCollision!

            let colint = 0

            // This is an approximation to cut file size in half.
            // Each tile has 9 properties (left/right/center x top/center/bottom) that can be [free, walk_blocked, sight_blocked],
            // which would result in 3 ^ 9 = 19683 things to encode.
            // To fit it in just one bite per tile, walk_blocked and sight_blocked are combined since we don't care about whether you can see over a tile.
            // We also remove the center property by encoding all other 8 as blocked if center is blocked.
            // This breaks tiles that can be stood on, but not left just as 1 by 1 cages.

            for (let i = 0; i < 9; i++) {
                let v = ((col.walk[i] || col.sight[i]) ? 1 : 0)
                colint += Math.pow(2, i) * v
            }

            file[tile_i] = colint
        }
    }

    return file
}

type MapCoordinate = Vector2 & { level: number }

function move(pos: MapCoordinate, off: Vector2) {
    return {
        x: pos.x + off.x,
        y: pos.y + off.y,
        level: pos.level,
    }
}

function blocked(tile: TileProps | undefined, direction: direction): boolean {
    return !!(tile) && !!(tile.effectiveCollision?.walk[direction] || tile.effectiveCollision?.sight[direction])
}

function getTile(data: TileGrid, pos: MapCoordinate): undefined | TileProps {
    return data.getTile(pos.x, pos.y, pos.level)
}

export function canMove(data: TileGrid, pos: MapCoordinate, d: direction): boolean {
    // To be honest, this function in its entirety is mostly a guess. Maybe it is completely broken

    // If the "out-edge" of a tile to the target is blocked, prevent moving
    const origin = getTile(data, pos)
    if (blocked(origin, d)) return false

    // If the center or the inverted edge of the target is blocked, prevent moving
    const target = getTile(data, move(pos, direction.toVector(d)))
    if (blocked(target, 0) || blocked(target, direction.invert(d))) return false

    // Check if diagonal movement is blocked by any orthogonal neighbours
    if (d >= 5) {
        // sideway blockings block diagonal movements too
        const diagonal_implication_table: [direction, direction][] = [
            [1, 2],  // top left
            [2, 3],  // top right
            [3, 4],  // bottom right
            [4, 1],   // bottom left
        ]

        let implication = diagonal_implication_table[d - 5]

        // Have to be able to move to both relevant orthogonal neighbour
        if (!(canMove(data, pos, implication[0]))) return false
        if (!(canMove(data, pos, implication[1]))) return false

        // Have to be able to move from both relevant orthogonal neighbours to the target tile
        if (!(canMove(data, move(pos, direction.toVector(implication[0])), implication[1]))) return false
        if (!(canMove(data, move(pos, direction.toVector(implication[1])), implication[0]))) return false
    }

    return true
}

function optimizedCollisionFile(grid: TileGrid, floor: number, start_x: number, start_y: number, square_size: number): Uint8Array {
    let file = new Uint8Array(square_size * square_size)

    for (let tile_y = 0; tile_y < square_size; tile_y++) {
        for (let tile_x = 0; tile_x < square_size; tile_x++) {
            let tile_i = tile_y * square_size + tile_x

            const pos: MapCoordinate = {
                x: start_x + tile_x,
                y: start_y + tile_y,
                level: floor,
            }

            // Encode movement ability in all 8 directions as a byte where lsb = left
            file[tile_i] = [1, 2, 4, 8, 16, 32, 64, 128].map((v, i) => (canMove(grid, pos, i + 1 as direction) ? 1 : 0) * v).reduce((a, b) => a + b, 0)
        }
    }

    return file
}

function optimizedCollisionFile2(grid: TileGrid, floor: number, start_x: number, start_y: number, square_size: number): Uint8Array {
    const file = new Uint8Array(square_size * square_size)

    file.fill(255)

    function flat(tile_x: number, tile_y: number): number {
        return tile_y * square_size + tile_x
    }

    function safe_flat(tile_x: number, tile_y: number): number | undefined {
        if (tile_x < 0 || tile_y < 0 || tile_x >= square_size || tile_y >= square_size) return undefined
        return flat(tile_x, tile_y)
    }

    function block(i: number | undefined, direction: direction) {
        if (i != undefined) file[i] &= 255 - [0, 1, 2, 4, 8, 16, 32, 64, 128][direction]
    }

    const block_map: { blocked_direction: direction, no_symmetry?: boolean, blocks: { from: direction, to: direction[] }[] }[] = [
        {
            blocked_direction: center, no_symmetry: true, blocks: [
                {from: west, to: [east, southeast, northeast]},
                {from: north, to: [south, southeast, southwest]},
                {from: east, to: [west, southwest, northwest]},
                {from: south, to: [north, northwest, northeast]},
                {from: northwest, to: [southeast]},
                {from: northeast, to: [southwest]},
                {from: southeast, to: [northwest]},
                {from: southwest, to: [northeast]},
            ],
        },
        {
            blocked_direction: west, blocks: [
                {from: center, to: [west, southwest, northwest]},
                {from: west, to: [northeast, southeast]},
            ],
        },
        {
            blocked_direction: north, blocks: [
                {from: center, to: [north, northeast, northwest]},
                {from: north, to: [southeast, southwest]},
            ],
        },
        {
            blocked_direction: east, blocks: [
                {from: center, to: [east, southeast, northeast]},
                {from: east, to: [northwest, southwest]},
            ],
        },
        {
            blocked_direction: south, blocks: [
                {from: center, to: [south, southeast, southwest]},
                {from: south, to: [northwest, northeast]},
            ],
        },
        //ordinal blocks prevent the direct diagonal movement in both directions
        {blocked_direction: northwest, blocks: [{from: center, to: [direction.northwest]}]},
        {blocked_direction: northeast, blocks: [{from: center, to: [direction.northeast]}]},
        {blocked_direction: southeast, blocks: [{from: center, to: [direction.southeast]}]},
        {blocked_direction: southwest, blocks: [{from: center, to: [direction.southwest]}]},
    ]

    block_map.sort((a, b) => a.blocked_direction - b.blocked_direction)

    for (let tile_y = -1; tile_y <= square_size; tile_y++) {
        for (let tile_x = -1; tile_x <= square_size; tile_x++) {
            const x = start_x + tile_x
            const y = start_y + tile_y

            const tile = grid.getTile(x, y, floor)

            if (!tile) continue

            block_map.forEach(entry => {
                if (blocked(tile, entry.blocked_direction)) {
                    entry.blocks.forEach(({from, to}) => {
                        const from_off = direction.toVector(from)
                        const from_i = safe_flat(tile_x + from_off.x, tile_y + from_off.y)

                        to.forEach(to => {
                            const to_off = direction.toVector(to)

                            block(from_i, to)

                            if (!entry.no_symmetry) {
                                const to_i = safe_flat(tile_x + from_off.x + to_off.x, tile_y + from_off.y + to_off.y)
                                block(to_i, direction.invert(to))
                            }
                        })
                    })
                }
            })
        }
    }

    return file
}

const chunk_meta = {
    chunks_per_file: 20,
    chunks_z: 200,
    chunks_x: 100,
}

type FileIndex = {
    file_x: number,
    file_z: number,
    floors: {
        floor: number,
        file_name: string,
    }[]
}

export function collision_file_index_full(directory: string): FileIndex[] {
    let file_index: FileIndex[] = []

    for (let file_z = 0; file_z < chunk_meta.chunks_z / chunk_meta.chunks_per_file; file_z++) {
        for (let file_x = 0; file_x < chunk_meta.chunks_x / chunk_meta.chunks_per_file; file_x++) {
            file_index.push({
                file_x: file_x,
                file_z: file_z,
                floors: [0, 1, 2, 3].map((floor) => {
                    return {
                        floor: floor,
                        file_name: `${directory}/collision-${file_x}-${file_z}-${floor}.bin`,
                    }
                }),
            })
        }
    }

    return file_index
}


export async function create_collision_files(output: ScriptOutput, cache: EngineCache, file_index: FileIndex[]) {
    for (let {file_x, file_z, floors} of file_index) {
        if (floors.every(({file_name}) => fs.existsSync(file_name))) {
            console.log(`All files for ${file_x}|${file_z} exist, skipping`)
            continue
        }


        // TODO: This breaks after the rebase! Parse multiple chunks.
        /*
            xsize: (chunk_meta.chunks_per_file + 1) + (file_x * chunk_meta.chunks_per_file < chunk_meta.chunks_x ? 1 : 0),
            zsize: (chunk_meta.chunks_per_file + 1) + (file_z * chunk_meta.chunks_per_file < chunk_meta.chunks_z ? 1 : 0),


         */

        let {grid} = await time(`parse-${file_x}-${file_z}`, async () => await parseMapsquares(cache,
            {
                x: Math.max(0, file_x * chunk_meta.chunks_per_file - 1),
                z: Math.max(0, file_z * chunk_meta.chunks_per_file - 1),
                xsize: (chunk_meta.chunks_per_file + 1) + (file_x * chunk_meta.chunks_per_file < chunk_meta.chunks_x ? 1 : 0),
                zsize: (chunk_meta.chunks_per_file + 1) + (file_z * chunk_meta.chunks_per_file < chunk_meta.chunks_z ? 1 : 0)
            }, {
                padfloor: true,
                invisibleLayers: true,
                collision: true,
                map2d: false,
                skybox: false,
            },
        ))

        if (!grid) {
            console.log("square is null, skipping")
            continue
        }

        for (let {floor, file_name} of floors) {
            if (fs.existsSync(file_name)) {
                console.log(`Skipping existing file ${file_name}`)
                continue
            }

            await time(`convert-${file_x}-${file_z}-${floor}`, () => {
                let file = optimizedCollisionFile2(grid, floor,
                    file_x * chunk_meta.chunks_per_file * 64,
                    file_z * chunk_meta.chunks_per_file * 64,
                    chunk_meta.chunks_per_file * 64,
                )

                file = pako.deflate(file)

                fs.mkdirSync(path.dirname(file_name), {recursive: true})

                fs.writeFileSync(file_name, file)
            })
        }
    }
}