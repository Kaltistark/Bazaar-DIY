import {
  QUALITIES,
  SIZES,
  HEROES,
  KEYWORDS,
  BADGE_ORDER,
  TYPES,
} from "./data.js";
import {
  resolveTier,
  available,
  displayText,
  extractStats,
  questTarget,
  questComplete,
  questRewardRegion,
  defaultBackground,
} from "./model.js";
import { iconKeywordAtStart, keywordText } from "./keywords.js";
import { enchantmentRows } from "./enchantments.js";
const CREAM = "#ffe4b3",
  TITLE_FONT = "BazaarTitle",
  BODY_FONT = "BazaarBody",
  NUMBER_FONT = "BazaarNumbers";
// Approximate native TMP FaceDilate, Outline and tracking in Canvas.
// Exact source parameters and font hashes: docs/game-font-rendering.json.
const TEXT_STYLES = {
  active: { face: .016, outline: .083, color: "#030114", tracking: -.035, shadow: .04 },
  passive: { face: .016, outline: .083, color: "#030114", tracking: -.026, shadow: .04 },
  enchantment: { face: .016, outline: .080, color: "#000000", tracking: -.026, shadow: .035 },
  title: { face: .008, outline: .019, color: "#cc6e28", tracking: -.026, shadow: .025 },
  numbers: { face: .012, outline: .049, color: "#000000", tracking: 0, shadow: .04 },
};
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const imageFor = (src) =>
  new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
