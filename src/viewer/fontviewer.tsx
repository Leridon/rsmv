import * as React from "react";
import {composeTexts, fontTextCanvas, ParsedFontJson, readableFontText} from "../scripts/fontmetrics";
import {CanvasView, CopyButton} from "./commoncontrols";


export type GenerateFontMeta = {
    /**
     * The y-coord inside the sprite that is used as y-coord later when reading, usually the lowest pixel that that all characters have in common
     */
    basey: number,
    /**
     * Number of pixels to skip when reading a space character
     */
    spacewidth: number,
    /**
     * number between 0 and 1 that indicates how close to the text color a pixels needs to be before being used in detection, 1 means it needs to match perfectly. usually ~0.6 when there is good contrast with the text background and up to 0.8 when contrast is bad.
     */
    treshold: number,
    /**
     * Text color in the template image, can usually be found by looking for the brightest pixel or the text pixel corresponding to a pure black shadow pixel
     */
    color: [number, number, number],
    /**
     * Whether the text has a black drop-shadow in the template image. Shadowed fonts are way more robust to detect when background contrast is bad
     */
    shadow: boolean,
    /**
     * The characters in the template image typed out as a string in the same order as the template
     */
    chars: string,
    /**
     * a string containing "secondary" characters, usually small characters like `,.;'"`. Secondary characters will only get matched when nothing else matches and won't get used to find the position of text
     */
    seconds: string
    /**
     * You can make some characters slightly more or less likely to match over other using this map. a nudge of +50 is usually enough to fix problems between n and r for example. Set OCR.debug to true to see internal characters scores when reading text
     */
    bonus?: { [char: string]: number },
    /**
     * How to interpret and remove the background from the template image.
     * - `removebg`: Template image height is 2n+1 pixels arranged as: n pixels character screenshots, 1 pixel black/white character boundary followed by n pixels of best estimate of the background behind the characters in the first n pixels
     * - `raw`: The background is already removed and applying standard alpha blending to the template gives identical results as in-game. The last row of pixels is black/white corresponding to character boundaries again
     * - `blackbg`: Only works when shadow=false, the template text is placed on a black background. Last row of pixels indicated character boundaries again.
     */
    unblendmode: "removebg" | "raw" | "blackbg",
    /**
     * unused, for later reference
     */
    spriteid?: number
};

export function RsFontViewer(p: { data: ParsedFontJson }) {
    let [text, settext] = React.useState("The quick brown fox jumps over the lazy dog.");
    let [color, setcolor] = React.useState("#ffffff");
    let [shadow, setshadow] = React.useState(true);
    let [loaded, setloaded] = React.useState(false);
    let [readable, setreadable] = React.useState(true);
    //cache the sheet image
    let sheetimg = React.useMemo(() => {
        let img = new Image();
        img.src = p.data.sheet;
        setloaded(img.complete);
        img.decode().then(() => setloaded(true));
        return img;
    }, [p.data]);
    let [canvas, setcanvas] = React.useState<HTMLCanvasElement | null>(null);

    React.useEffect(() => {
        if (!loaded) { return; }

        let fmeta: GenerateFontMeta = {
            basey: p.data.baseline,
            chars: p.data.characters.map(c => c?.chr).filter(c => c != null).join(""),
            color: [255, 255, 255],
            seconds: ",.-:;\"'|*",
            shadow: shadow,
            spacewidth: p.data.characters.find(c => c?.chr == " ")?.width ?? 0,
            spriteid: p.data.spriteid,
            treshold: 0.6,
            unblendmode: "raw"
        }

        if(readable) {
            let cnv = readableFontText(p.data, sheetimg, shadow)
            setcanvas(cnv);
        } else {
            let textcnv = fontTextCanvas(p.data, sheetimg, text, 1 / p.data.scale)
            // let textcnv = fontTextCanvas(p.data, sheetimg, text, 1)
            let composed = composeTexts(textcnv, color, shadow);
            setcanvas(composed);
        }


    }, [p.data, text, color, shadow, loaded, readable]);

    let ref = (el: HTMLDivElement) => {
        if (el) {
            el.replaceChildren(sheetimg);
        }
    }

    return (
        <div>
            <div style={{marginBottom: "8px"}}>
                <textarea style={{width: "100%", height: "80px", resize: "vertical"}} value={text} onChange={e => settext(e.currentTarget.value)}/>
            </div>
            <div>
                Text Color
                <input type="color" value={color} onChange={e => setcolor(e.currentTarget.value)} style={{width: "100px"}}/>
            </div>
            <div>
                <label>
                    <input type="checkbox" checked={shadow} onChange={e => setshadow(e.currentTarget.checked)}/>
                    Drop Shadow
                </label>
            </div>
            <div>
                <label>
                    <input type="checkbox" checked={readable} onChange={e => setreadable(e.currentTarget.checked)}/>
                    Readable Export
                </label>
            </div>
            <CopyButton canvas={canvas ?? undefined}/>
            <div style={{maxWidth: "100%", overflow: "auto", display: "block"}}>
                <CanvasView canvas={canvas} fillHeight={true}/>
            </div>
            <div ref={ref}/>
        </div>
    )
}

