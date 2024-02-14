import {cliArguments, filerange, filesource, ReadCacheSource} from "./cliparser"
import * as cmdts from "cmd-ts"
import {command, flag, option} from "cmd-ts"
import {cacheFileDecodeModes, cacheFileJsonModes} from "./scripts/filetypes"
import {CLIScriptFS, CLIScriptOutput} from "./scriptrunner"
import {defaultTestDecodeOpts, testDecode, testDecodeHistoric} from "./scripts/testdecode"
import {extractCacheFiles, writeCacheFiles} from "./scripts/extractfiles"
import {indexOverview} from "./scripts/indexoverview"
import {diffCaches} from "./scripts/cachediff"
import {quickChatLookup} from "./scripts/quickchatlookup"
import {scrapePlayerAvatars} from "./scripts/scrapeavatars"
import {fileHistory} from "./scripts/filehistory"
import {openrs2Ids} from "./scripts/openrs2ids"
import {cluecoords} from "./scripts/cluecoords"
import {EngineCache} from "./3d/modeltothree"
import {getMapsquareData, MapRect, resolveMorphedObject} from "./3d/mapsquare"
import {collision_file_index_full, create_collision_files} from "./blocking/blocking"
import {mapsquare_locations} from "../generated/mapsquare_locations"
import fs from "fs"
import {getActions, LocWithUsages, transportation_parsers, transportation_rectangle_blacklists} from "./transportation/parsers"
import {floor_t, TileRectangle} from "./zykloplib/runescape/coordinates"
import {Rectangle} from "./zykloplib/math"
import {time} from "./zykloplib/util"
import {act} from "react-dom/test-utils"

const testdecode = command({
                               name: "testdecode",
                               args: {
                                   ...filesource,
                                   ...filerange,
                                   save: option({long: "save", short: "s", type: cmdts.string, defaultValue: () => "cache-errors"}),
                                   mode: option({long: "mode", short: "m"}),
                               },
                               handler: async (args) => {
                                   let errdir      = new CLIScriptFS(args.save)
                                   let olderrfiles = await errdir.readDir(".")
                                   if (olderrfiles.find(q => !q.match(/^(err|pass|fail)-/))) {
                                       throw new Error("file not starting with 'err' in error dir")
                                   }
                                   await Promise.all(olderrfiles.map(q => errdir.unlink(q)))

                                   let output = new CLIScriptOutput()
                                   let source = await args.source()
                                   let mode   = cacheFileJsonModes[args.mode]
                                   if (!mode) { throw new Error(`mode ${args.mode} not found, possible modes: ${Object.keys(cacheFileJsonModes).join(", ")}`) }
                                   let opts     = defaultTestDecodeOpts()
                                   opts.outmode = "hextext"
                                   opts.maxerrs = 500
                                   await output.run(testDecode, errdir, source, mode, args.files, opts)
                               },
                           })

const historicdecode = command({
                                   name: "historicdecode",
                                   args: {
                                       ...filesource,
                                       skipcurrent: flag({long: "skipcurrent", short: "p", description: "skip current cache"}),
                                       before: option({long: "before", short: "t", defaultValue: () => ""}),
                                       maxchecks: option({long: "maxchecks", short: "n", type: cmdts.number, defaultValue: () => 0}),
                                   },
                                   async handler(args) {
                                       let startcache = await args.source()
                                       let output     = new CLIScriptOutput()
                                       let fs         = new CLIScriptFS("./cache-histerr")
                                       await output.run(testDecodeHistoric, fs, startcache, args.before, args.maxchecks)
                                   },
                               })