export class Renderer {
  constructor() {
    this.images = new Map();
    this.art = null;
    this.artSource = null;
    this.backgroundImage = null;
    this.lastLayout = null;
  }
  paintBackground(ctx, background = defaultBackground(), width, height) {
    ctx.fillStyle = background.color;
    ctx.fillRect(0, 0, width, height);
    if (background.useDefault) {
      // Keep the existing preview's elliptical gradient when using/resetting the default.
      ctx.save();
      const rx = Math.SQRT2 * width * 0.6, ry = Math.SQRT2 * height * 0.55;
      ctx.translate(width * 0.4, height * 0.45);
      ctx.scale(rx, ry);
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradient.addColorStop(0, "#242e31");
      gradient.addColorStop(0.65, "#151d21");
      gradient.addColorStop(1, "#151d21");
      ctx.fillStyle = gradient;
      ctx.fillRect(-width * 0.4 / rx, -height * 0.45 / ry, width / rx, height / ry);
      ctx.restore();
      return;
    }
    const image = this.backgroundImage;
    if (!background.image || !image) return;
    // Cover the card composition without stretching the uploaded image.
    const factor = Math.max(width / image.width, height / image.height);
    const w = image.width * factor, h = image.height * factor;
    ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
  }
  async load() {
    const list = [
      ["background", "/assets/ui/Tooltip_BG_TUI.png"],
      ["arrow", "/assets/ui/Tooltip_Arrow_TUI.png"],
      ["critDivider", "/assets/ui/Tooltip_Crit_Divider_TUI.png"],
      ["icon-fusion", "/assets/icons/fusion.png"],
      ["questDivider", "/assets/ui/Tooltip_Quest_Divider_TUI.png"],
      ["questVertical", "/assets/ui/Tooltip_Quest_DividerVertical_TUI.png"],
      ["questFrame", "/assets/ui/Tooltip_Quest_Frame_TUI.png"],
      ["icon-quest-lock", "/assets/icons/quest-lock.png"],
    ];
    for (const q of QUALITIES) {
      for (const s of Object.keys(SIZES))
        list.push([
          `frame-${q.id}-${s}`,
          `/assets/frames/Card_PreviewFrame_${cap(q.id)}_${cap(s)}_TUI.png`,
        ]);
      for (const suffix of [
        "Frame_Main",
        "Title",
        "Frame_Active",
        "Passive",
        "Clock",
        "Ammo",
      ])
        list.push([
          `${q.id}-${suffix}`,
          `/assets/ui/Tooltip_${cap(q.id)}_${suffix}_TUI.png`,
        ]);
    }
    for (const k of KEYWORDS.filter((k) => k.icon))
      list.push([`icon-${k.icon}`, `/assets/icons/${k.icon}.png`]);
    for (const [id] of HEROES)
      list.push([`hero-${id}`, `/assets/heroes/${id}.png`]);
    for (const id of [...BADGE_ORDER, "lifesteal"])
      list.push([
        `gem-${id}`,
        `/assets/gems/Card_PreviewGem_${id === "regen" ? "Regen" : cap(id)}_TUI.png`,
      ]);
    await Promise.all(
      list.map(async ([id, url]) => {
        const im = await imageFor("." + url);
        if (im) this.images.set(id, im);
      }),
    );
    await Promise.allSettled(
      [
        new FontFace(BODY_FONT, "url(./assets/fonts/NotoSansSC-Bold.woff2)", {
          weight: "700",
        }),
        new FontFace(
          TITLE_FONT,
          "url(./assets/fonts/NotoSerifSC-SemiBold.woff2)",
          { weight: "600" },
        ),
        new FontFace(
          NUMBER_FONT,
          "url(./assets/fonts/BazaarNumbersWeb-Regular.woff2)",
          { weight: "400" },
        ),
      ].map(async (f) => document.fonts.add(await f.load())),
    );
  }
  async setArt(source) {
    if (source === this.artSource) return;
    this.artSource = source;
    this.art = source ? await imageFor(source) : null;
  }
  image(ctx, key, x, y, w, h) {
    const im = this.images.get(key);
    if (im) ctx.drawImage(im, x, y, w, h);
    return !!im;
  }
  tinted(key, color) {
    const cacheKey = `${key}-${color}`;
    if (this.images.has(cacheKey)) return cacheKey;
    const image = this.images.get(key);
    if (!image) return key;
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.images.set(cacheKey, canvas);
    return cacheKey;
  }
  nine(ctx, key, x, y, w, h, border = 100, dest = 22) {
    const im = this.images.get(key);
    if (!im) return false;
    const b =
      typeof border === "number" ? [border, border, border, border] : border;
    const d = typeof dest === "number" ? [dest, dest, dest, dest] : dest;
    const sx = [0, b[0], im.width - b[2], im.width],
      sy = [0, b[1], im.height - b[3], im.height],
      dx = [x, x + d[0], x + w - d[2], x + w],
      dy = [y, y + d[1], y + h - d[3], y + h];
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 3; col++) {
        const sw = sx[col + 1] - sx[col],
          sh = sy[row + 1] - sy[row],
          dw = dx[col + 1] - dx[col],
          dh = dy[row + 1] - dy[row];
        if (sw > 0 && sh > 0 && dw > 0 && dh > 0)
          ctx.drawImage(im, sx[col], sy[row], sw, sh, dx[col], dy[row], dw, dh);
      }
    return true;
  }
  outlineText(
    ctx,
    text,
    x,
    y,
    color,
    size = 22,
    align = "left",
    font = BODY_FONT,
    role = "active",
  ) {
    if (/^-?\d[\d.%]*$/.test(text)) font = NUMBER_FONT;
    this.textFont(ctx, size, font, role);
    const style = TEXT_STYLES[font === TITLE_FONT ? "title" : font === NUMBER_FONT ? "numbers" : role];
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round";
    ctx.lineWidth = size * style.outline;
    ctx.strokeStyle = style.color;
    ctx.shadowColor = "#100a12d9";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = Math.min(1.5, size * style.shadow);
    ctx.shadowOffsetY = Math.min(1.5, size * style.shadow);
    ctx.strokeText(text, x, y);
    ctx.shadowColor = "transparent";
    ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
    ctx.lineWidth = size * style.face;
    ctx.strokeStyle = color;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
  textFont(ctx, size, font = BODY_FONT, role = "active") {
    const style = TEXT_STYLES[font === TITLE_FONT ? "title" : font === NUMBER_FONT ? "numbers" : role];
    ctx.font = `${font === TITLE_FONT ? 600 : font === NUMBER_FONT ? 400 : 700} ${size}px "${font}", "Microsoft YaHei", sans-serif`;
    ctx.letterSpacing = `${size * style.tracking}px`;
  }
  rich(parts) {
    const runs = [];
    const aliases = KEYWORDS.flatMap((k) =>
      k.aliases.map((a) => ({ a, k })),
    ).sort((a, b) => b.a.length - a.a.length);
    for (const part of parts) {
      if (part.type === "number") {
        runs.push({ ...part, kind: "number", color: CREAM });
        continue;
      }
      let rest = part.text;
      while (rest) {
        const marker = iconKeywordAtStart(rest);
        if (marker) {
          const k = marker.keyword;
          runs.push({ kind: "word", text: "", color: k.color, icon: k.icon, id: k.id, iconOnly: true });
          rest = rest.slice(marker.length);
          continue;
        }
        let matched = aliases.find(
          ({ a, k }) =>
            rest.startsWith(a) &&
            !(k.id === "gold" && /^黄金(?:级|品质)/.test(rest)),
        );
        if (matched) {
          const { a, k } = matched;
          runs.push({
            kind: "word",
            text: a,
            color: k.color,
            icon: k.icon,
            id: k.id,
          });
          rest = rest.slice(a.length);
          continue;
        }
        const type = TYPES.find((t) => rest.startsWith(t));
        if (type) {
          runs.push({ kind: "word", text: type, color: "#b3baff" });
          rest = rest.slice(type.length);
          continue;
        }
        const phrase = ["此物品", "物品", "相邻", "敌人", "一件"].find((t) => rest.startsWith(t));
        if (phrase) {
          runs.push({ kind: "word", text: phrase, color: CREAM });
          rest = rest.slice(phrase.length);
          continue;
        }
        const ch = [...rest][0];
        runs.push({ kind: "text", text: ch, color: CREAM });
        rest = rest.slice(ch.length);
      }
    }
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      if (r.kind !== "number") continue;
      const next = runs[i + 1],
        prev = runs[i - 1];
      if (/^[%％]/.test(next?.text ?? "")) {
        if (r.values) r.values = r.values.map(value => ({ ...value, color: CREAM }));
        continue;
      }
      if (next?.kind === "word" && next.id) {
        r.color = next.color;
        if (!next.iconOnly) {
          r.icon = next.icon;
          next.icon = null;
        }
      } else if (prev?.kind === "word" && prev.id) {
        r.color = prev.color;
        if (!prev.iconOnly && (prev.id === "heal" || prev.id === "regen")) {
          r.icon = prev.icon;
          prev.icon = null;
        }
      } else {
        const context = runs
          .slice(Math.max(0, i - 7), i)
          .reverse()
          .find((v) => v.id);
        if (context) r.color = context.color;
      }
      if (next?.id === "health" && prev?.id === "heal") {
        r.color = prev.color;
        r.icon = "heal";
        next.icon = null;
        prev.icon = null;
      }
      if (next?.text === "次" || next?.text === "秒") r.color = CREAM;
    }
    // Duration icons sit beside the seconds, after the target phrase.
    // Counts in quest conditions keep their icon beside the keyword.
    for (let i = 0; i < runs.length; i++) {
      const word = runs[i];
      if (word.iconOnly || !word.icon || !["charge", "haste", "slow", "freeze", "regen", "heal"].includes(word.id)) continue;
      for (let j = i + 1; j < runs.length; j++) {
        const run = runs[j];
        if (["。", "；", "\n", "，"].includes(run.text) || run.id) break;
        if (run.kind === "number" && !/^[%％]/.test(runs[j + 1]?.text ?? "") && (runs[j + 1]?.text === "秒" ||
          (["regen", "heal"].includes(word.id) && runs[j + 1]?.text !== "次"))) {
          run.icon = word.icon;
          word.icon = null;
          break;
        }
      }
    }
    return runs;
  }
  badgeGem(id, project, tier) {
    if (id !== "damage" || !project.types.includes("武器")) return `gem-${id}`;
    const text = [
      ...(tier.active ? tier.effects : []),
      ...(tier.passiveEnabled ? [tier.passive] : []),
    ].map(keywordText).join("\n");
    const intrinsic = text.split(/[。；;！!\n]/).some(clause =>
      /^(?:(?:此物品|此武器)(?:拥有|具有|带有|自带|获得)?\s*[:：,，]?\s*)?(?:获得)?吸血\s*$/.test(clause.trim()));
    return intrinsic ? "gem-lifesteal" : "gem-damage";
  }
  units(ctx, runs, size, role = "active", font = BODY_FONT) {
    const units = [];
    const measure = (text) => {
      const numeric = /^-?\d[\d.%]*$/.test(text);
      this.textFont(ctx, size, numeric && font !== TITLE_FONT ? NUMBER_FONT : font, role);
      return ctx.measureText(text).width;
    };
    for (const r of runs) {
      if (r.values) {
        const numberSize = size * 0.94;
        this.textFont(ctx, numberSize, NUMBER_FONT);
        const width = r.values.reduce((sum, v) => sum + ctx.measureText(v.value).width, 0) +
          (r.values.length - 1) * numberSize * 1.02 + numberSize * 0.24;
        units.push({ values: r.values, icon: r.icon, numberSize,
          width: width + (r.icon ? size * 1.35 : 0), color: r.color });
      } else {
        const pieces = ["number", "word"].includes(r.kind)
          ? [r.text]
          : [...r.text];
        for (const [index, text] of pieces.entries())
          units.push({
            text,
            iconOnly: !!r.iconOnly,
            icon: index === 0 ? r.icon : null,
            color: r.color,
            width: measure(text) + (index === 0 && r.icon ? size * 1.35 : 0),
            newline: text === "\n",
          });
      }
    }
    return units;
  }
  wrap(ctx, runs, width, size = 22, role = "active", font = BODY_FONT) {
    const units = this.units(ctx, runs, size, role, font),
      lines = [[]];
    let used = 0;
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      let suffixWidth = 0;
      for (let j = i + 1; j < units.length && (units[j].iconOnly || /^(?:秒|次|%|。|，|；|：|）)$/.test(units[j].text)); j++)
        suffixWidth += units[j].width;
      if (unit.values && unit.width > width - suffixWidth) unit.width = Math.max(size, width - suffixWidth);
      if (unit.newline) {
        lines.push([]);
        used = 0;
        continue;
      }
      // Reserve the entire suffix, e.g. "10%.", not just the first glyph.
      // Otherwise the final punctuation can push '%' onto its own line.
      let required = unit.width;
      for (let j = i + 1; j < units.length && (units[j].iconOnly || /^(?:秒|次|%|。|，|；|：|）)$/.test(units[j].text)); j++)
        required += units[j].width;
      if (used + required > width && lines.at(-1).length) {
        lines.push([]);
        used = 0;
      }
      lines.at(-1).push(unit);
      used += unit.width;
    }
    return lines;
  }
  icon(ctx, id, x, y, size) {
    if (this.image(ctx, `icon-${id}`, x, y, size, size)) return;
    const symbols = {
      damage: "✹",
      heal: "✚",
      health: "✚",
      regen: "✚",
      shield: "◈",
      burn: "♨",
      poison: "☠",
      haste: "◴",
      charge: "ϟ",
      freeze: "❄",
      crit: "⊕",
      ammo: "▥",
      flying: "➤",
      tempo: "♪",
      destroy: "◀",
      multicast: "»",
    };
    this.outlineText(
      ctx,
      symbols[id] || "◆",
      x + size / 2,
      y + size * 0.82,
      KEYWORDS.find((k) => k.id === id)?.color || CREAM,
      size,
      "center",
    );
  }
  paintLockedReward(ctx, reward, x, y, width) {
    this.nine(ctx, "questFrame", x, y, width, reward.h, [22, 24, 3, 24], [9, 10, 2, 10]);
    ctx.save();
    if (reward.locked) ctx.globalAlpha = 0.49;
    this.image(ctx, reward.locked ? this.tinted("icon-quest-lock", "#ffcd92") : "arrow",
      x + 10, y + (reward.h - (reward.locked ? 28 : 18)) / 2, 23, reward.locked ? 28 : 18);
    this.paintLines(ctx, reward.lines, x + 44, y + 29, 20, 28);
    ctx.restore();
  }
  paintLines(ctx, lines, x, y, size = 22, lineHeight = 32, role = "active") {
    for (const line of lines) {
      let cursor = x;
      for (const unit of line) {
        if (unit.icon)
          this.icon(ctx, unit.icon, cursor, y - size * 1.07, size * 1.32);
        if (unit.text)
          this.outlineText(
            ctx,
            unit.text,
            cursor + (unit.icon ? size * 1.35 : 0),
            y,
            unit.color,
            size,
            "left",
            BODY_FONT,
            role,
          );
        if (unit.values) {
          const lead = unit.icon ? size * 1.35 : 0;
          this.sequence(ctx, unit.values, cursor + lead + (unit.width - lead) / 2,
            y, unit.numberSize, unit.width - lead);
        }
        cursor += unit.width;
      }
      y += lineHeight;
    }
    return y;
  }
  sequence(ctx, values, centerX, y, size, maxWidth) {
    const measure = (fs) => {
      this.textFont(ctx, fs, NUMBER_FONT);
      return (
        values.reduce((sum, v) => sum + ctx.measureText(v.value).width, 0) +
        (values.length - 1) * fs * 1.02 + fs * 0.24
      );
    };
    let width = measure(size);
    if (width > maxWidth) {
      size *= maxWidth / width;
      width = measure(size);
    }
    let x = centerX - width / 2 + size * 0.12;
    values.forEach((v, i) => {
      if (i) {
        this.icon(ctx, "fusion", x + size * 0.18, y - size * 0.76, size * 0.64);
        x += size * 1.02;
      }
      this.textFont(ctx, size, NUMBER_FONT);
      const w = ctx.measureText(v.value).width;
      this.outlineText(ctx, v.value, x, y, v.color, size);
      x += w;
    });
  }
  panel(ctx, quality, kind, x, y, w, h) {
    ctx.save();
    cutRect(ctx, x + 3, y + 3, w - 6, h - 6, kind === "title" ? 15 : 11);
    ctx.clip();
    ctx.fillStyle = "#201307";
    ctx.fillRect(x, y, w, h);
    this.image(ctx, "background", x, y, w, h);
    ctx.restore();
    let ok = false;
    if (kind === "title") {
      ok = this.nine(
        ctx,
        `${quality}-Title`,
        x,
        y,
        w,
        h,
        [80, 50, 80, 10],
        [25, 19, 25, 4],
      );
      // Title sprites include a multicolored fill. Keep their outline while
      // using the same opaque brown texture as the rest of the tooltip.
      ctx.save();
      cutRect(ctx, x + 5, y + 6, w - 10, h - 10, 14);
      ctx.clip();
      ctx.fillStyle = "#201307";
      ctx.fillRect(x, y, w, h);
      this.image(ctx, "background", x, y, w, h);
      ctx.restore();
    } else if (kind === "active")
      ok = this.nine(ctx, `${quality}-Frame_Active`, x, y, w, h, 120, 28);
    else
      ok = this.nine(
        ctx,
        `${quality}-Passive`,
        x,
        y,
        w,
        h,
        [85, 0, 85, 170],
        [25, 0, 25, 38],
      );
    if (!ok) {
      ctx.strokeStyle = QUALITIES.find((q) => q.id === quality).color;
      ctx.lineWidth = 2;
      cutRect(ctx, x + 2, y + 2, w - 4, h - 4, 12);
      ctx.stroke();
    }
  }
  mainFrame(ctx, quality, d, l, y) {
    const borders = {
      bronze: [80, 46, 80, 47], silver: [80, 83, 80, 86],
      gold: [80, 112, 80, 113], diamond: [80, 113, 80, 48],
      legendary: [80, 97, 80, 110],
    }[quality];
    // The active box covers the main frame's lower decorations when there is
    // no passive section, while the upper ornaments remain beside the name.
    const height = l.titleH + l.activeH + l.passiveH + l.enchantmentH -
      2 * (Number(l.activeH > 0) + Number(!!l.passiveH) + Number(!!l.enchantmentH));
    const vertical = Math.min(0.43, height / (borders[1] + borders[3]));
    this.nine(ctx, `${quality}-Frame_Main`, d.x, y, d.w, height, borders,
      [34, borders[1] * vertical, 34, borders[3] * vertical]);
  }
  layout(ctx, project, current, mode, stacked = false, includeEnchantments = false) {
    const tier = resolveTier(
      project,
      mode === "all" ? project.initial : current,
    );
    if (mode === "all") {
      const values = available(project).map((q) => resolveTier(project, q.id));
      tier.ammoEnabled = values.some((t) => t.ammoEnabled);
      tier.critEnabled = values.some((t) => t.critEnabled);
      tier.multicastEnabled = values.some(t => t.multicastEnabled);
      if (tier.cd === "") tier.cd = values.find((t) => t.cd !== "")?.cd || "";
    }
    const quality = mode === "all" ? project.initial : current;
    const size = 26,
      lineHeight = 34,
      descW = 440;
    const ammoValues = (
      mode === "all"
        ? available(project)
        : [QUALITIES.find((q) => q.id === current)]
    ).map((q) => {
      const t = resolveTier(project, q.id);
      return { value: t.ammoEnabled ? String(t.ammo) : "—", color: q.color };
    });
    const ammoVariable = ammoValues.some(
      (v) => v.value !== ammoValues[0].value,
    );
    const ammoW = ammoVariable
      ? Math.min(
          130,
          Math.max(
            70,
            ammoValues.reduce((n, v) => n + v.value.length * 10, 0) +
              (ammoValues.length - 1) * 11 +
              18,
          ),
        )
      : 43;
    const effectWidth = descW - 120 - (tier.ammoEnabled ? Math.max(0, ammoW / 2 - 24) : 0);
    const effectLines = tier.active
      ? tier.effects.map((_, i) =>
          this.wrap(
            ctx,
            this.rich(displayText(project, current, (t) => t.effects[i], mode)),
            effectWidth,
            size,
          ),
        )
      : [];
    if (tier.multicastEnabled) {
      const runs = [
        { kind: "word", text: "多重释放：", color: CREAM },
        ...this.rich(displayText(project, current, t => `（多重释放）${t.multicastEnabled ? t.multicast : 1}`, mode)),
      ];
      effectLines.push(this.wrap(ctx, runs, effectWidth, size));
    }
    let activeH = tier.active || tier.multicastEnabled
      ? Math.max(
          88,
          effectLines.reduce((sum, l) => sum + l.length * lineHeight + 15, 0) +
            21,
        ) + (tier.critEnabled ? 55 : 0)
      : 0;
    const passiveParts = displayText(project, current, (t) => t.passiveEnabled ? t.passive : "", mode),
      passiveLines = tier.passiveEnabled && tier.passive
        ? this.wrap(ctx, this.rich(passiveParts), descW - 44, size, "passive")
        : [];
    const quests = tier.quests.map((q, i) => {
      const qualities =
        mode === "all"
          ? available(project)
          : [QUALITIES.find((q) => q.id === current)];
      const targets = qualities.map((quality) => ({
        value: String(
          questTarget(resolveTier(project, quality.id).quests[i] || q),
        ),
        color: quality.color,
      }));
      const variable = targets.some((t) => t.value !== targets[0].value);
      const counterW = Math.min(
        120,
        Math.max(
          35,
          variable
            ? targets.reduce((n, v) => n + v.value.length * 8, 0) +
                (targets.length - 1) * 11 +
                8
            : Math.max(
                String(q.progress).length * 19,
                targets[0].value.length * 9 + 8,
              ),
        ),
      );
      const textW = descW - 96 - counterW;
      const condition = this.wrap(
        ctx,
        this.rich(
          displayText(
            project,
            current,
            (t) => t.quests[i]?.condition || "",
            mode,
          ),
        ),
        textW,
        26,
      );
      const reward = this.wrap(
        ctx,
        this.rich(
          displayText(project, current, (t) => t.quests[i]?.reward || "", mode),
        ),
        textW,
        19,
      );
      const h = Math.max(110, condition.length * 34 + reward.length * 26 + 42);
      const kw = KEYWORDS.find(
        (k) => k.icon && k.aliases.some((a) => q.reward.includes(a)),
      );
      return {
        q,
        condition,
        reward,
        h,
        targets,
        variable,
        counterW,
        icon: q.icon === "auto" ? kw?.icon || "value" : q.icon,
      };
    });
    const lockedRewards = quests
      .filter((row) => row.q.locked)
      .map((row) => {
        const index = tier.quests.indexOf(row.q);
        const runs = this.rich(
          displayText(
            project,
            current,
            (t) => t.quests[index]?.reward || "",
            mode,
          ),
        );
        const locked = !questComplete(row.q);
        if (locked)
          for (const r of runs) {
            r.color = "#ffcd92";
            if (r.values)
              r.values = r.values.map((v) => ({ ...v, color: "#ffcd92" }));
          }
        const region = questRewardRegion(row.q);
        const lines = this.wrap(ctx, runs, descW - (region === "active" ? 165 : 85), 20);
        return { lines, locked, region, h: lines.length * 28 + 26 };
      });
    const activeLockedRewards = lockedRewards.filter(r => r.region === "active");
    const passiveLockedRewards = lockedRewards.filter(r => r.region === "passive");
    if (activeLockedRewards.length) {
      if (!activeH) activeH = 24 + (tier.critEnabled ? 55 : 0);
      activeH += activeLockedRewards.reduce((sum, r) => sum + r.h + 10, 0);
    }
    const passiveH = quests.length
      ? (passiveLines.length ? passiveLines.length * lineHeight + 32 : 20) +
        passiveLockedRewards.reduce((sum, r) => sum + r.h + 10, 0) +
        quests.reduce((sum, r) => sum + r.h, 0) +
        25
      : passiveLines.length
        ? passiveLines.length * lineHeight + 44
        : 0;
    const enchantments = includeEnchantments ? enchantmentRows(project).map(row => {
      const runs = [
        { kind: "word", text: `${row.name}：`, color: row.color },
        ...this.rich(displayText(project, current, () => row.text, "current")),
      ];
      const lines = this.wrap(ctx, runs, descW - 46, 18, "enchantment");
      return { lines, h: lines.length * 25 + 5 };
    }) : [];
    const enchantmentH = enchantments.length ?
      enchantments.reduce((sum, row) => sum + row.h, 0) + 42 : 0;
    const title = project.name || "未命名物品";
    let titleSize = 38;
    this.textFont(ctx, titleSize, TITLE_FONT);
    if (ctx.measureText(title).width > descW - 112) titleSize = 30;
    const titleLines = this.wrap(
      ctx,
      [{ kind: "text", text: title, color: CREAM }],
      descW - 110,
      titleSize,
      "title",
      TITLE_FONT,
    );
    const titleH = Math.max(80, titleLines.length * (titleSize + 8) + 26);
    let tagH = 30,
      tagW = 0;
    ctx.font = `700 17px "${BODY_FONT}"`;
    for (const type of [SIZES[project.size].name, ...project.types]) {
      const w = ctx.measureText(type).width + 21;
      if (tagW + w > descW && tagW) {
        tagH += 29;
        tagW = 0;
      }
      tagW += w;
    }
    const tooltipScale = 1.3;
    const artScale = stacked
      ? Math.min(420 / SIZES[project.size].width, 300 / 520)
      : 380 / 520;
    const cardW = SIZES[project.size].width * artScale,
      cardH = 520 * artScale,
      descH = (tagH + titleH + activeH + passiveH + enchantmentH) * tooltipScale;
    const margin = 32;
    const extraRight = tier.ammoEnabled ? Math.max(0, ammoW * tooltipScale / 2 - margin) : 0;
    const width =
      (stacked
        ? Math.max(cardW, descW * tooltipScale) + margin * 2 + 48
        : cardW + descW * tooltipScale + margin * 2 + 72) + extraRight;
    const height = stacked
      ? cardH + descH + margin * 2 + 60
      : Math.max(cardH + 30, descH) + margin * 2;
    const art = {
      x: stacked ? (width - cardW) / 2 : margin,
      y: stacked ? margin + 24 : (height - cardH) / 2 + 10,
      w: cardW,
      h: cardH,
      scale: artScale,
    };
    const desc = {
      x: stacked ? (width - descW * tooltipScale) / 2 + 24 : art.x + cardW + 72,
      y: stacked ? art.y + cardH + 40 : (height - descH) / 2,
      w: descW * tooltipScale,
      h: descH,
    };
    return {
      width,
      height,
      art,
      desc,
      quality,
      tier,
      size,
      lineHeight,
      effectLines,
      effectWidth,
      activeH,
      passiveLines,
      passiveH,
      enchantments,
      enchantmentH,
      quests,
      lockedRewards: passiveLockedRewards,
      activeLockedRewards,
      title,
      titleSize,
      titleLines,
      titleH,
      tagH,
      ammoValues,
      ammoVariable,
      ammoW,
      tooltipScale,
    };
  }
  render(
    canvas,
    project,
    current,
    {
      mode = "current",
      scale = 1,
      background = "transparent",
      stacked = false,
      includeEnchantments = false,
    } = {},
  ) {
    let ctx = canvas.getContext("2d");
    const l = this.layout(ctx, project, current, mode, stacked, includeEnchantments);
    if (
      l.height * scale > 16384 ||
      l.width * l.height * scale * scale > 65_000_000
    )
      throw new Error("内容过长，请减少文字或选择较低清晰度");
    canvas.width = Math.ceil(l.width * scale);
    canvas.height = Math.ceil(l.height * scale);
    ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (background === "preview") {
      this.paintBackground(ctx, project.background, l.width, l.height);
    } else if (background === "dark") {
      ctx.fillStyle = "#141b1e";
      ctx.fillRect(0, 0, l.width, l.height);
    }
    const { art: a, tier, quality } = l;
    const d = { x: 0, y: 0, w: l.desc.w / l.tooltipScale, h: l.desc.h / l.tooltipScale };
    ctx.save();
    const inset = a.scale;
    cutRect(
      ctx,
      a.x + 20 * inset,
      a.y + 21 * inset,
      a.w - 40 * inset,
      a.h - 43 * inset,
      9 * inset,
    );
    ctx.clip();
    if (this.art) {
      const fit =
        Math.max(
          (a.w - 40 * inset) / this.art.width,
          (a.h - 43 * inset) / this.art.height,
        ) * project.crop.zoom;
      const dw = this.art.width * fit,
        dh = this.art.height * fit;
      ctx.drawImage(
        this.art,
        a.x + a.w / 2 - dw / 2 + project.crop.x * a.w,
        a.y + a.h / 2 - dh / 2 + project.crop.y * a.h,
        dw,
        dh,
      );
    } else {
      const grad = ctx.createLinearGradient(a.x, a.y, a.x + a.w, a.y + a.h);
      grad.addColorStop(0, "#283b3b");
      grad.addColorStop(0.6, "#172526");
      grad.addColorStop(1, "#332b22");
      ctx.fillStyle = grad;
      ctx.fillRect(a.x, a.y, a.w, a.h);
    }
    ctx.restore();
    this.image(ctx, `frame-${quality}-${project.size}`, a.x, a.y, a.w, a.h);
    const stats = extractStats(tier),
      ids = BADGE_ORDER.filter((id) => stats[id] !== undefined),
      badgeW = Math.min(
        92 * inset,
        (a.w - 14 * inset) / Math.max(1, ids.length),
      ),
      badgeH = 47 * inset,
      start = a.x + (a.w - ids.length * badgeW) / 2;
    ids.forEach((id, i) => {
      const x = start + i * badgeW;
      this.image(ctx, this.badgeGem(id, project, tier), x, a.y - 19 * inset, badgeW, badgeH);
      this.outlineText(
        ctx,
        String(stats[id]),
        x + badgeW / 2,
        a.y + 16 * inset,
        "#fff8ed",
        Math.min(34 * inset, badgeW * 0.43),
        "center",
      );
    });
    ctx.save();
    ctx.translate(l.desc.x, l.desc.y);
    ctx.scale(l.tooltipScale, l.tooltipScale);
    let tx = d.x,
      ty = d.y;
    ctx.font = `700 17px "${BODY_FONT}",sans-serif`;
    for (const type of [SIZES[project.size].name, ...project.types]) {
      ctx.font = `700 17px "${BODY_FONT}"`;
      const w = ctx.measureText(type).width + 16;
      if (tx + w > d.x + d.w) {
        tx = d.x;
        ty += 29;
      }
      ctx.fillStyle = "#1c182ad9";
      roundRect(ctx, tx, ty, w, 26, 5);
      ctx.fill();
      this.outlineText(ctx, type, tx + 8, ty + 20, "#aeb9fb", 17);
      tx += w + 5;
    }
    let y = d.y + l.tagH;
    const frameY = y;
    this.panel(ctx, quality, "title", d.x, y, d.w, l.titleH);
    this.mainFrame(ctx, quality, d, l, frameY);
    l.titleLines.forEach((line, i) =>
      this.outlineText(
        ctx,
        line.map((u) => u.text).join(""),
        d.x + 24,
        y + (l.titleH - l.titleLines.length * (l.titleSize + 8)) / 2 + l.titleSize + i * (l.titleSize + 8),
        CREAM,
        l.titleSize,
        "left",
        TITLE_FONT,
      ),
    );
    const hero = this.images.get(`hero-${project.hero}`);
    if (hero) {
      const side = 55,
        ratio = Math.min(side / hero.width, side / hero.height);
      ctx.drawImage(
        hero,
        d.x + d.w - 70 + (side - hero.width * ratio) / 2,
        y + (l.titleH - hero.height * ratio) / 2,
        hero.width * ratio,
        hero.height * ratio,
      );
    }
    y += l.titleH - 2;
    if (l.activeH) {
      this.panel(ctx, quality, "active", d.x, y, d.w, l.activeH);
      const contentH =
        l.effectLines.reduce(
          (sum, lines) => sum + lines.length * l.lineHeight,
          0,
        ) +
        Math.max(0, l.effectLines.length - 1) * 15;
      const bodyH = l.activeH - (tier.critEnabled ? 55 : 0) -
        l.activeLockedRewards.reduce((sum, reward) => sum + reward.h + 10, 0);
      const textWidth = Math.max(
        0,
        ...l.effectLines
          .flat()
          .map((line) => line.reduce((sum, u) => sum + u.width, 0)),
      );
      const textX =
        d.x + 96 + Math.min(28, Math.max(0, (l.effectWidth - textWidth) / 2));
      let ey = y + (bodyH - contentH) / 2 + l.size + 4;
      l.effectLines.forEach((lines) => {
        this.image(ctx, "arrow", textX - 27, ey - 17, 16, 14);
        this.paintLines(ctx, lines, textX, ey, l.size, l.lineHeight);
        ey += lines.length * l.lineHeight + 15;
      });
      let lockedY = y + bodyH;
      for (const reward of l.activeLockedRewards) {
        this.paintLockedReward(ctx, reward, d.x + 84, lockedY, d.w - 103);
        lockedY += reward.h + 10;
      }
      if (tier.critEnabled) {
        const cy = y + l.activeH - 40;
        this.image(ctx, "critDivider", d.x + 40, cy - 12, d.w - 65, 2);
        const runs = [
            { kind: "text", text: "暴击率：", color: "#f34137" },
            ...this.rich([
              ...displayText(
                project,
                current,
                (t) => `${t.critEnabled ? t.crit : 0}%`,
                mode,
              ),
            ]).map((r, i) => ({
              ...r,
              color: "#f34137",
              icon: i === 0 ? "crit" : r.icon,
            })),
          ],
          lines = this.wrap(ctx, runs, d.w - 80, 24);
        const width = Math.max(0, ...lines.map((line) => line.reduce((sum, u) => sum + u.width, 0)));
        this.paintLines(ctx, lines, d.x + (d.w - width) / 2, cy + 17, 24, 32);
      }
      if (tier.active && tier.cd !== "") {
        const clockW = 122,
          clockH = 112,
          cx = d.x - 50,
          cy = y + (l.activeH - clockH) / 2;
        this.image(ctx, `${quality}-Clock`, cx, cy, clockW, clockH);
        const values = (
          mode === "all"
            ? available(project)
            : [QUALITIES.find((q) => q.id === current)]
        ).map((q) => ({
          value: resolveTier(project, q.id).cd,
          color: q.color,
        }));
        const same = values.every(
          (v) => Number(v.value) === Number(values[0].value),
        );
        if (same) {
          const text = Number(values[0].value).toFixed(1);
          ctx.font = `400 41px "${NUMBER_FONT}"`;
          const size = Math.min(41, 41 * (clockW * 0.68) / ctx.measureText(text).width);
          this.outlineText(
            ctx,
            text,
            cx + clockW * 0.45,
            cy + 63 - (41 - size) * 0.36,
            "#ffffff",
            size,
            "center",
          );
        } else {
          this.sequence(
            ctx,
            values.map((v) => ({
              ...v,
              value: v.value === "" ? "—" : String(Number(v.value)),
            })),
            cx + clockW * 0.45,
            cy + 55,
            20,
            87,
          );
        }
        this.outlineText(
          ctx,
          "秒",
          cx + clockW * 0.45,
          cy + 85,
          "#e8a35e",
          19,
          "center",
        );
      }
      if (tier.ammoEnabled) {
        const ax = d.x + d.w - l.ammoW / 2,
          ay = y + 12;
        this.image(ctx, `${quality}-Ammo`, ax, ay, l.ammoW, 76);
        this.icon(ctx, "ammo", ax + l.ammoW / 2 - 12, ay + 8, 24);
        if (!l.ammoVariable)
          this.outlineText(
            ctx,
            l.ammoValues[0].value,
            ax + l.ammoW / 2,
            ay + 59,
            "#ffad28",
            24,
            "center",
          );
        else
          this.sequence(
            ctx,
            l.ammoValues,
            ax + l.ammoW / 2,
            ay + 56,
            16,
            l.ammoW - 10,
          );
      }
      y += l.activeH - 2;
    }
    if (l.passiveH) {
      this.panel(ctx, quality, "passive", d.x, y, d.w, l.passiveH);
      ctx.save();
      ctx.beginPath();
      ctx.rect(d.x, y, d.w, l.passiveH);
      ctx.clip();
      this.mainFrame(ctx, quality, d, l, frameY);
      ctx.restore();
      this.paintLines(
        ctx,
        l.passiveLines,
        d.x + 23,
        y + (l.quests.length
          ? l.size + 12
          : (l.passiveH - l.passiveLines.length * l.lineHeight) / 2 + l.size + 4),
        l.size,
        l.lineHeight,
        "passive",
      );
      let qy =
        y +
        (l.passiveLines.length
          ? l.passiveLines.length * l.lineHeight + 32
          : 20);
      for (const reward of l.lockedRewards) {
        this.paintLockedReward(ctx, reward, d.x + 19, qy, d.w - 38);
        qy += reward.h + 10;
      }
      for (const row of l.quests) {
        this.nine(
          ctx,
          this.tinted("questDivider", "#a67938"),
          d.x + 16,
          qy,
          d.w - 32,
          7,
          [31, 0, 34, 0],
          [10, 0, 11, 0],
        );
        const textH = row.condition.length * 34 + row.reward.length * 26;
        const textY = qy + 8 + (row.h - 8 - textH) / 2 + 25;
        this.paintLines(ctx, row.condition, d.x + 23, textY, 26, 34);
        this.paintLines(
          ctx,
          row.reward,
          d.x + 23,
          textY + row.condition.length * 34 - 4,
          19,
          26,
        );
        const iconX = d.x + d.w - 43,
          midY = qy + row.h / 2 + 3;
        this.image(
          ctx,
          this.tinted("questVertical", "#a67938"),
          iconX - 17,
          midY - 23,
          10,
          46,
        );
        this.icon(ctx, row.icon, iconX, midY - 14, 27);
        const countX = iconX - 27 - row.counterW / 2;
        this.sequence(
          ctx,
          [{ value: String(row.q.progress), color: CREAM }],
          countX,
          midY + 2,
          32,
          row.counterW,
        );
        if (row.variable)
          this.sequence(ctx, row.targets, countX, midY + 19, 15, row.counterW);
        else
          this.outlineText(
            ctx,
            `/${row.targets[0].value}`,
            countX,
            midY + 19,
            "#d3a25b",
            14,
            "center",
            NUMBER_FONT,
          );
        qy += row.h;
      }
      y += l.passiveH - 2;
    }
    if (l.enchantmentH) {
      this.panel(ctx, quality, "passive", d.x, y, d.w, l.enchantmentH);
      ctx.save();
      ctx.beginPath();
      ctx.rect(d.x, y, d.w, l.enchantmentH);
      ctx.clip();
      this.mainFrame(ctx, quality, d, l, frameY);
      ctx.restore();
      let ey = y + 31;
      for (const row of l.enchantments) {
        this.paintLines(ctx, row.lines, d.x + 23, ey, 18, 25, "enchantment");
        ey += row.h;
      }
    }
    ctx.restore();
    this.lastLayout = l;
    return l;
  }
}
function cutRect(ctx, x, y, w, h, cut = 10) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x + cut, y + h);
  ctx.lineTo(x, y + h - cut);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
