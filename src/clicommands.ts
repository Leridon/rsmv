import {filerange, ReadCacheSource} from "./cliparser";
import * as cmdts from "cmd-ts";
import {command, flag, option} from "cmd-ts";
import {cacheFileDecodeModes, cacheFileJsonModes} from "./scripts/filetypes";
import {CLIScriptFS, CLIScriptOutput, ScriptFS, ScriptOutput} from "./scriptrunner";
import {defaultTestDecodeOpts, testDecode, testDecodeHistoric} from "./scripts/testdecode";
import {extractCacheFiles, writeCacheFiles} from "./scripts/extractfiles";
import {indexOverview} from "./scripts/indexoverview";
import {diffCaches} from "./scripts/cachediff";
import {quickChatLookup} from "./scripts/quickchatlookup";
import {scrapePlayerAvatars} from "./scripts/scrapeavatars";
import {fileHistory} from "./scripts/filehistory";
import {openrs2Ids} from "./scripts/openrs2ids";
import {extractCluecoords, extractCluecoords2} from "./scripts/cluecoords";
import {getSequenceGroups} from "./scripts/groupskeletons";
import {CacheFileSource} from "./cache";
import {EngineCache} from "./3d/modeltothree";
import {collision_file_index_full, create_collision_files} from "./blocking/blocking";
import {MapRect, parseMapsquare, WorldLocation} from "./3d/mapsquare";
import {floor_t, TileRectangle} from "./zykloplib/runescape/coordinates";
import {Rectangle} from "./zykloplib/math";
import {time} from "./zykloplib/util";
import fs from "fs";
import {transportation_parsers, transportation_rectangle_blacklists} from "./transportation/parsers";
import {parsers2} from "./transportation/parsers2";
import {LocUtil} from "./transportation/util/LocUtil";
import LocWithUsages = LocUtil.LocWithUsages;
import getActions = LocUtil.getActions;


export type CliApiContext = {
    getFs(name: string): ScriptFS,
    getConsole(): ScriptOutput,
    getDefaultCache?(): CacheFileSource
}

export function cliFsOutputType(ctx: CliApiContext, fsname: string): cmdts.Type<string, ScriptFS> {
    return {
        async from(str) { return new CLIScriptFS(str); },
        defaultValue() { return ctx.getFs(fsname) },
        description: `Where to save files (${fsname})`
    };
}


