import {objects} from "../../../generated/objects"
import {Path} from "../../zykloplib/runescape/pathing"
import {mapsquare_locations} from "../../../generated/mapsquare_locations"
import {TileCoordinates, TileRectangle} from "../../zykloplib/runescape/coordinates"
import {WorldLocation} from "../../3d/mapsquare";

export namespace LocUtil {

    import CursorType = Path.CursorType;

    export type LocUse = Omit<WorldLocation, "location"> & {
        location: undefined,
        box: TileRectangle,
        origin: TileCoordinates
    }

    export type LocWithUsages = {
        id: number,
        location: objects,
        uses: LocUse[]
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
        const action = loc[`actions_${index}`] ?? loc[`members_action_${index}`]

        let exists = !!action

        if (!exists) return undefined

        return {
            name: action as string,
            cursor: CursorType.fromCacheCursor(loc[`action_cursors_${index}`]),
        }
    }
}