const extract = command({
                            name: "extract",
                            args: {
                                ...filesource,
                                ...filerange,
                                save: option({long: "save", short: "s", type: cmdts.string, defaultValue: () => "extract"}),
                                mode: option({long: "mode", short: "m", type: cmdts.string, defaultValue: () => "bin"}),
                                edit: flag({long: "edit", short: "e"}),
                                skipread: flag({long: "noread", short: "n"}),
                                fixhash: flag({long: "fixhash", short: "h"}),
                                batched: flag({long: "batched", short: "b"}),
                                batchlimit: option({long: "batchsize", type: cmdts.number, defaultValue: () => -1}),
                                keepbuffers: flag({long: "keepbuffers"}),
                            },
                            async handler(args) {

                                let orig_save = args.save || "extract"

                                if (args.mode == "*") {
                                    for (let key in cacheFileDecodeModes) {
                                        args.mode = key
                                        args.save = orig_save + "\\" + key
                                        try {
                                            let source = await args.source({writable: args.edit})
                                            let outdir = new CLIScriptFS(args.save)
                                            let output = new CLIScriptOutput()

                                            console.log(key)
                                            await output.run(extractCacheFiles, outdir, source, args)

                                            source.close()
                                        } catch (e) {
                                            console.log(e)
                                        }
                                    }
                                } else {
                                    let source = await args.source({writable: args.edit})
                                    let outdir = new CLIScriptFS(args.save)
                                    let output = new CLIScriptOutput()
                                    await output.run(extractCacheFiles, outdir, source, args)

                                    source.close()
                                }
                            },
                        })


const filehist = command({
                             name: "filehist",
                             args: {
                                 id: option({long: "id", short: "i", type: cmdts.string}),
                                 save: option({long: "save", short: "s", type: cmdts.string, defaultValue: () => "extract"}),
                                 mode: option({long: "mode", short: "m", type: cmdts.string, defaultValue: () => "bin"}),
                             },
                             async handler(args) {
                                 let outdir = new CLIScriptFS(args.save)
                                 let output = new CLIScriptOutput()
                                 if (!cacheFileDecodeModes[args.mode]) { throw new Error("unkown mode") }

                                 let id = args.id.split(".").map(q => +q)
                                 if (id.length == 0 || id.some(q => isNaN(q))) { throw new Error("invalid id") }
                                 await output.run(fileHistory, outdir, args.mode as any, id, null, null)
                             },
                         })

const edit = command({
                         name: "edit",
                         args: {
                             ...filesource,
                             diffdir: option({long: "diffdir", short: "d", type: cmdts.string}),
                         },
                         async handler(args) {
                             let diffdir = new CLIScriptFS(args.diffdir)
                             let output  = new CLIScriptOutput()
                             let source  = await args.source({writable: true})
                             await output.run(writeCacheFiles, source, diffdir)
                             source.close()
                         },
                     })

const indexoverview = command({
                                  name: "run",
                                  args: {
                                      ...filesource,
                                  },
                                  handler: async (args) => {
                                      let source = await args.source()
                                      let output = new CLIScriptOutput()
                                      let outdir = new CLIScriptFS(".")
                                      await output.run(indexOverview, outdir, source)
                                  },
                              })

const diff = command({
                         name: "run",
                         args: {
                             ...filerange,
                             a: option({long: "cache1", short: "a", type: ReadCacheSource}),
                             b: option({long: "cache2", short: "b", type: ReadCacheSource}),
                             out: option({long: "out", short: "s", type: cmdts.string}),
                         },
                         handler: async (args) => {
                             let sourcea = await args.a()
                             let sourceb = await args.b()

                             let outdir = new CLIScriptFS(args.out)
                             let output = new CLIScriptOutput()
                             await output.run(diffCaches, outdir, sourcea, sourceb, args.files)

                             sourcea.close()
                             sourceb.close()
                         },
                     })

const quickchat = command({
                              name: "run",
                              args: {
                                  ...filesource,
                              },
                              handler: async (args) => {
                                  let output = new CLIScriptOutput()
                                  let outdir = new CLIScriptFS(".")
                                  let source = await args.source()
                                  output.run(quickChatLookup, outdir, source)
                                  source.close()
                              },
                          })

