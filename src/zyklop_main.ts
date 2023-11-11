import {parseMapsquare, TileGrid, TileProps} from "./3d/mapsquare";
import {EngineCache} from "./3d/modeltothree";
import {cacheSourceFromString} from "./cliparser";
import * as fs from 'fs';

import Jimp from "jimp"
import {direction, Vector2} from "./zyklop_lib";
import {CacheFileSource} from "./cache";
import path from "path";
import {number} from "cmd-ts";
import {cacheMajors} from "./constants";
import {parse} from "./opdecoder";
import * as zlib from "zlib";
import * as pako from "pako"
import {cluecoords} from "./scripts/cluecoords";

function collisionOverLay(grid: TileGrid, floor: number): Jimp {
    let image = new Jimp(64, 64)

    for (let dz = 0; dz < 64; dz++) {
        for (let dx = 0; dx < 64; dx++) {

            let tile = grid.getTile(grid.xoffset + dx, grid.zoffset + dz, floor);

            if (!tile) {
                continue
            }

            let col = tile!.effectiveCollision!;

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

            let tile = grid.getTile(grid.xoffset + tile_x, grid.zoffset + tile_y, floor);

            if (!tile) continue

            let col = tile!.effectiveCollision!;

            let colint = 0

            // This is an approximation to cut file size in half.
            // Each tile has 9 properties (left/right/center x top/center/bottom) that can be [free, walk_blocked, sight_blocked],
            // which would result in 3 ^ 9 = 19683 things to encode.
            // To fit it in just one bite per tile, walk_blocked and sight_blocked are combined since we don't care about whether you can see over a tile.
            // We also remove the center property by encoding all other 8 as blocked if center is blocked.
            // This breaks tiles that can be stood on, but not left just as 1 by 1 cages.

            for (let i = 0; i < 9; i++) {
                let v = ((col.walk[i] || col.sight[i]) ? 1 : 0);
                colint += Math.pow(2, i) * v;
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
        level: pos.level
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
    let origin = getTile(data, pos)
    if (blocked(origin, d)) return false

    // If the center or the inverted edge of the target is blocked, prevent moving
    let target = getTile(data, move(pos, direction.toVector(d)))
    if (blocked(target, 0) || blocked(target, direction.invert(d))) return false

    // Check if diagonal movement is blocked by any orthogonal neighbours
    {
        // sideway blockings block diagonal movements too
        let diagonal_implication_table: [direction, direction][] = [
            [1, 2],  // top left
            [2, 3],  // top right
            [3, 4],  // bottom right
            [4, 1]   // bottom left
        ]

        if (d >= 5) {
            let implication = diagonal_implication_table[d - 5]

            // Have to be able to move to both relevant orthogonal neighbour
            if (!(canMove(data, pos, implication[0]))) return false
            if (!(canMove(data, pos, implication[1]))) return false

            // Have to be able to move from both relevant orthogonal neighbours to the target tile
            if (!(canMove(data, move(pos, direction.toVector(implication[0])), implication[1]))) return false
            if (!(canMove(data, move(pos, direction.toVector(implication[1])), implication[0]))) return false
        }
    }

    return true
}

function optimizedCollisionFile(grid: TileGrid, floor: number, start_x: number, start_y: number, square_size: number): Uint8Array {
    let file = new Uint8Array(square_size * square_size)

    for (let tile_y = 0; tile_y < square_size; tile_y++) {
        for (let tile_x = 0; tile_x < square_size; tile_x++) {
            let tile_i = tile_y * square_size + tile_x

            let pos: MapCoordinate = {
                x: start_x + tile_x,
                y: start_y + tile_y,
                level: floor
            }

            // Encode movement ability in all 8 directions as a byte where lsb = left
            file[tile_i] = [1, 2, 4, 8, 16, 32, 64, 128].map((v, i) => (canMove(grid, pos, i + 1 as direction) ? 1 : 0) * v).reduce((a, b) => a + b, 0)
        }
    }

    return file
}

async function time<T>(name: string, f: () => T): Promise<T> {

    let timeStart = new Date().getTime();

    process.stdout.write(`Starting task ${name}: `);
    let res = await f()
    const ms = (new Date().getTime() - timeStart) + 'ms';
    process.stdout.write(`${ms}ms\n`)

    return res
}

async function coords(filesource: CacheFileSource) {
    type Coord = { x: number, y: number, level: number }

    let enums: number[] = [];
    let itemindex = await filesource.getCacheIndex(cacheMajors.items);
    for (let index of itemindex) {
        let files = await filesource.getFileArchive(index);

        for (let file of files) {
            try {
                let item = parse.item.read(file.buffer, filesource);
                let prop = item.extra?.find(q => q.prop == 235);
                if (prop) {
                    enums.push(prop.intvalue!);
                }
            } catch (e) {
                // Ignore
            }
        }
    }

    let allcoords: Coord[][] = [];

    for (let enumid of enums) {
        let file = await filesource.getFileById(cacheMajors.enums, enumid);
        let parsed = parse.enums.read(file, filesource);
        let coords: Coord[] = parsed.intArrayValue2!.values.map(v => ({
            x: (v[1] >> 14) & 16383,
            y: (v[1] >> 0) & 16383,
            level: (v[1] >> 28) & 3
        }));
        if (enumid == 13504) {
            debugger;
        }
        allcoords.push(coords);
    }
    let idmapping = [
        4,//ardougne
        3,//varrock
        11,//isafdar and lletya
        2,//falador
        10,//piscatoris
        23,//menaphos
        6,//haunted woods
        8,//north of nardah
        22,//deep wildy
        21,//wilderness volcano
        7,//khazari jungle
        5,//jatiszo and nezzy
        16,//keldagrim
        20,//zanaris
        15,//fremmy slayer
        17,//lumby swamp caves
        14,//dorgesh-kaan
        12,//brimhaven dungeon
        18,//taverley dungeon
        9,//mos'le harmless
        13,//chaos tunnels
        0,//main world compass clue
        24,//priff
        25,//darkemeyer
        27,//heart of geilinor
        26,//torle islands
        50,//eastern lands compass
    ];

    const print_id = 0

    debugger

    console.log(allcoords)

    console.log(allcoords[idmapping.indexOf(print_id)]);

    /*
    let indexedcoords = allcoords.flatMap((q, i) => {
        let clueid = idmapping[i];
        return q.map(w => ({...w, clueid}));
    })    */

    filesource.close();
    console.log("done");
}

const chunk_meta = {
    chunks_per_file: 20,
    chunks_z: 200,
    chunks_x: 100
}

type FileIndex = {
    file_x: number,
    file_z: number,
    floors: {
        floor: number,
        file_name: string,
    }[]
}

function collision_file_index_full(): FileIndex[] {
    let file_index: FileIndex[] = []

    for (let file_z = 0; file_z < chunk_meta.chunks_z / chunk_meta.chunks_per_file; file_z++) {
        for (let file_x = 0; file_x < chunk_meta.chunks_x / chunk_meta.chunks_per_file; file_x++) {
            file_index.push({
                file_x: file_x,
                file_z: file_z,
                floors: [0, 1, 2, 3].map((floor) => {
                    return {
                        floor: floor,
                        file_name: `../data/collision-${file_x}-${file_z}-${floor}.bin`
                    }
                })
            })
        }
    }

    return file_index
}

async function create_collision_files(cache: EngineCache, file_index: FileIndex[]) {
    for (let {file_x, file_z, floors} of file_index) {
        if (floors.every(({file_name}) => fs.existsSync(file_name))) {
            console.log(`All files for ${file_x}|${file_z} exist, skipping`)
            continue
        }

        let square = await time(`parse-${file_x}-${file_z}`, async () => await parseMapsquare(cache, {
                x: Math.max(0, file_x * chunk_meta.chunks_per_file - 1),
                z: Math.max(0, file_z * chunk_meta.chunks_per_file - 1),
                xsize: (chunk_meta.chunks_per_file + 1) + (file_x * chunk_meta.chunks_per_file < chunk_meta.chunks_x ? 1 : 0),
                zsize: (chunk_meta.chunks_per_file + 1) + (file_z * chunk_meta.chunks_per_file < chunk_meta.chunks_z ? 1 : 0)
            }, {
                padfloor: false,
                invisibleLayers: true,
                collision: true,
                map2d: false,
                skybox: false
            }
        ))

        if (!square) {
            console.log("square is null, skipping")
            continue
        }

        for (let {floor, file_name} of floors) {
            if (fs.existsSync(file_name)) {
                console.log(`Skipping existing file ${file_name}`)
                continue
            }

            await time(`convert-${file_x}-${file_z}-${floor}`, () => {
                let file = optimizedCollisionFile(square.grid, floor,
                    file_x * chunk_meta.chunks_per_file * 64,
                    file_z * chunk_meta.chunks_per_file * 64,
                    chunk_meta.chunks_per_file * 64)

                file = pako.deflate(file)

                fs.writeFileSync(`../data/collision-${file_x}-${file_z}-${floor}.bin`, file)
            })

        }
    }
}

export async function main() {
    console.log("Entering Zyklop main")

    let filesource = await (cacheSourceFromString("live"))({})
    let cache = await EngineCache.create(filesource)

    //await coords(cache)

    await create_collision_files(cache, collision_file_index_full())

    return

    //await coords(cache)
    //return


    /*
        console.log((await parseMapsquare(cache, {x: 56, z: 54, xsize: 1, zsize: 1}, {
                padfloor: false,
                invisibleLayers: true,
                collision: true,
                map2d: false,
                skybox: false
            }
        )).grid.getTile(3597, 3495, 0)?.effectiveCollision?.walk);

        return*/

    /*
        for (let z = 0; z < 200; z++) {
            for (let x = 0; x < 100; x++) {
                let square = await parseMapsquare(cache, {x: x, z: z, xsize: 1, zsize: 1}, {
                        padfloor: false,
                        invisibleLayers: true,
                        collision: true,
                        map2d: true,
                        skybox: false
                    }
                )

                for(let dz = 0; dz < 8; dz++){

                }

                if (!square) continue

                let file = simpleCollisionFile(square.grid)

                fs.writeFileSync(`../data/collision-${x}-${z}.bin`, file)

                for (let floor = 0; floor < 4; floor++) {
                    let img = collisionOverLay(square.grid, floor)

                    img.write(`../data/overlay-${x}-${z}-${floor}.png`)
                }

                console.log(`${x}-${z}`)
            }
        }*/

    /*
    fs.writeFileSync('test0.svg', await svgfloor(cache, square.grid, square.chunks.flatMap((c) => c.locs), {x: chunk.x * 64, z: chunk.z * 64, xsize: 64, zsize: 64}, 0, 64, false))
    fs.writeFileSync('test1.svg', await svgfloor(cache, square.grid, square.chunks.flatMap((c) => c.locs), {x: chunk.x * 64, z: chunk.z * 64, xsize: 64, zsize: 64}, 1, 64, false))
    fs.writeFileSync('test2.svg', await svgfloor(cache, square.grid, square.chunks.flatMap((c) => c.locs), {x: chunk.x * 64, z: chunk.z * 64, xsize: 64, zsize: 64}, 2, 64, false))
    fs.writeFileSync('test3.svg', await svgfloor(cache, square.grid, square.chunks.flatMap((c) => c.locs), {x: chunk.x * 64, z: chunk.z * 64, xsize: 64, zsize: 64}, 3, 64, false))*/
}