import {objects} from "../../generated/objects"
import {mapsquare_locations} from "../../generated/mapsquare_locations"
import {TileCoordinates, TileRectangle} from "../zykloplib/runescape/coordinates"
import {Transportation} from "../zykloplib/runescape/transportation"
import transportation = Transportation.transportation
import {direction} from "../zykloplib/runescape/movement"
import {Rectangle, Transform, Vector2} from "../zykloplib/math"
import {Path} from "../zykloplib/runescape/pathing"
import InteractionType = Path.InteractionType
import {TileArea} from "../zykloplib/runescape/coordinates/TileArea"
import {TileTransform} from "../zykloplib/runescape/coordinates/TileTransform"
import EntityActionMovement = Transportation.EntityActionMovement
import {number} from "cmd-ts"

export const transportation_rectangle_blacklists: Rectangle[] = [
    {topleft: {"x": 3904, "y": 4991}, botright: {"x": 5951, "y": 4032}}, // Clan Citadel
    {topleft: {"x": 64, "y": 5583}, botright: {"x": 255, "y": 4992}}, // Dungeoneering
    {topleft: {"x": 64, "y": 4863}, botright: {"x": 639, "y": 4224}}, // Dungeoneering
    {topleft: {"x": 64, "y": 3711}, botright: {"x": 703, "y": 1920}}, // Dungeoneering
    {topleft: {"x": 960, "y": 6847}, botright: {"x": 1151, "y": 6720}}, // Sagas
    {topleft: {"x": 1856, "y": 5119}, botright: {"x": 1983, "y": 5056}}, // PoH
]

export type LocWithUsages = {
    id: number,
    location: objects,
    uses: (mapsquare_locations["locations"][number]["uses"][number] & {
        box: TileRectangle
    })[]
}

type Parser<ExtraData = undefined> = {
    name?: string,
    description?: string,
    for?: number[],
    variants?: {
        for: number[],
        extra?: ExtraData extends undefined ? undefined : ExtraData
    }[]
    instance: ((loc: objects, extra_data: ExtraData) => (loc: objects, use: LocWithUsages["uses"][number]) => transportation[] | transportation) | null
}

function parser<ExtraData>(parser: Parser<ExtraData>): Parser<ExtraData> {
    return parser
}

function ignore(name: string, loc_ids: number[]): Parser<undefined> {
    return {
        name: `(Ignore) ${name}`,
        variants: [{
            for: loc_ids,
        }],
        instance: null,
    }
}