const scrapeavatars = command({
                                  name: "run",
                                  args: {
                                      ...filesource,
                                      save: option({long: "save", short: "s"}),
                                      skip: option({long: "skip", short: "i", type: cmdts.number, defaultValue: () => 0}),
                                      max: option({long: "max", short: "m", type: cmdts.number, defaultValue: () => 500}),
                                      json: flag({long: "json", short: "j"}),
                                  },
                                  handler: async (args) => {
                                      let outdir = new CLIScriptFS(args.save)
                                      let output = new CLIScriptOutput()
                                      let source = (args.json ? await args.source() : null)
                                      await output.run(scrapePlayerAvatars, outdir, source, args.skip, args.max, args.json)
                                  },
                              })

const openrs2ids = command({
                               name: "openrs2ids",
                               args: {
                                   date: option({long: "year", short: "d", defaultValue: () => ""}),
                                   near: option({long: "near", short: "n", defaultValue: () => ""}),
                                   full: flag({long: "full", short: "f"}),
                               },
                               async handler(args) {
                                   let output = new CLIScriptOutput()
                                   await output.run(openrs2Ids, args.date, args.near, args.full)
                               },
                           })

const collisions = command({
                               name: "collisions",
                               args: {
                                   ...filesource,
                                   save: option({long: "save", short: "s", type: cmdts.string, defaultValue: () => "collisions"}),
                               },
                               async handler(args) {
                                   let filesource = await args.source()
                                   let cache      = await EngineCache.create(filesource)

                                   let output = new CLIScriptOutput()

                                   await output.run(create_collision_files, cache, collision_file_index_full(args.save))
                               },
                           })

async function iterate_chunks(rect: MapRect | null = null, f: (x: number, y: number) => Promise<void> | void): Promise<void> {
    if (!rect) rect = {
        x: 0, z: 0, xsize: 100, zsize: 200,
    }

    for (let x = 0; x < rect.xsize; x++) {
        for (let y = 0; y < rect.zsize; y++) {
            await f(rect.x + x, rect?.z + y)
        }
    }
}

const locs = command({
                         name: "locs",
                         args: {
                             ...filesource,
                         },
                         async handler(args) {
                             let filesource = await args.source()
                             let cache      = await EngineCache.create(filesource)

                             let all: Map<number, LocWithUsages> = new Map()

                             async function uses(tile_rect: MapRect, loc: mapsquare_locations["locations"][number]): Promise<void> {
                                 let resolved = (await resolveMorphedObject(cache, loc.id)).morphedloc

                                 if (!resolved.name) return
                                 if (!resolved.actions_0) return

                                 const uses: LocWithUsages["uses"] = loc.uses.map(use => {
                                     let [width, height] = use.rotation % 2 == 0
                                         ? [resolved.width ?? 1, resolved.length ?? 1]
                                         : [resolved.length ?? 1, resolved.width ?? 1]


                                     return ({
                                         ...use,
                                         box: TileRectangle.lift(
                                             Rectangle.from(
                                                 {x: tile_rect.x + use.x, y: tile_rect.z + use.y},
                                                 {x: tile_rect.x + use.x + width - 1, y: tile_rect.z + use.y + height - 1},
                                             ),
                                             use.plane as floor_t,
                                         ),
                                     })
                                 })

                                 const el = all.get(loc.id)

                                 if (el) el.uses.push(...uses)
                                 else all.set(loc.id, {id: loc.id, uses: uses, location: resolved})
                             }

                             let area: MapRect | null = null // {x: 20, z: 20, xsize: 30, zsize: 30}

                             await time("Collecting Locs", async () => {
                                 await iterate_chunks(area, async (x, y) => {
                                     const data = await getMapsquareData(cache, x, y)

                                     if (data) data.rawlocs.forEach(loc => uses(data.tilerect, loc))
                                 })
                             })

                             let out = JSON.stringify(Object.fromEntries(Array.from(all.keys()).map(k => [k, all.get(k)])), null, 4)

                             fs.writeFileSync("locs.json", out)
                         },
                     })

