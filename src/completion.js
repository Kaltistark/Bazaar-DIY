import { TYPES } from "./data.js";

// Templates describe game effects; shorthand is an editor convenience, not game data.
const aliases = {
  damage: ["伤害", "伤", "打", "dmg"],
  heal: ["治疗", "回血", "奶", "疗", "heal"],
  shield: ["护盾", "加盾", "叠盾", "盾", "shield"],
  burn: ["灼烧", "烧", "火", "burn"],
  poison: ["剧毒", "毒", "poison"],
  regen: ["生命再生", "再生", "regen"],
  health: ["最大生命值", "生命值", "生命", "血量", "血", "hp"],
  haste: ["加速", "速", "haste"],
  charge: ["充能", "充", "charge"],
  freeze: ["冻结", "冻", "冰", "freeze"],
  slow: ["减速", "缓速", "慢", "slow"],
  multicast: ["多重释放", "多重触发", "多重", "连发"],
  crit: ["暴击率", "暴击", "暴率", "crit"],
  ammo: ["弹药", "子弹", "弹", "ammo"],
  gold: ["黄金", "金币", "金", "gold"],
  value: ["价值", "卖价"],
  income: ["收入", "收益"],
  tempo: ["节奏"],
  experience: ["经验值", "经验", "xp"],
};
const names = {
  damage: "伤害",
  heal: "治疗",
  shield: "护盾",
  burn: "灼烧",
  poison: "剧毒",
  regen: "生命再生",
  health: "最大生命值",
  haste: "加速",
  charge: "充能",
  freeze: "冻结",
  slow: "减速",
  multicast: "多重释放",
  crit: "暴击率",
  ammo: "弹药",
  gold: "黄金",
  value: "价值",
  income: "收入",
  tempo: "节奏",
  experience: "经验值",
};
const tokens = Object.entries(aliases)
  .flatMap(([id, words]) => words.map((word) => ({ id, word })))
  .sort((a, b) => b.word.length - a.word.length);
