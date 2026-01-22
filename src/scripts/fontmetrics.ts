import {parseSprite, spriteHash} from "../3d/sprite";
import {CacheFileSource} from "../cache";
import {cacheMajors} from "../constants";
import {pixelsToDataUrl, sliceImage} from "../imgutils";
import {parse} from "../opdecoder";

export type FontCharacterJson = {
    chr: string,
    charcode: number,
    x: number,
    y: number,
    width: number,
    height: number,
    bearingy: number,
    hash: number
}

export type ParsedFontJson = {
    fontid: number,
    spriteid: number,
    characters: (FontCharacterJson | null)[],
    median: number,
    baseline: number,
    maxascent: number,
    maxdescent: number,
    scale: number,
    sheethash: number,
    sheetwidth: number,
    sheetheight: number,
    sheet: string
}

export async function loadFontMetrics(cache: CacheFileSource, buf: Buffer, fontid: number) {
    let fontdata = parse.fontmetrics.read(buf, cache);

    if (!fontdata.sprite) {
        throw new Error("fontmetrics missing sprite data");
    }
    let sprite = await cache.getFileById(cacheMajors.sprites, fontdata.sprite.sourceid);
    let imgs = parseSprite(sprite);
    if (imgs.length != 1) {
        throw new Error("fontmetrics sprite did not contain exactly 1 image");
    }
    let img = imgs[0];
    if (img.fullwidth != fontdata.sprite.sheetwidth || img.fullheight != fontdata.sprite.sheetheight) {
        throw new Error("fontmetrics sprite image dimensions do not match metadata");
    }

    let font: ParsedFontJson = {
        fontid: fontid,
        spriteid: fontdata.sprite.sourceid,
        characters: [],
        median: fontdata.sprite.median,
        baseline: fontdata.sprite.baseline,
        maxascent: fontdata.sprite.maxascent,
        maxdescent: fontdata.sprite.maxdescent,
        scale: fontdata.sprite.scale,
        sheethash: spriteHash(img.img),
        sheetwidth: fontdata.sprite.sheetwidth,
        sheetheight: fontdata.sprite.sheetheight,
        sheet: await pixelsToDataUrl(img.img)
        //sheet: ""
    };
    for (let i = 0; i < fontdata.sprite.positions.length; i++) {
        let pos = fontdata.sprite.positions[i];
        let size = fontdata.sprite.chars[i];
        if (size.width === 0 || size.height === 0) {
            font.characters.push(null);
            continue;
        }
        let subimg = sliceImage(img.img, {x: pos.x, y: pos.y, width: size.width, height: size.height});
        font.characters.push({
            chr: String.fromCharCode(i),
            charcode: i,
            x: pos.x,
            y: pos.y,
            width: size.width,
            height: size.height,
            bearingy: size.bearingy,
            hash: spriteHash(subimg)
        });
    }
    return font;
}

export function measureFontText(font: ParsedFontJson, text: string) {
    let width = 0;
    let height = font.baseline + font.maxdescent;
    let x = 0;

    for (let i = 0; i < text.length; i++) {
        if (text[i] == "\n") {
            height += font.baseline;
            x = 0;
            continue;
        }
        let fontchar = font.characters[text.charCodeAt(i)];
        if (fontchar) {
            x += fontchar.width;
            width = Math.max(width, x);
        }
    }
    return {width, height};
}

export function readableFontText(font: ParsedFontJson, sheet: HTMLImageElement, shadow: boolean) {
    const included_characters = font.characters.map(c => c?.chr)
        .filter(c => c != null && c.charCodeAt(0) <= 0x7f && c != " " && c != "`")
        .map(c => c!!)

    const text = included_characters.join(" ")

    const scale = 1 / font.scale;

    const font_canvas = fontTextCanvas(font, sheet, text, 1 / font.scale);

    const composed = composeTexts(font_canvas, "#ffffffff", shadow);

    const final_canvas = document.createElement("canvas");
    final_canvas.width = composed.width;
    final_canvas.height = composed.height + 2;

    const ctx = final_canvas.getContext("2d")!;

    ctx.drawImage(composed, 0, 0);

    const final_data = ctx.getImageData(0, 0, final_canvas.width, final_canvas.height);
    {
        let x = 0;
        const space_width = scale * font.characters.find(c => c?.chr == " ")!.width
        for (let character of included_characters) {
            let chr = font.characters.find(c => c?.chr == character)!!;

            for (let xi = 0; xi < scale * chr.width; xi++) {
                const bottom_index = ((final_data.height - 1) * final_data.width + x + xi) * 4

                final_data.data[bottom_index] = 255;
                final_data.data[bottom_index + 1] = 255;
                final_data.data[bottom_index + 2] = 255;
                final_data.data[bottom_index + 3] = 255;
            }

            x += scale * chr.width;
            x += space_width
        }
    }

    ctx.putImageData(final_data, 0, 0);

    let m = {
        basey: scale * font.baseline - 2,
        chars: included_characters.join(""),
        color: [255, 255, 255],
        seconds: ",.-:;\"'|*",
        shadow: shadow,
        spacewidth: scale * (font.characters.find(c => c?.chr == " ")?.width ?? 0),
        spriteid: font.spriteid,
        treshold: 0.6,
        unblendmode: "raw"
    }

    console.log("Meta")
    console.log(m)

    return final_canvas
}


export function fontTextCanvas(font: ParsedFontJson, sheet: HTMLImageElement, text: string, scale: number) {

    console.log(font)

    /*text = font.characters.map(c => c?.chr)
        .filter(c => c != null && c != " ")
        .join(" ")*/

    let {width, height} = measureFontText(font, text);
    let canvas = document.createElement("canvas");
    canvas.width = Math.max(1, width * scale);
    canvas.height = Math.max(1, height * scale);

    console.log(`Scale: ${scale}`)
    console.log(`Height: ${height}`)

    let ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    let x = 0;
    let y = 0;
    for (let i = 0; i < text.length; i++) {
        if (text[i] == "\n") {
            y += font.baseline;
            x = 0;
            continue;
        }
        let fontchar = font.characters[text.charCodeAt(i)];
        if (fontchar) {
            let dy = fontchar.bearingy;

            ctx.drawImage(sheet, fontchar.x, fontchar.y, fontchar.width, fontchar.height, x, y + dy, fontchar.width, fontchar.height);

            x += fontchar.width;
        }
    }
    return canvas;
}

export function composeTexts(cnv: HTMLCanvasElement, color: string, shadow: boolean) {
    let tmp = document.createElement("canvas");

    tmp.width = cnv.width + (shadow ? 1 : 0);
    tmp.height = cnv.height + (shadow ? 1 : 0);

    // gotto do some sorcery to colorize the font while preserving alpha because canvas "multiply" messes with alpha
    let ctx = tmp.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(cnv, 0, 0);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(cnv, 0, 0);

    if (shadow) {
        ctx.filter = "drop-shadow(1px 1px 0px black)";
        ctx.globalCompositeOperation = "copy";
        ctx.drawImage(tmp, 0, 0);
    }

    return tmp;
}