const extract_shortcuts = command(
    {
        name: "shortcuts",
        args: {},
        async handler(args) {

            let data: Record<number, LocWithUsages> = JSON.parse(fs.readFileSync("locs.json", "utf-8"))

            await time("Shortcuts", () => {
                let shortcuts = transportation_parsers
                    .flatMap(p => {
                        if (!p.instance) return []

                        let vars = p.variants

                        if (!vars) {
                            vars = p.for ? [{for: p.for!!}] : []
                        }

                        return vars.flatMap(v => {
                            return v.for.flatMap(loc_id => {
                                let loc: LocWithUsages = data[loc_id]

                                if (!loc) {
                                    console.error(`Parser ${p.name} failed references non-existing id ${loc_id}!`)
                                    return []
                                }

                                const instance = p.instance!!(loc.location, v.extra)

                                let results = loc.uses
                                                 .filter(use =>
                                                             !transportation_rectangle_blacklists.some(blacklist => Rectangle.contains(blacklist, use.box.topleft)),
                                                 )
                                                 .flatMap(use => {
                                                     try {
                                                         let result = instance(loc.location, use)

                                                         if (!Array.isArray(result)) result = [result]

                                                         return result
                                                     } catch (e) {
                                                         console.error(`Parser ${p.name} failed!`)
                                                         console.error(e)
                                                         return []
                                                     }
                                                 })

                                results.forEach(s => s.source_loc = loc_id)

                                console.log(`Loc ${loc_id}: Extracted ${results.length} (by parser '${p.name}')`)

                                return results
                            })
                        })
                    })


                console.log(`Extracted a total of ${shortcuts.length} shortcuts!`)

                fs.writeFileSync("shortcuts.json", JSON.stringify(shortcuts, (key, value) => {
                    if (key.startsWith("_")) return undefined

                    return value
                }, 2))
            })
        },
    })

const leridon = command({
                            name: "leridon",
                            args: {
                                ...filesource,
                            },
                            async handler(args) {

                                type filter_t = {
                                    names?: string[],
                                    option?: string,
                                    area?: TileRectangle,
                                    object_id?: number,
                                    without_parser?: boolean
                                }

                                let filter: filter_t = {
                                    //names: ["tree"],
                                    //option: "Chop down",
                                    without_parser: true,
                                }

                                let data: Record<number, LocWithUsages> = JSON.parse(fs.readFileSync("locs.json", "utf-8"))

                                let filtered = Object.values(data).filter((loc) => {
                                    if (filter.names && !filter.names.some(n => loc.location.name!.toLowerCase().includes(n.toLowerCase()))) return false
                                    if (filter.object_id && loc.id != filter.object_id) return false
                                    if (filter.without_parser && transportation_parsers.some(p => {
                                        return (p.variants && p.variants.some(v => v.for.includes(loc.id))) || (p.for && p.for.includes(loc.id))
                                    })) return false

                                    const actions = getActions(loc.location)

                                    if (actions.length == 0) return false

                                    if (filter.option && !actions.some(a => a?.name.toLowerCase().includes(filter.option!.toLowerCase()))) return false

                                    loc.uses = loc.uses.filter(use => {
                                        return !(filter.area && (!Rectangle.overlaps(filter.area, use.box) || use.plane != filter.area?.level))
                                            && !transportation_rectangle_blacklists.some(blacklist => Rectangle.contains(blacklist, use.box.topleft))
                                    })

                                    return loc.uses.length > 0
                                }).sort((a, b) => {
                                    return b.uses.length - a.uses.length
                                })

                                //console.log(JSON.stringify(filtered.map(loc => loc.id)))
                                console.log(`${filtered.length} loc types fit the filter.`)

                                fs.writeFileSync("results.json", JSON.stringify(filtered.slice(0, 30), null, 2))
                            },
                        })

let subcommands = cmdts.subcommands({
                                        name: "cache tools cli",
                                        cmds: {
                                            collisions,
                                            extract,
                                            indexoverview,
                                            testdecode,
                                            diff,
                                            quickchat,
                                            scrapeavatars,
                                            edit,
                                            historicdecode,
                                            openrs2ids,
                                            filehist,
                                            cluecoords,
                                            leridon,
                                            locs,
                                            shortcuts: extract_shortcuts,
                                        },
                                    })

cmdts.run(subcommands, cliArguments())