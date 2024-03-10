import {objects} from "../../../generated/objects"
import {Path} from "../../zykloplib/runescape/pathing"
import {mapsquare_locations} from "../../../generated/mapsquare_locations"
import {TileCoordinates, TileRectangle} from "../../zykloplib/runescape/coordinates"

export namespace LocUtil {

    import CursorType = Path.CursorType

    export type LocWithUsages = {
        id: number,
        location: objects,
        uses: (mapsquare_locations["locations"][number]["uses"][number] & {
            box: TileRectangle,
            origin: TileCoordinates
        })[]
    }

    export function getActions(loc: objects): {
        name: string,
        cursor: CursorType
    }[] {
        return [0, 1, 2, 3, 4].map(i => getAction(loc, i)).filter(a => a != null).map(a => a!)
    }

    export function getAction(loc: objects, index: number = 0): {
        name: string,
        cursor: CursorType
    } | undefined {
        let exists = !!loc[`actions_${index}`]

        if (!exists) return undefined

        return {
            name: loc[`actions_${index}`] as string,
            cursor: CursorType.fromCacheCursor(loc[`action_cursors_${index}`]),
        }
    }
}