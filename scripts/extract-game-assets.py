"""Read-only extraction of UI assets from the user's installed The Bazaar game.

Install optional tooling outside app source:
python -m pip install --target .asset-tools UnityPy fonttools brotli opencv-python-headless
Then run: python scripts/extract-game-assets.py [--game-dir PATH] [--skip-fonts]
"""
from __future__ import annotations

import argparse
import json
import sys
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".asset-tools"))
import UnityPy
from PIL import Image, ImageDraw, ImageFilter

UnityPy.config.FALLBACK_UNITY_VERSION = "6000.3.11f1"
warnings.filterwarnings("ignore", message="No valid Unity version found.*")
ASSETS = ROOT / "public" / "assets"

ICON_MAP = {
    "Damage": "damage", "Health": "heal", "Shield": "shield",
    "Burn": "burn", "Poison": "poison", "Regen": "regen", "Haste": "haste",
    "Charge": "charge", "Cooldown": "cooldown", "Slowness": "slow",
    "Freeze": "freeze", "CritChance": "crit", "Ammo": "ammo",
    "Lifesteal": "lifesteal", "Toughness": "rage", "Income": "income",
    "Joy": "tempo", "Multicast": "multicast", "Destroy": "destroy",
    "Flying": "flying", "Fusion": "fusion", "TempoSpend": "tempo-spend",
    "Transform": "transform", "Upgrade": "upgrade",
}
HERO_MAP = {
    "Icon_FlatRough_DOO_TUI": "dooley", "Icon_FlatRough_JUL_TUI": "jules",
    "Icon_FlatRough_MAK_TUI": "mak", "Icon_FlatRough_Monster_TUI": "neutral",
    "Icon_FlatRough_PYG_TUI": "pygmalien", "Icon_FlatRough_STE_TUI": "stelle",
    "Icon_FlatRough_VAN_TUI": "vanessa", "Icon_FlatRough_DRA_TUI": "dragons",
    "Icon_FlatRough_KAR_TUI": "karnok",
}
PORTRAIT_MAP = {
    "Atlas_HeroPortrait_VAN_TUI": "vanessa", "Atlas_HeroPortrait_PYG_TUI": "pygmalien",
    "Atlas_HeroPortrait_DOO_TUI": "dooley", "Atlas_HeroPortrait_MAK_TUI": "mak",
    "Atlas_HeroPortrait_STE_TUI": "stelle", "Atlas_HeroPortrait_JUL_TUI": "jules",
    "Karnok": "karnok", "TheDragons": "dragons",
}


def save(im: Image.Image, directory: str, name: str, source: str, sprite: str, manifest: dict, border=None) -> None:
    target = ASSETS / directory / f"{name}.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    im.save(target)
    entry = {"path": f"/assets/{directory}/{name}.png", "sourceBundle": source,
             "spriteName": sprite, "width": im.width, "height": im.height,
             "source": "Installed The Bazaar game, Unity 6000.3.11f1"}
    if border is not None:
        entry["sliceBorderLTRB"] = [border.x, border.w, border.z, border.y]
    manifest.setdefault(directory, {})[name] = entry


def hd_icon(im: Image.Image) -> Image.Image:
    """2x Lanczos resampling. Only color is mildly sharpened; alpha stays smooth."""
    result = im.convert("RGBA").resize((im.width*2, im.height*2), Image.Resampling.LANCZOS)
    alpha = result.getchannel("A")
    rgb = result.convert("RGB").filter(ImageFilter.UnsharpMask(radius=.55, percent=35, threshold=4))
    result = rgb.convert("RGBA")
    result.putalpha(alpha)
    return result