export function cliApi(ctx: CliApiContext) {
    const filesource = {
        source: cmdts.option({
            long: "source",
            short: "o",
            type: ReadCacheSource,
            defaultValue: ctx.getDefaultCache ? () => async () => ctx.getDefaultCache!() : undefined
        })
    };

    function saveArg(name: string) {
        return {
            save: option({
                long: "save",
                short: "s",
                type: cliFsOutputType(ctx, name)
            })
        } as const;
    }

    const testdecode = command({
        name: "testdecode",
        args: {
            ...filesource,
            ...filerange,
            ...saveArg("save"),
            mode: option({long: "mode", short: "m", description: `A json decode mode ${Object.keys(cacheFileJsonModes).join(", ")}`})
        },
        handler: async (args) => {
            let errdir = args.save;
            let olderrfiles = await errdir.readDir(".");
            if (olderrfiles.find(q => !q.name.match(/^(err|pass|fail)-/))) {
                throw new Error("file not starting with 'err' in error dir");
            }
            await Promise.all(olderrfiles.map(q => errdir.unlink(q.name)));

            let output = ctx.getConsole();
            let source = await args.source();
            let mode = cacheFileJsonModes[args.mode];
            if (!mode) { throw new Error(`mode ${args.mode} not found, possible modes: ${Object.keys(cacheFileJsonModes).join(", ")}`) }
            let opts = defaultTestDecodeOpts();
            opts.outmode = "hextext";
            opts.maxerrs = 500;
            await output.run(testDecode, errdir, source, mode, args.files, opts);
        }
    });

	const extract = command({
		name: "extract",
		args: {
			...filesource,
			...filerange,
			...saveArg("extract"),
			mode: option({ long: "mode", short: "m", type: cmdts.string, defaultValue: () => "bin", description: `A decode mode ${Object.keys(cacheFileDecodeModes).join(", ")}` }),
			edit: flag({ long: "edit", short: "e" }),
			skipread: flag({ long: "noread", short: "n" }),
			fixhash: flag({ long: "fixhash", short: "h" }),
			batched: flag({ long: "batched", short: "b" }),
			batchlimit: option({ long: "batchsize", type: cmdts.number, defaultValue: () => -1 }),
			keepbuffers: flag({ long: "keepbuffers" }),
			relativecs2comps: flag({ long: "relativecs2comps" })
		},
		async handler(args) {
			let output = ctx.getConsole();
			let source = await args.source({ writable: args.edit });
			let decoderflags: Record<string, string> = {};
			//decoder-specific flags, might want to make them into a value instead of a flag at some point
			if (args.keepbuffers) { decoderflags.keepbuffers = "true"; }
			if (args.relativecs2comps) { decoderflags.relativecs2comps = "true"; }
			await output.run(extractCacheFiles, args.save, source, args, decoderflags);
		}
	});
    const cluecoords = command({
        name: "download",
        args: {
            ...filesource,
            ...saveArg("extract")
        },
        handler: async (args) => {
            let output = ctx.getConsole();
            await output.run(extractCluecoords, args.save, await args.source());
        }
    });

    const cluecoords2 = command({
        name: "download2",
        args: {
            ...filesource,
            ...saveArg("extract")
        },
        handler: async (args) => {
            let output = ctx.getConsole();
            await output.run(extractCluecoords2, args.save, await args.source());
        }
    });

    const historicdecode = command({
        name: "historicdecode",
        args: {
            ...filesource,
            ...saveArg("cache-histerr"),
            skipcurrent: flag({long: "skipcurrent", short: "p", description: "skip current cache"}),
            before: option({long: "before", short: "t", defaultValue: () => ""}),
            maxchecks: option({long: "maxchecks", short: "n", type: cmdts.number, defaultValue: () => 0})
        },
        async handler(args) {
            let startcache = await args.source();
            let output = ctx.getConsole();
            await output.run(testDecodeHistoric, args.save, startcache, args.before, args.maxchecks);
        }
    })

    const extract = command({
        name: "extract",
        args: {
            ...filesource,
            ...filerange,
            ...saveArg("extract"),
            mode: option({long: "mode", short: "m", type: cmdts.string, defaultValue: () => "bin", description: `A decode mode ${Object.keys(cacheFileDecodeModes).join(", ")}`}),
            edit: flag({long: "edit", short: "e"}),
            skipread: flag({long: "noread", short: "n"}),
            fixhash: flag({long: "fixhash", short: "h"}),
            batched: flag({long: "batched", short: "b"}),
            batchlimit: option({long: "batchsize", type: cmdts.number, defaultValue: () => -1}),
            keepbuffers: flag({long: "keepbuffers"})
        },
        async handler(args) {
            let output = ctx.getConsole();
            let source = await args.source({writable: args.edit});
            await output.run(extractCacheFiles, args.save, source, args);
        }
    });


    const filehist = command({
        name: "filehist",
        args: {
            ...saveArg("extract"),
            id: option({long: "id", short: "i", type: cmdts.string}),
            mode: option({long: "mode", short: "m", type: cmdts.string, defaultValue: () => "bin", description: `A decode mode ${Object.keys(cacheFileDecodeModes).join(", ")}`})
        },
        async handler(args) {
            let output = ctx.getConsole();
            if (!cacheFileDecodeModes[args.mode]) { throw new Error("unkown mode"); }

            let id = args.id.split(".").map(q => +q);
            if (id.length == 0 || id.some(q => isNaN(q))) { throw new Error("invalid id"); }
            await output.run(fileHistory, args.save, args.mode as any, id, null, null);
        }
    });

    const edit = command({
        name: "edit",
        args: {
            ...filesource,
            ...saveArg("extract"),
        },
        async handler(args) {
            let output = ctx.getConsole();
            let source = await args.source({writable: true});
            await output.run(writeCacheFiles, source, args.save);
        }
    })

    const indexoverview = command({
        name: "run",
        args: {
            ...filesource,
            ...saveArg("save")
        },
        handler: async (args) => {
            let source = await args.source();
            let output = ctx.getConsole();
            await output.run(indexOverview, args.save, source);
        }
    });

    const diff = command({
        name: "run",
        args: {
            ...filerange,
            ...saveArg("out"),
            a: option({long: "cache1", short: "a", type: ReadCacheSource}),
            b: option({long: "cache2", short: "b", type: ReadCacheSource})
        },
        handler: async (args) => {
            let sourcea = await args.a();
            let sourceb = await args.b();

            let output = ctx.getConsole();
            await output.run(diffCaches, args.save, sourcea, sourceb, args.files);

            sourcea.close();
            sourceb.close();
        }
    });

    const quickchat = command({
        name: "run",
        args: {
            ...filesource,
            ...saveArg("extract")
        },
        handler: async (args) => {
            let output = ctx.getConsole();
            let source = await args.source();
            output.run(quickChatLookup, args.save, source);
        }
    });

    const scrapeavatars = command({
        name: "run",
        args: {
            ...filesource,
            ...saveArg("extract"),
            skip: option({long: "skip", short: "i", type: cmdts.number, defaultValue: () => 0}),
            max: option({long: "max", short: "m", type: cmdts.number, defaultValue: () => 500}),
            json: flag({long: "json", short: "j"})
        },
        handler: async (args) => {
            let output = ctx.getConsole();
            let source = (args.json ? await args.source() : null);
            await output.run(scrapePlayerAvatars, args.save, source, args.skip, args.max, args.json);
        }
    });

    const openrs2ids = command({
        name: "openrs2ids",
        args: {
            date: option({long: "year", short: "d", defaultValue: () => ""}),
            near: option({long: "near", short: "n", defaultValue: () => ""}),
            full: flag({long: "full", short: "f"})
        },
        async handler(args) {
            let output = ctx.getConsole();
            await output.run(openrs2Ids, args.date, args.near, args.full);
        }
    });

    const sequencegroups = command({
        name: "sequencegroups",
        args: {
            ...filesource,
            ...saveArg("extract")
        },
        async handler(args) {
            let output = ctx.getConsole();
            let source = await args.source();
            await output.run(getSequenceGroups, args.save, source);
        }
    });


    const collisions = command({
        name: "collisions",
        args: {
            ...filesource,
            save: option({long: "save", short: "s", type: cmdts.string, defaultValue: () => "collisions"}),
        },
        async handler(args) {
            let filesource = await args.source()
            let cache = await EngineCache.create(filesource)

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
            let cache = await EngineCache.create(filesource)

            let all: Map<number, LocWithUsages> = new Map()

            async function uses(tile_rect: MapRect, loc: WorldLocation): Promise<void> {
                const entry: LocWithUsages | null = await (async () => {
                    if (all.has(loc.locid)) return all.get(loc.locid)!!

                    const resolved = loc.location

                    if (!resolved.name) return null

                    const actions = getActions(resolved)

                    if (actions.length == 0) return null

                    const e = {
                        id: loc.locid,
                        uses: [],
                        location: resolved
                    }

                    all.set(loc.locid, e)
                    return e
                })()

                if (!entry) return

                let [width, height] = loc.rotation % 2 == 0
                    ? [entry.location.width ?? 1, entry.location.length ?? 1]
                    : [entry.location.length ?? 1, entry.location.width ?? 1]

                const box = TileRectangle.lift(
                    Rectangle.from(
                        {x: loc.x, y: loc.z},
                        {x: loc.x + width - 1, y: loc.z + height - 1},
                    ),
                    loc.effectiveLevel as floor_t,
                )

                entry.uses.push({
                    ...loc,
                    location: undefined,
                    box: box,
                    origin: TileRectangle.bl(box),
                } as any)
            }

            let area: MapRect | null = null // {x: 46, z: 52, xsize: 1, zsize: 1}

            await time("Collecting Locs", async () => {
                await iterate_chunks(area, async (x, y) => {
                    await time(`Collect ${x}-${y}`, async () => {
                        const {grid, chunk} = await parseMapsquare(cache, x, y)

                        console.log(`${chunk?.rawlocs.length} raw vs ${chunk?.locs.length} processed`)

                        if (chunk) await Promise.all(chunk.locs.map(async loc => await uses(chunk.tilerect, loc)))
                    })
                })
            })

            let out = Object.fromEntries(Array.from(all.keys()).map(k => [k, all.get(k)]))

            const n = Object.values(out).map(e => e?.uses.length).reduce((a, b) => a!! + b!!, 0)

            console.log(`Total of ${n} loc instances`)

            fs.writeFileSync("locs.json", JSON.stringify(out))

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

                    fs.writeFileSync("D:\\Projekte\\Tools\\mycluesolver\\static\\map\\cache_transportation.json", JSON.stringify(shortcuts, (key, value) => {
                        if (key.startsWith("_")) return undefined

                        return value
                    }, 2))

                    fs.writeFileSync("D:\\Projekte\\Tools\\mycluesolver\\dist\\map\\cache_transportation.json", JSON.stringify(shortcuts, (key, value) => {
                        if (key.startsWith("_")) return undefined

                        return value
                    }, 2))
                })
            },
        })

    const extract_shortcuts2 = command(
        {
            name: "shortcuts2",
            args: {},
            async handler(args) {

                let data: Record<number, LocWithUsages> = JSON.parse(fs.readFileSync("locs.json", "utf-8"))

                await time("Shortcuts", () => {
                    let shortcuts = parsers2
                        .flatMap(p => {

                            return p.locs.flatMap(l =>
                                l.for.flatMap(loc_id => {
                                    let loc: LocWithUsages = data[loc_id]

                                    const instances = p.gather(loc)

                                    console.log(`Loc ${loc_id}: Extracted ${instances.length} (by parser '${p._name}')`)

                                    return instances
                                })
                            )
                        })

                    console.log(`Extracted a total of ${shortcuts.length} shortcuts!`)

                    fs.writeFileSync("D:\\Projekte\\Tools\\mycluesolver\\static\\map\\cache_transportation.json", JSON.stringify(shortcuts, (key, value) => {
                        if (key.startsWith("_")) return undefined

                        return value
                    }, 2))

                    fs.writeFileSync("D:\\Projekte\\Tools\\mycluesolver\\dist\\map\\cache_transportation.json", JSON.stringify(shortcuts, (key, value) => {
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
                actions?: string[],
                area?: TileRectangle,
                object_id?: number,
                without_parser?: boolean
            }

            let filter: filter_t = {
                names: ["Door"],
                actions: ["open", "use", "enter", "climb", "crawl", "scale", "pass", "jump", "leave"],
                without_parser: true,
                //object_id: 56989,
                area: {"topleft": {"x": 2904, "y": 3536}, "botright": {"x": 2922, "y": 3515}, "level": 0},
            }

            let data: Record<number, LocWithUsages> = JSON.parse(fs.readFileSync("locs.json", "utf-8"))

            let filtered = Object.values(data).filter((loc) => {
                if (filter.names && !filter.names.some(n => loc.location.name!.toLowerCase().includes(n.toLowerCase()))) return false
                if (filter.object_id && loc.id != filter.object_id) return false
                if (filter.without_parser && transportation_parsers.some(p => {
                    return (p.variants && p.variants.some(v => v.for.includes(loc.id))) || (p.for && p.for.includes(loc.id))
                })) return false


                if (filter.actions != null) {
                    const actions = getActions(loc.location)

                    if (actions.length == 0) return false

                    if (!actions.some(a => filter.actions?.some(filter_action =>
                        a.name.toLowerCase().includes(filter_action.toLowerCase()),
                    ))) return false
                }

                loc.uses = loc.uses.filter(use => {
                    return !(filter.area && (!Rectangle.overlaps(filter.area, use.box)))
                        && !transportation_rectangle_blacklists.some(blacklist => Rectangle.contains(blacklist, use.box.topleft))
                })

                return loc.uses.length > 0
            }).sort((a, b) => {
                return b.uses.length - a.uses.length
            })

            //console.log(JSON.stringify(filtered.map(loc => loc.id)))
            console.log(`${filtered.length} loc types with ${filtered.flatMap(f => f.uses).length} total usages fit the filter.`)

            fs.writeFileSync("results.json", JSON.stringify(filtered.slice(0, 30), null, 2))
        },
    })


    let subcommands = cmdts.subcommands({
        name: "",
        cmds: {
            extract, indexoverview, testdecode, diff, quickchat, scrapeavatars, edit, historicdecode, openrs2ids, filehist, cluecoords, cluecoords2, sequencegroups,
            collisions,
            leridon,
            locs,
            shortcuts: extract_shortcuts,
            shortcuts2: extract_shortcuts2
        }
    });

    return {
        subcommands
    }
}