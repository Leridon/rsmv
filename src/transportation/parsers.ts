import {TileRectangle} from "../zykloplib/runescape/coordinates"
import {Transportation} from "../zykloplib/runescape/transportation"
import transportation = Transportation.Transportation
import {direction} from "../zykloplib/runescape/movement"
import {Rectangle, Vector2} from "../zykloplib/math"
import {TileArea} from "../zykloplib/runescape/coordinates/TileArea"
import {ParserConstructors} from "./util/ParserConstructors"
import basic_entity_parser = ParserConstructors.basic_entity_parser
import BasicEntityParserOptions = ParserConstructors.BasicEntityParserOptions
import {TransportParser, TransportParser2} from "./TransportParser"
import ignore = ParserConstructors.ignore
import parser = ParserConstructors.parser
import simple = TransportParser.simple;
import {MovementBuilder} from "./util/MovementBuilder";
import offset = MovementBuilder.offset;

export const transportation_rectangle_blacklists: Rectangle[] = [
    {topleft: {"x": 3904, "y": 4991}, botright: {"x": 5951, "y": 4032}}, // Clan Citadel
    {topleft: {"x": 64, "y": 5583}, botright: {"x": 255, "y": 4992}}, // Dungeoneering
    {topleft: {"x": 64, "y": 4863}, botright: {"x": 639, "y": 4224}}, // Dungeoneering
    {topleft: {"x": 64, "y": 3711}, botright: {"x": 703, "y": 1920}}, // Dungeoneering
    {topleft: {"x": 960, "y": 6847}, botright: {"x": 1151, "y": 6720}}, // Sagas
    {topleft: {"x": 1856, "y": 5119}, botright: {"x": 1983, "y": 5056}}, // PoH
]

export const transportation_parsers: TransportParser<any>[] = [

    {
        name: "Gnome Spiral staircase down",
        for: [69504],
        // TODO: This is broken for some, need to query for 69505 to find where exactly we land
        instance: () => basic_entity_parser({
            actions: [{
                interactive_area: TileArea.init({x: 1, y: 0, level: 0}),
                movement: [{
                    time: 4,
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
                interactive_area: TileArea.init({x: 0, y: -1, level: 0}, {x: 2, y: 1}),
                movement: [{
                    time: 4,
                    fixed_target: {target: {x: 2, y: 0, level: 1}, relative: true},
                    forced_orientation: {dir: direction.east, relative: true},
                }],
            }],
        }),
    },
]