def numbers_font(atlas: Image.Image, metadata: dict) -> None:
    """Trace the 0.5 isocontour of the original TMP SDF; retain original metrics.

    This is an atlas-derived reconstruction, not the unavailable source TTF.
    """
    import cv2
    import numpy as np
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    from fontTools.ttLib import TTFont
    face = metadata["m_FaceInfo"]
    scale = 1000 / face["m_PointSize"]
    glyphs = {entry["m_Index"]: entry for entry in metadata["m_GlyphTable"]}
    cmap, names, metrics, outlines = {}, [".notdef"], {}, {}
    empty = TTGlyphPen(None).glyph()
    outlines[".notdef"] = empty
    metrics[".notdef"] = (500, 0)
    alpha = atlas.getchannel("A")
    for entry in metadata["m_CharacterTable"]:
        cp, index = entry["m_Unicode"], entry["m_GlyphIndex"]
        g = glyphs[index]
        name = f"uni{cp:04X}"
        if name in outlines:
            continue
        cmap[cp] = name
        names.append(name)
        r, m = g["m_GlyphRect"], g["m_Metrics"]
        pen = TTGlyphPen(None)
        if r["m_Width"] and r["m_Height"]:
            x, y, w, h = r["m_X"], r["m_Y"], r["m_Width"], r["m_Height"]
            top = atlas.height-y-h
            crop = alpha.crop((x-2, top-2, x+w+2, top+h+2))
            crop = crop.resize((crop.width*4, crop.height*4), Image.Resampling.BICUBIC)
            binary = np.where(np.asarray(crop) >= 128, 255, 0).astype(np.uint8)
            contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
            for contour in contours:
                if cv2.contourArea(contour) < 2:
                    continue
                contour = cv2.approxPolyDP(contour, .35, True)
                points = [(round((m["m_HorizontalBearingX"]+p[0][0]/4-2)*scale),
                           round((m["m_HorizontalBearingY"]-p[0][1]/4+2)*scale)) for p in contour]
                pen.moveTo(points[0])
                for point in points[1:]:
                    pen.lineTo(point)
                pen.closePath()
        outlines[name] = pen.glyph()
        metrics[name] = (round(m["m_HorizontalAdvance"]*scale), round(m["m_HorizontalBearingX"]*scale))
    builder = FontBuilder(1000, isTTF=True)
    builder.setupGlyphOrder(names)
    builder.setupCharacterMap(cmap)
    builder.setupGlyf(outlines)
    builder.setupHorizontalMetrics(metrics)
    ascent, descent = round(face["m_AscentLine"]*scale), round(face["m_DescentLine"]*scale)
    builder.setupHorizontalHeader(ascent=ascent, descent=descent)
    builder.setupNameTable({"familyName": "Bazaar Numbers Web", "styleName": "Regular",
                           "uniqueFontIdentifier": "BazaarNumbersWeb-AtlasDerived-1",
                           "fullName": "Bazaar Numbers Web Regular", "psName": "BazaarNumbersWeb-Regular",
                           "version": "Version 1.0; derived from original game SDF atlas"})
    builder.setupOS2(sTypoAscender=ascent, sTypoDescender=descent, usWinAscent=ascent, usWinDescent=-descent)
    builder.setupPost()
    builder.setupMaxp()
    target = ASSETS / "fonts" / "BazaarNumbersWeb-Regular.ttf"
    builder.save(target)
    font = TTFont(target)
    font.flavor = "woff2"
    font.save(target.with_suffix(".woff2"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--game-dir", type=Path, default=Path(r"F:\SteamLibrary\steamapps\common\The Bazaar\TheBazaar_Data\StreamingAssets\aa\StandaloneWindows64"))
    parser.add_argument("--skip-fonts", action="store_true")
    args = parser.parse_args()
    manifest = {"version": 2, "method": "Read-only extraction of original installed-game sprites",
                "unavailable": {"icons": {"quest": "No standalone keyword pictogram", "enrage": "Text coloring only"}}}
    aliases = {"heal": ["health"], "income": ["gold", "value"], "flying": ["flight"]}
    numbers_atlas, numbers_meta = None, None
    keyword_style_evidence = None
    bundles = ["fonts_assets_all.bundle", "cardframes_assets_all.bundle", "ui_sprite_atlas_assets_all.bundle", "tooltips_assets_all.bundle"]
    bundles += ["defaultlocalgroup_assets_assets_thebazaar_art_ui_tooltip_quests_tooltip_quest_frame_tui.png.bundle",
                "defaultlocalgroup_assets_assets_thebazaar_art_ui_tooltip_quests_tooltip_quest_lock.png.bundle",
                "defaultlocalgroup_assets_karnok_icon.bundle", "defaultlocalgroup_assets_thedragons_icon.bundle"]
    bundles += [p.name for p in args.game_dir.glob("*flatrough*")]
    for filename in bundles:
        env = UnityPy.load(str(args.game_dir / filename))
        for obj in env.objects:
            if obj.type.name == "Texture2D":
                data = obj.read()
                if data.m_Name == "BazaarNumbers_Regular_SDF Atlas":
                    numbers_atlas = data.image
                    numbers_atlas.save(ROOT / "docs" / "numbers-sdf.png")
            elif obj.type.name == "MonoBehaviour" and filename == "fonts_assets_all.bundle":
                data = obj.read_typetree()
                if data.get("m_Name") == "BazaarNumbers_Regular_SDF":
                    numbers_meta = data
                    (ROOT / "docs" / "fontasset-BazaarNumbers_Regular_SDF.json").write_text(json.dumps(data, indent=2), encoding="utf-8")
                elif data.get("m_Name") == "TooltipTypography":
                    wanted = {"{keyword.heated}", "{keyword.chilled}", "{keyword.transform}", "{keyword.transforms}", "{keyword.upgrade}"}
                    selected = [c for c in data["_configurations"] if c["<KeywordKey>k__BackingField"] in wanted]
                    keyword_style_evidence = {
                        "sourceBundle": filename, "objectName": "TooltipTypography", "objectPathID": obj.path_id,
                        "iconScalePercentageSize": data["_iconScalePercentageSize"], "iconScaleVOffset": data["_iconScaleVOffset"],
                        "configurations": [],
                    }
                    for config in selected:
                        color = config["<Color>k__BackingField"]
                        keyword_style_evidence["configurations"].append({
                            "key": config["<KeywordKey>k__BackingField"],
                            "hex": "#"+"".join(f"{round(color[c]*255):02X}" for c in ["r","g","b"]),
                            "rgba": color, "iconName": config["<IconName>k__BackingField"], "nativeConfiguration": config,
                        })
            elif obj.type.name == "Sprite":
                data = obj.read()
                name = data.m_Name
                if filename == "fonts_assets_all.bundle" and name in ICON_MAP:
                    key = ICON_MAP[name]
                    source_im = data.image.convert("RGBA")
                    for output_key in [key] + aliases.get(key, []):
                        save(source_im, "icons-source", output_key, filename, name, manifest)
                        save(hd_icon(source_im), "icons", output_key, filename, name, manifest)
                        manifest["icons"][output_key]["sourceSize"] = list(source_im.size)
                        manifest["icons"][output_key]["enhancement"] = "2x Lanczos, mild RGB sharpen, unmodified smooth alpha"
                elif name in PORTRAIT_MAP:
                    save(data.image.convert("RGBA"), "hero-portraits", PORTRAIT_MAP[name], filename, name, manifest)
                    manifest["hero-portraits"][PORTRAIT_MAP[name]]["fallback"] = False
                    manifest["hero-portraits"][PORTRAIT_MAP[name]]["processing"] = "Unmodified native transparent color portrait; no generated content or upscaling"
                elif name in HERO_MAP:
                    im = data.image.convert("RGBA")
                    save(im, "heroes-source", HERO_MAP[name], filename, name, manifest)
                    tinted = Image.new("RGBA", im.size, "#94641c")
                    tinted.putalpha(im.getchannel("A"))
                    save(tinted, "heroes", HERO_MAP[name], filename, name, manifest)
                    manifest["heroes"][HERO_MAP[name]]["tint"] = "#94641c"
                    if HERO_MAP[name] == "neutral":
                        save(tinted, "hero-portraits", "neutral", filename, name, manifest)
                        manifest["hero-portraits"]["neutral"]["fallback"] = True
                        manifest["hero-portraits"]["neutral"]["processing"] = "Native neutral insignia fallback, tinted #94641c; no separate neutral color portrait found"
                elif "Card_PreviewFrame_" in name and "Skill" not in name:
                    save(data.image, "frames", name, filename, name, manifest, data.m_Border)
                elif "Card_PreviewGem_" in name:
                    save(data.image, "gems", name, filename, name, manifest, data.m_Border)
                elif name.startswith("Tooltip_Quest_"):
                    save(data.image, "ui", name, filename, name, manifest, data.m_Border)
                    if name == "Tooltip_Quest_Lock":
                        im = data.image.convert("RGBA")
                        save(im, "icons-source", "quest-lock", filename, name, manifest)
                        save(im, "icons", "quest-lock", filename, name, manifest)
                        manifest["icons"]["quest-lock"]["enhancement"] = f"Native {im.width}×{im.height} sprite, preserved without upscaling"
                elif name in ("Tooltip_Arrow_TUI", "Tooltip_BG_TUI", "Tooltip_Crit_Divider_TUI") or name.startswith("Tooltip_Legend") or any(name == f"Tooltip_{q}_{v}_TUI" for q in ["Bronze", "Silver", "Gold", "Diamond", "Legendary"] for v in ["Title", "Frame_Active", "Passive", "Clock", "Ammo", "Divider"]):
                    save(data.image, "ui", name, filename, name, manifest, data.m_Border)
    if not args.skip_fonts:
        from fontTools.ttLib import TTFont
        (ASSETS / "fonts").mkdir(exist_ok=True)
        for obj in UnityPy.load(str(args.game_dir / "fonts_cn_assets_all.bundle")).objects:
            if obj.type.name == "Font":
                data = obj.read()
                if data.m_FontData:
                    path = ASSETS / "fonts" / f"{data.m_Name}.ttf"
                    path.write_bytes(bytes(data.m_FontData))
                    font = TTFont(path)
                    family, style = font["name"].getDebugName(1), font["name"].getDebugName(2)
                    font.flavor = "woff2"
                    font.save(path.with_suffix(".woff2"))
                    manifest.setdefault("fonts", {})[data.m_Name] = {"path": f"/assets/fonts/{data.m_Name}.woff2", "family": family, "style": style, "weight": font["OS/2"].usWeightClass, "sourceBundle": "fonts_cn_assets_all.bundle", "subset": False}
    else:
        from fontTools.ttLib import TTFont
        for key in ["NotoSansSC-Bold", "NotoSerifSC-SemiBold"]:
            path = ASSETS / "fonts" / f"{key}.ttf"
            if path.exists():
                font = TTFont(path)
                manifest.setdefault("fonts", {})[key] = {"path": f"/assets/fonts/{key}.woff2", "family": font["name"].getDebugName(1), "style": font["name"].getDebugName(2), "weight": font["OS/2"].usWeightClass, "sourceBundle": "fonts_cn_assets_all.bundle", "subset": False, "glyphCount": len(font.getBestCmap())}
    # Legendary has one overarching main-frame Sprite rather than a separate
    # title Sprite. Its original top section supplies the matching title rim.
    main_path = ASSETS / "ui" / "Tooltip_Legendary_Frame_Main_TUI.png"
    if main_path.exists():
        title = Image.open(main_path).crop((0, 0, 820, 210))
        save(title, "ui", "Tooltip_Legendary_Title_TUI", "ui_sprite_atlas_assets_all.bundle", "Tooltip_Legendary_Frame_Main_TUI", manifest)
        manifest["ui"]["Tooltip_Legendary_Title_TUI"]["derivation"] = "Top 210px crop of original main frame; transparent center, no independent bottom border"
    if numbers_atlas is not None and numbers_meta is not None:
        numbers_font(numbers_atlas, numbers_meta)
        manifest.setdefault("fonts", {})["BazaarNumbersWeb-Regular"] = {"path": "/assets/fonts/BazaarNumbersWeb-Regular.woff2", "family": "Bazaar Numbers Web", "style": "Regular", "weight": 400, "sourceBundle": "fonts_assets_all.bundle", "method": "Original SDF contour reconstruction; original source TTF absent"}
    if keyword_style_evidence is not None:
        (ASSETS / "keyword-styles.json").write_text(json.dumps(keyword_style_evidence, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
        manifest["keywordStyles"] = {"path": "/assets/keyword-styles.json", "sourceBundle": "fonts_assets_all.bundle", "objectName": "TooltipTypography", "objectPathID": keyword_style_evidence["objectPathID"]}
    (ASSETS / "assets-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    entries = [(kind,key) for kind in ["icons","heroes"] for key in manifest[kind]]
    sheet = Image.new("RGB", (900, ((len(entries)+6)//7)*135), "#281c10")
    draw = ImageDraw.Draw(sheet)
    for i,(kind,key) in enumerate(entries):
        x,y = (i%7)*128,(i//7)*135
        im = Image.open(ASSETS / kind / f"{key}.png")
        im.thumbnail((92,98), Image.Resampling.LANCZOS)
        sheet.paste(im, (x+(128-im.width)//2,y+27), im)
        draw.text((x+4,y+5),key,fill="white")
    sheet.save(ROOT / "docs" / "native-assets-preview.png")
    portrait_sheet = Image.new("RGB", (960, 660), "#25282d")
    portrait_draw = ImageDraw.Draw(portrait_sheet)
    for i, key in enumerate(["neutral", "vanessa", "pygmalien", "dooley", "mak", "stelle", "jules", "karnok", "dragons"]):
        x, y = (i % 5)*192, (i//5)*330
        im = Image.open(ASSETS / "hero-portraits" / f"{key}.png")
        im.thumbnail((168,260), Image.Resampling.LANCZOS)
        portrait_sheet.paste(im, (x+(192-im.width)//2,y+30), im)
        label = key + (" (fallback)" if manifest["hero-portraits"][key]["fallback"] else "")
        portrait_draw.text((x+5,y+6),label,fill="white")
    portrait_sheet.save(ROOT / "docs" / "hero-portraits-preview.png")
    print({kind: len(entries) for kind,entries in manifest.items() if isinstance(entries,dict)})


if __name__ == "__main__":
    main()