export const transportation_parsers: Parser<any>[] = [
    ignore("Miscellanious", [
        53948, 55762, 50343, 50342, 50344, 12974, 49693, 3779, 3724, 70156, 70238, // Dungeoneering and saga doors
        70235, 3782, 70237, 49337,
        15326, 15327, // POH Doors
        93922, 93924, 93813, // Doors in the Broken Home mansion
        5002,
        64674, 9323, 35998,
        37268, 37211, 37212, 57895, 57899, 57903, 57907, // Clan Citadel stairs
        3626, // Walls in the maze random event
        29476, 29477, 29478, // Tiles in the vinesweeper minigame
        85447,
        112989, // Lava Flow mine
        85446, 85449,
        16189, 16187, // Gorak plane
        17119,
        15810, // no idea
        5138, // Some quest
        95373, // Quest probably
        20224, 20225, 20244, 20248, 81199,
        38693,
        66313, // Some quest area
        85442, // Battle of lumbridge
        49089, // Weird inaccessible ladder at the fishing guild
        1752
    ]),
    ignore("Transportations but no parser yet", [
        77745, // Chaos tunnel portals
        70480, 70478, 70489, 70491, 70476, 70481, 70490, 70493, // Runespan, potentially easy to parse
        103472, // Small portal in behind the scenes
        43595, 64698, 69526, // Agility courses
        3610, // Rope, maybe works like a ladder
        29057, 29004, // OoGlog pools
        119969, // Senntisten
        116736, // Chaos portal infernal source
        10782, // Magic Training Arena
        3309, // underground pass
        27129, 27130, 27152, // Vine area near shilo
        91974, 91975, 91972, 91973, // Poison Swamp rocks (should be easy to parse)
        16005, // rum minigame
        16947, 16945, //Lunar isle boat stairs
        83731, // castle wars jumping stones
        5269, // jumping stones north of morytania herb

    ]),
    ignore("Closing doors", [
        1240, 1515, 1517, 1520, 1529, 1531,
        1534, 2417, 3764, 4248, 4251, 5888,
        5890, 6109, 10261, 11537, 11617, 11708,
        11712, 11715, 15535, 21343, 21402, 24375,
        24379, 24383, 25820, 26207, 34043, 34045,
        34353, 34808, 36737, 36912, 36914, 37000,
        37003, 40109, 40185, 45477, 52475, 72005,
        72009, 85009, 85078, 85079, 112223, 112224,
    ]),
    ignore("Not a transportation",

           [
               // Trees
               69144, 38760, 70060, 38783, 38785, 1282, 69139, 69142, 58140, 69141, 1276, 70063, 38787, 1278, 1286, 58108, 1289, 58121, 47596, 1291, 58135, 47594, 47598, 4818, 47600, 4820, 38782, 51843, 38786, 69554, 2289, 38788, 58141, 11866, 37477, 38784, 2889, 1283, 58109, 9366, 1383, 9387, 2890, 4060, 69556, 37478, 9355, 70068, 2410, 70071, 42893, 63176, 2887, 9354, 24168, 1284, 58142, 122440, 70066, 110930, 119459, 110926, 119457, 1365, 9388, 46277, 110932, 3300, 37482, 110927, 110928, 16604, 119460, 99822, 110931, 110933, 124998, 37481, 92440, 110929, 2409, 16265, 79813, 107507, 124996, 2411, 28951, 61191, 99823, 107506, 125510, 61192, 77095, 93384, 119458, 125502, 1384, 2023, 41713, 61190, 61193, 93385, 99825, 100637, 122439, 125504, 125506, 3293, 4135, 5904, 32294, 99824, 125514, 1292, 1330, 1331, 1332, 4674, 18137, 28952, 37483, 37654, 37821, 70001, 70002, 70003, 70005, 70099, 87512, 87514, 87516, 87518, 87520, 87522, 87524, 87526, 87528, 87530, 94314, 100261, 111254, 125508, 125512, 125516, 125533,
               // More Trees
               38731, 54787, 38732, 38616, 54778, 57964, 38627, 38755, 70057, 57934, 104007, 9036, 104350, 104351, 104352, 111303, 114099, 58006, 104356, 104358, 104348, 37479, 1281, 104357, 92442, 104347, 46275, 104349, 104355, 111302, 111304, 111305, 114098, 114100, 114101, 70076, 11999, 104647, 2210, 70075, 1315, 12000, 46274, 125530, 139, 1309, 37480, 70077, 104353, 111307, 114102, 125518, 125522, 142, 2372, 15062, 43874, 104354, 125520, 125524, 125526, 127400,
           ],
    ),
    {
        name: "Single Doors (West)",
        variants: [{
            for: [
                24384, 15536, 1530, 24376, 45476, 17600, 22914, 24381, 34807,
                36846, 11714, 64831, 47512, 4250, 66758, 77969, 34046, 34811,
                1239, 36022, 11993,
            ],
        }],
        instance: () => (door, use): transportation[] | transportation => {
            return {
                type: "door",
                name: door.name!!,
                direction: direction.rotate(direction.west, use.rotation),
                position: TileRectangle.bl(use.box),
            }
        },
    }, parser<{ length: number }>(
        {
            name: "Fremmenik Isles Rope Bridges",
            variants: [{
                for: [21306, 21307, 21308, 21309, 21310, 21311, 21312, 21313, 21314, 21315],
                extra: {length: 9},
            }, {
                for: [21316, 21317, 21318, 21319],
                extra: {length: 5},
            }],
            instance: (_, extra) =>
                basic_entity_parser({
                                        plane_offset: -1,
                                        actions: [{
                                            time: extra.length + 1,
                                            interactive_area: TileArea.init({x: 0, y: -1, level: 0}),
                                            movement: [{
                                                offset: {x: 0, y: extra.length, level: 0},
                                            }],
                                        }],
                                    }),
        }), parser<{ length: number }>(
        {
            name: "Fremmenik Isles Rope Bridges",
            variants: [{
                for: [21306, 21307, 21308, 21309, 21310, 21311, 21312, 21313, 21314, 21315],
                extra: {length: 9},
            }, {
                for: [21316, 21317, 21318, 21319],
                extra: {length: 5},
            }],
            instance: (_, extra) =>
                basic_entity_parser({
                                        plane_offset: -1,
                                        actions: [{
                                            time: extra.length + 1,
                                            interactive_area: TileArea.init({x: 0, y: -1, level: 0}),
                                            movement: [{
                                                offset: {x: 0, y: extra.length, level: 0},
                                            }],
                                        }],
                                    }),
        }),
    parser<{}>(
        {
            name: "Isafdar Dense Forest",
            variants: [{
                for: [3937, 3938, 3939, 3998, 3999],
                extra: {},
            }],
            instance: (loc, extra) =>
                // TODO: Quick-travel with quiver equipped
                basic_entity_parser({
                                        plane_offset: 0,
                                        actions: [{
                                            time: 6,
                                            movement: [{
                                                offset: {x: 0, y: (loc.length ?? 1) + 1, level: 0},
                                                valid_from: TileArea.init({x: 1, y: -1, level: 0}),
                                            }, {
                                                offset: {x: 0, y: -((loc.length ?? 1) + 1), level: 0},
                                                valid_from: TileArea.init({x: 1, y: (loc.length ?? 1), level: 0}),
                                            },
                                            ],
                                        }],
                                    }),
        }),
    {
        name: "Lletya Tree",
        variants: [{for: [8742]}],
        instance: () =>
            basic_entity_parser({
                                    plane_offset: 0,
                                    actions: [{
                                        time: 6,
                                        interactive_area: TileArea.init({x: -1, y: 3, level: 0}, {x: 3, y: 1}),
                                        movement: [{
                                            valid_from: TileArea.init({x: -1, y: 3, level: 0}),
                                            offset: {x: 2, y: 0, level: 0},
                                        }, {
                                            valid_from: TileArea.init({x: 1, y: 3, level: 0}),
                                            offset: {x: -2, y: 0, level: 0},
                                        },
                                        ],
                                    }],
                                })
        ,
    },
    parser<{ length: number, ticks: number, direction?: direction, plane_offset?: number }>(
        {
            name: "Log Balances",
            variants: [
                {for: [2296], extra: {length: 5, ticks: 7, direction: direction.south}},
                {for: [3931, 3932], extra: {length: 6, ticks: 7}},
                {for: [3933], extra: {length: 7, ticks: 9}},
                {for: [9322], extra: {length: 4, ticks: 6, direction: direction.south, plane_offset: -1}},
                {for: [9324], extra: {length: 4, ticks: 6, direction: direction.north, plane_offset: -1}},
                {for: [35997], extra: {length: 4, ticks: 5, direction: direction.south, plane_offset: -1}},
                {for: [35999], extra: {length: 4, ticks: 5, direction: direction.north, plane_offset: -1}},
            ],
            instance: (loc, extra) => {
                const dir = extra.direction ?? direction.north

                const start = direction.toVector(direction.invert(dir))

                return basic_entity_parser({
                                               plane_offset: extra.plane_offset ?? 0,
                                               actions: [{
                                                   time: extra.ticks,
                                                   interactive_area: TileArea.init({...start, level: 0}),
                                                   movement: [{
                                                       offset: {...Vector2.scale(extra.length, direction.toVector(dir)), level: 0},
                                                   }],
                                               }],
                                           })
            },
        }),
    {
        name: "Gnome Spiral staircase down",
        for: [69504],
        // TODO: This is broken for some, need to query for 69505 to find where exactly we land
        instance: () => basic_entity_parser({
                                                actions: [{
                                                    time: 4,
                                                    interactive_area: TileArea.init({x: 1, y: 0, level: 0}),
                                                    movement: [{
                                                        offset: {x: -1, y: -1, level: -1},
                                                        forced_orientation: {dir: direction.north, relative: true},
                                                    }],
                                                }],
                                            }),
    },
    {
        name: "Gnome Spiral staircase up",
        for: [69505],
        // TODO: This is broken for some, need to query for 69504 to find where exactly we land
        instance: () => basic_entity_parser({
                                                actions: [{
                                                    time: 4,
                                                    interactive_area: TileArea.init({x: 0, y: -1, level: 0}, {x: 2, y: 1}),
                                                    movement: [{
                                                        fixed_target: {target: {x: 2, y: 0, level: 1}, relative: true},
                                                        forced_orientation: {dir: direction.east, relative: true},
                                                    }],
                                                }],
                                            }),
    },
    {
        name: "Stiles",
        for: [112215],
        instance: (loc) => basic_entity_parser({
                                                   actions: [{
                                                       time: 7,
                                                       interactive_area: TileArea.init({x: 0, y: 0, level: 0}, {x: 1, y: 2}),
                                                       movement: [{
                                                           offset: {x: 0, y: 1, level: 0},
                                                           valid_from: TileArea.init({x: 0, y: 0, level: 0}),
                                                           orientation: "toentitybefore",
                                                       }, {
                                                           offset: {x: 0, y: -1, level: 0},
                                                           valid_from: TileArea.init({x: 0, y: 1, level: 0}),
                                                           orientation: "toentitybefore",
                                                       }],
                                                   }],
                                               }),
    },
    ignore("Unsupported ladders", [32015]),

    parser<{
        single_side?: direction, move_across?: boolean,
        actions: { up?: number, down?: number },
    }>(
        {
            name: "Ladders",
            variants: [
                {extra: {actions: {up: 0}}, for: [1746]},
                {extra: {actions: {up: 0}}, for: [1747]},

                {extra: {actions: {down: 0}, single_side: direction.north}, for: [24355, 36770, 34396, 24362]},
                {extra: {actions: {up: 0}, single_side: direction.north}, for: [24354, 36768, 34394, 69499]},

                {extra: {actions: {up: 1, down: 2}, single_side: direction.north}, for: [36769]},

                {extra: {actions: {down: 0}, single_side: direction.east}, for: [4778]},
                {extra: {actions: {up: 0}, single_side: direction.east}, for: [4772]},

                {extra: {actions: {down: 0}, single_side: direction.south}, for: [10494]},
                {extra: {actions: {up: 0}, single_side: direction.south}, for: [21395]},

                {extra: {actions: {down: 0}, single_side: direction.north, move_across: true}, for: [17975]},
                {extra: {actions: {up: 0}, single_side: direction.north, move_across: true}, for: [17974]},
            ],
            instance: (loc, extra) => {
                const off = extra.single_side && extra.move_across
                    ? Vector2.scale(-2, direction.toVector(extra.single_side))
                    : {x: 0, y: 0}

                function ladder_action(level_off: 1 | -1, cache_index: number): BasicEntityParserOptions["actions"][number] {
                    return {
                        time: 3,
                        interactive_area: extra.single_side
                            ? TileArea.init({...direction.toVector(extra.single_side), level: 0})
                            : undefined,
                        cache_index: cache_index,
                        movement: [{
                            offset: {...off, level: level_off},
                            orientation: "toentitybefore",
                        }],
                    }
                }

                return basic_entity_parser(
                    {
                        actions: [
                            extra.actions.up != null ? ladder_action(1, extra.actions.up) : undefined,
                            extra.actions.down != null ? ladder_action(-1, extra.actions.down) : undefined,
                        ].filter(a => !!a).map(a => a!),
                    })
            },
        }),
    parser<{
        level: 1 | -1,
        length?: number
    }>({
           name: "Simple Staircases",
           variants: [
               {for: [45483, 2347], extra: {level: 1}},
               {for: [45484, 2348], extra: {level: -1}},

               {for: [24359], extra: {level: -1, length: 3}},
           ],
           instance: (loc, extra) => {
               return basic_entity_parser({
                                              actions: [{
                                                  cache_index: 0,
                                                  interactive_area: {
                                                      origin: (extra.level > 0)
                                                          ? {x: 0, y: 2, level: 0}
                                                          : {x: 0, y: -1, level: 0},
                                                  },
                                                  movement: [{
                                                      offset: {x: 0, y: -extra.level * ((extra.length ?? loc.length ?? 1) + 1), level: extra.level},
                                                      orientation: "toentitybefore",
                                                  }],
                                                  time: 3,
                                              },
                                              ],
                                          },
               )
           },
       }),
]