const typeAliases = {
  武: "武器",
  友: "伙伴",
  水: "水系",
  科: "科技",
  食: "食物",
  乐: "乐器",
  遗: "遗物",
  车: "载具",
  核: "核心",
  机: "无人机",
  飞: "飞行",
  小: "小型",
  中: "中型",
  大: "大型",
};
const modifiers = [
  ...TYPES,
  "小型",
  "中型",
  "大型",
  "飛行",
  "飞行",
  "无人机",
  "射线",
  "高温",
  "霜冻",
  ...Object.keys(typeAliases),
].sort((a, b) => b.length - a.length);
const positions = [
  ["己方所有其他", "己方所有其他"],
  ["己方所有", "己方所有"],
  ["敌方所有", "敌方所有"],
  ["双方所有其他", "双方所有其他"],
  ["双方所有", "双方所有"],
  ["左侧", "左侧"],
  ["左边", "左侧"],
  ["左", "左侧"],
  ["右侧", "右侧"],
  ["右边", "右侧"],
  ["右", "右侧"],
  ["相邻", "相邻"],
  ["邻居", "相邻"],
  ["两侧", "相邻"],
  ["邻", "相邻"],
  ["自身", "此"],
  ["自己", "此"],
  ["此", "此"],
  ["本品", "此"],
  ["本", "此"],
  ["自", "此"],
  ["该", "该"],
  ["全体", "己方所有"],
  ["全部", "己方所有"],
  ["所有", "己方所有"],
  ["全", "己方所有"],
  ["对面", "敌方所有"],
  ["敌方", "敌方所有"],
  ["敌", "敌方所有"],
  ["己方", "己方所有"],
  ["我方", "己方所有"],
  ["双方", "双方所有"],
  ["其他", "己方所有其他"],
  ["其余", "己方所有其他"],
  ["任意", "任意"],
  ["随机", "一件随机"],
].sort((a, b) => b[0].length - a[0].length);
const amountPattern = "(?:\\d+(?:\\.\\d+)?(?:k|w|千|万)?)";
function normalize(raw) {
  return raw
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(
      /[＝＋％．]/g,
      (ch) => ({ "＝": "=", "＋": "+", "％": "%", "．": "." })[ch],
    )
    .replace(/\s+/g, "")
    .toLowerCase();
}
function amount(raw) {
  const m = raw?.match(/^(\d+(?:\.\d+)?)(k|w|千|万)?$/);
  if (!m) return null;
  const value =
    Number(m[1]) * (["w", "万"].includes(m[2]) ? 10000 : m[2] ? 1000 : 1);
  return Number.isFinite(value) && value <= 1e9
    ? String(Math.round(value * 1e6) / 1e6)
    : null;
}
function kind(raw) {
  return tokens.find((t) => t.word === raw)?.id;
}
function action(raw) {
  return tokens.find((t) => raw.startsWith(t.word));
}
function target(raw, fallback = "一件物品") {
  if (!raw) return fallback;
  raw = raw.replace(/物品$/, "");
  const p = positions.find(([word]) => raw.startsWith(word));
  let prefix = p?.[1] || "",
    rest = p ? raw.slice(p[0].length) : raw;
  const count = rest.match(/^(\d+|一|两|二|三|四|五|六|七|八|九|十)件?/);
  let countText = "";
  if (count) {
    const values = {
      一: 1,
      两: 2,
      二: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
      十: 10,
    };
    const n = values[count[1]] || Number(count[1]);
    if (!Number.isInteger(n) || n < 1 || n > 100) return null;
    countText = `${n}件`;
    rest = rest.slice(count[0].length);
  }
  let negative = false;
  if (rest.startsWith("非")) {
    negative = true;
    rest = rest.slice(1);
  }
  const mods = [];
  while (rest) {
    const m = modifiers.find((word) => rest.startsWith(word));
    if (!m) return null;
    mods.push(typeAliases[m] || (m === "飛行" ? "飞行" : m));
    rest = rest.slice(m.length);
  }
  if (!prefix && !countText && !mods.length) return null;
  if (prefix === "此" && (countText || mods.length)) return null;
  if (countText && ["此", "该", "左侧", "右侧"].includes(prefix)) return null;
  if (!prefix && !countText) prefix = "一件";
  if (countText) prefix = prefix.replace("所有", "");
  const standalone = [
    "武器",
    "伙伴",
    "食物",
    "工具",
    "载具",
    "药水",
    "遗物",
    "玩具",
    "乐器",
    "巨龙",
    "恐龙",
    "核心",
    "无人机",
    "射线",
    "地产",
  ].includes(mods.at(-1));
  return (
    prefix +
    countText +
    (negative ? "非" : "") +
    mods.join("") +
    (standalone && !negative ? "" : "物品")
  );
}
function direct(id, n) {
  if (["damage", "burn", "poison"].includes(id))
    return `造成${n}${names[id]}`;
  if (id === "heal") return `治疗${n}生命值`;
  if (id === "shield") return `获得${n}护盾`;
  if (id === "regen") return `生命再生量提高${n}`;
  if (id === "health") return `获得${n}最大生命值`;
  if (id === "multicast") return `多重释放：${n}`;
  if (id === "crit") return `此物品+${n}%暴击率`;
  if (id === "ammo") return `装填${n}弹药`;
  if (id === "value") return `此物品价值提高${n}`;
  if (id === "income") return `收入提高${n}`;
  return `获得${n}${names[id]}`;
}
function equality(raw, tier) {
  const sides = raw.split("=");
  if (sides.length !== 2) return "";
  const left = kind(sides[0]);
  if (!["damage", "heal", "shield", "burn", "poison", "regen"].includes(left))
    return "";
  let right = sides[1],
    scale = "";
  const leadingPercent = right.match(/^(\d+(?:\.\d+)?)%(.+)$/),
    trailingPercent = right.match(/^(.+?)(\d+(?:\.\d+)?)%$/);
  if (leadingPercent || trailingPercent) {
    if (leadingPercent) {
      scale = leadingPercent[1] + "%";
      right = leadingPercent[2];
    } else {
      right = trailingPercent[1];
      scale = trailingPercent[2] + "%";
    }
  } else {
    const m =
      right.match(/^(\d+(?:\.\d+)?)倍(.+)$/) ||
      right.match(/^(.+?)\*(\d+(?:\.\d+)?)$/);
    if (m) {
      if (/^\d/.test(right)) {
        scale = m[1] + "倍";
        right = m[2];
      } else {
        right = m[1];
        scale = m[2] + "倍";
      }
    }
  }
  const source = kind(right);
  if (
    ![
      "damage",
      "heal",
      "shield",
      "burn",
      "poison",
      "regen",
      "health",
      "value",
    ].includes(source)
  )
    return "";
  if (
    !["health", "value"].includes(source) &&
    ![...(tier.effects || []), tier.passive || ""].some(
      (text) => normalize(text) !== raw && text.includes(names[source]),
    )
  )
    return "";
  const reference =
    source === "health" ? "最大生命值" : `此物品${names[source]}`;
  const ref = reference + (scale ? `的${scale}` : "");
  if (left === "regen") return `生命再生量提高，增幅等于${ref}`;
  const verb =
    left === "heal"
      ? "治疗生命值"
      : left === "shield"
        ? "获得护盾"
        : `造成${names[left]}`;
  return `${verb}，等同于${ref}`;
}
function simple(raw, tier) {
  if (raw.includes("=")) return equality(raw, tier);
  const cooldown = raw.match(
    new RegExp(`^(.*?)(?:cd-|减cd|冷却-)(` + amountPattern + `)(%|秒|s)?$`),
  );
  if (cooldown) {
    const to = target(cooldown[1], "此物品"),
      n = amount(cooldown[2]);
    return to && n !== null
      ? `${to}冷却时间缩短${n}${cooldown[3] === "%" ? "%" : "秒"}`
      : "";
  }
  const gain = raw.match(
    new RegExp(`^(.*?)(永久)?([^+]+)\\+(` + amountPattern + `)(%)?$`),
  );
  if (gain) {
    const id = kind(gain[3]),
      to = target(gain[1], "此物品"),
      n = amount(gain[4]);
    if (id && to && n !== null)
      return `${to}${gain[2] || ""}+${n}${id === "crit" || gain[5] ? "%" : ""}${names[id]}`;
    // Separate a target prefix from the keyword when the first capture is empty.
    for (let i = 0; i < gain[3].length; i++) {
      const to = target(gain[3].slice(0, i), "此物品"),
        id = kind(gain[3].slice(i));
      if (to && id && n !== null)
        return `${to}${gain[2] || ""}+${n}${id === "crit" || gain[5] ? "%" : ""}${names[id]}`;
    }
    return "";
  }
  const refill = raw.match(
    new RegExp(`^装填(.*?)(` + amountPattern + `)(?:弹药|弹)?$`),
  );
  if (refill) {
    const to = target(refill[1], "此物品"),
      n = amount(refill[2]);
    return to && n !== null ? `为${to}装填${n}弹药` : "";
  }
  const status = raw.match(/^(吸血|飞行|飞)(.*)$/);
  if (status) {
    const to = target(status[2], "此物品");
    return to ? `${to}获得${status[1] === "吸血" ? "吸血" : "飞行"}` : "";
  }
  const upgrade = raw.match(/^(?:升级|升)(.*)$/);
  if (upgrade) {
    const to = target(upgrade[1]);
    return to ? `升级${to}` : "";
  }
  const transform = raw.match(/^(?:转化|转)(.*)$/);
  if (transform) {
    const explicit = transform[1].match(/^(.*?)(?:为|成|->|→)(.+)$/);
    if (explicit) {
      const from = target(explicit[1]),
        to = target(explicit[2]);
      return from && to ? `将${from}转化为${to}` : "";
    }
    for (let i = transform[1].length; i >= 0; i--) {
      const from = target(transform[1].slice(0, i)),
        to = target(transform[1].slice(i), "");
      if (from && to) return `将${from}转化为${to}`;
    }
    const from = target(transform[1]);
    return from ? `将${from}转化为` : "";
  }
  let verb = action(raw),
    rest;
  if (verb) rest = raw.slice(verb.word.length);
  else {
    const m = raw.match(new RegExp(`^(` + amountPattern + `)(.+)$`));
    if (!m) return "";
    const id = kind(m[2]),
      n = amount(m[1]);
    if (!id || n === null) return "";
    if (["haste", "charge", "slow", "freeze"].includes(id))
      return `${names[id]}一件物品${n}秒`;
    return direct(id, n);
  }
  if (["haste", "charge", "slow", "freeze"].includes(verb.id)) {
    const m = rest.match(new RegExp(`^(.*?)(` + amountPattern + `)(?:秒|s)?$`));
    const n = m ? amount(m[2]) : "1",
      to = target(m ? m[1] : rest);
    if (!to || n === null) return "";
    return verb.id === "charge"
      ? `为${to}充能${n}秒`
      : `${names[verb.id]}${to}${n}秒`;
  }
  const n = amount(rest.replace(verb.id === "crit" ? /%$/ : /生命值$/, ""));
  return n === null ? "" : direct(verb.id, n);
}
function trigger(raw) {
  const fixed = [
    [/^(?:高温时[：:]?|高温[：:]?|热[：:]?)/, "高温时："],
    [/^(?:霜冻时[：:]?|霜冻[：:]?|霜[：:]?)/, "霜冻时："],
    [/^(?:每场战斗开始时|战斗开始时|战斗开始|开战)/, "每场战斗开始时，"],
    [/^(?:每场战斗结束时|战斗结束时|战斗结束|战后)/, "每场战斗结束时，"],
    [/^(?:每天开始时|每天开始|每日开始|开日)/, "每天开始时，"],
    [/^(?:每天结束时|每天结束|每日结束)/, "每天结束时，"],
    [/^(?:当你暴击时|暴击时)/, "当你暴击时，"],
    [/^(?:受到伤害时|受伤时)/, "受到伤害时，"],
  ];
  for (const [pattern, text] of fixed) {
    const m = raw.match(pattern);
    if (m)
      return {
        prefix: text,
        rest: raw.slice(m[0].length).replace(/^[，,:：]/, ""),
      };
  }
  const split = raw.match(/^(.+?)(?:时[，,:：]?|[，,:：])(.*)$/);
  if (split) {
    const condition = conditionText(split[1]);
    if (condition) return { prefix: condition + "时，", rest: split[2] };
  }
  // With no punctuation, find a recognized condition before an effect shorthand.
  for (
    let i = /^(?:当你)?(?:使用|用|触发|触|获得|获|得)/.test(raw)
      ? raw.length
      : 0;
    i > 1;
    i--
  ) {
    const condition = conditionText(raw.slice(0, i));
    if (condition) return { prefix: condition + "时，", rest: raw.slice(i) };
  }
  return null;
}
function conditionText(raw) {
  let match = raw.match(/^(?:当你)?(?:使用|用)(.+)$/);
  if (match) {
    const to = target(match[1]);
    return to
      ? `使用${to
          .replace(/^一件/, "")
          .replace(/^己方所有其他/, "其他")
          .replace(/^己方所有/, "")}`
      : null;
  }
  match = raw.match(/^(?:当你)?(?:触发|触)(.+)$/);
  if (match && kind(match[1])) return `触发${names[kind(match[1])]}`;
  match = raw.match(/^(?:当你)?(?:获得|获|得)(.+)$/);
  if (match && ["shield", "health", "tempo"].includes(kind(match[1])))
    return `获得${names[kind(match[1])]}`;
  const id = kind(raw.replace(/时$/, ""));
  if (
    [
      "burn",
      "poison",
      "freeze",
      "haste",
      "slow",
      "charge",
      "heal",
      "regen",
    ].includes(id)
  )
    return `触发${names[id]}`;
  return null;
}
export function suggest(input, tier = {}) {
  const original = input.trim();
  if (!original || /[。！？]$/.test(original) || original.includes("\n"))
    return "";
  const raw = normalize(original);
  if (raw.length > 200) return "";
  const start = trigger(raw);
  const result = start
    ? start.rest
      ? start.prefix + simple(start.rest, tier)
      : start.prefix
    : simple(raw, tier);
  if (start?.rest && !simple(start.rest, tier)) return "";
  return result && normalize(result) !== raw ? result : "";
}
export function fieldCompletion(
  value,
  tier,
  caret = value.length,
  selectionEnd = caret,
) {
  if (caret !== selectionEnd) return null;
  const start = value.lastIndexOf("\n", Math.max(0, caret - 1)) + 1;
  let end = value.indexOf("\n", caret);
  if (end < 0) end = value.length;
  if (caret !== end) return null;
  const completed = suggest(value.slice(start, end), tier);
  return completed
    ? {
        text: value.slice(0, start) + completed + value.slice(end),
        preview: completed,
      }
    : null;
}
export const COMPLETION_EXAMPLES = [
  ["奶60", "治疗60生命值"],
  ["60火 / 火60", "造成60灼烧"],
  ["充左 / 充左2.5", "为左侧物品充能1秒 / 2.5秒"],
  ["加速右2", "加速右侧物品2秒"],
  ["冻敌2件1.5", "冻结敌方2件物品1.5秒"],
  ["充邻科技2", "为相邻科技物品充能2秒"],
  ["开战：盾100", "每场战斗开始时，获得100护盾"],
  ["用邻：充自1", "使用相邻物品时，为此物品充能1秒"],
  ["冻结时：奶60", "触发冻结时，治疗60生命值"],
  ["左伤+10", "左侧物品+10伤害"],
  ["永久伤+10", "此物品永久+10伤害"],
  ["火=伤10%", "造成灼烧，等同于此物品伤害的10%"],
  ["高温：火60", "高温时：造成60灼烧"],
  ["霜冻：奶60", "霜冻时：治疗60生命值"],
  ["转左伙伴", "将左侧物品转化为一件伙伴"],
  ["升级右", "升级右侧物品"],
];