export function getActions(loc: objects): {
    name: string,
    cursor: InteractionType
}[] {
    return [0, 1, 2, 3, 4].map(i => getAction(loc, i)).filter(a => a != null).map(a => a!)
}

function getAction(loc: objects, index: number = 0): {
    name: string,
    cursor: InteractionType
} | undefined {
    let exists = !!loc[`actions_${index}`]

    if (!exists) return undefined

    return {
        name: loc[`actions_${index}`] as string,
        cursor: InteractionType.fromCacheCursor(loc[`action_cursors_${index}`]),
    }
}

export type BasicEntityParserOptions = {
    name?: string,
    plane_offset?: number,
    actions: {
        cache_index?: number,
        time: number,
        movement: EntityActionMovement[],
        interactive_area?: TileArea,
        name?: string,
        cursor?: InteractionType
    }[]
}

function basic_entity_parser(options: BasicEntityParserOptions): (loc: objects, use: LocWithUsages["uses"][number]) => transportation[] | transportation {
    return (entity, use) => {
        const origin = TileRectangle.bl(use.box)

        let transport: Transportation.entity_transportation = {
            type: "entity",
            entity: {name: options.name ?? entity.name!!, kind: "static"},
            clickable_area: TileRectangle.from(
                {x: 0, y: 0, level: 0},
                {x: (entity.width ?? 1) - 1, y: (entity.length ?? 1) - 1, level: 0},
            ),
            actions:
                options.actions.filter(a => !!a).map(a => {
                    const action = getAction(entity, a.cache_index ?? 0)!

                    return {
                        name: a.name ?? action?.name ?? "Unnamed Action",
                        cursor: a.cursor ?? action.cursor ?? "generic",
                        time: a.time,
                        interactive_area: a.interactive_area ?? undefined,
                        movement: a.movement,
                    }
                }),
        }

        // Apply rotation
        if (use.rotation != 0) {
            transport = Transportation.transform(transport, TileTransform.normalize(
                Transform.rotation((4 - use.rotation) % 4), // Cache rotation is clockwise, while Transform.rotation is counterclockwise
            ))
        }

        transport = Transportation.transform(transport,
                                             TileTransform.translation(Vector2.sub(origin, TileRectangle.bl(transport.clickable_area)), use.plane + (options.plane_offset ?? 0)),
        )

        transport.clickable_area = TileRectangle.extend(transport.clickable_area, 0.5)

        return transport
    }
}