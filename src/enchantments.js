import { ENCHANTMENTS } from "./data.js";
import { resolveTier, defaultEnchantments } from "./model.js";

// Deliberately narrow: do not infer attributes from buffs, quests or triggers.
export function simpleStats(tier) {
  const patterns = {
    damage: /^造成\s*\d+(?:\.\d+)?\s*伤害[。.!！\s]*$/,
    heal: /^治疗\s*\d+(?:\.\d+)?\s*(?:生命值)?[。.!！\s]*$/,
    shield: /^获得\s*\d+(?:\.\d+)?\s*护盾[。.!！\s]*$/,
    burn: /^造成\s*\d+(?:\.\d+)?\s*灼烧[。.!！\s]*$/,
    poison: /^造成\s*\d+(?:\.\d+)?\s*剧毒[。.!！\s]*$/,
    regen: /^(?:获得\s*\d+(?:\.\d+)?\s*生命再生|生命再生(?:量)?(?:提高|增加)\s*\d+(?:\.\d+)?)[。.!！\s]*$/,
  };
  return Object.keys(patterns).filter(id => tier.active && tier.effects.some(
    text => patterns[id].test(text.trim()),
  ));
}

export function generateEnchantmentDraft(project) {
  const tier = resolveTier(project, project.initial);
  const draft = Object.fromEntries(ENCHANTMENTS.map(({ id }) => [id, ""]));
  draft.golden = "此物品的价值翻倍。";
  const effects = tier.effects.filter(text => text.trim());
  const complicated = !tier.active || !effects.length || tier.quests.length > 0 ||
    /(?:时[，,:：]|每当|每次|出售|成长|摧毁|转化|升级|战斗后)/.test(
      [...effects, tier.passiveEnabled ? tier.passive : ""].join("\n"),
    );
  if (complicated) return draft;

  // These are editable draft defaults, not a universal game balance rule.
  draft.heavy = effects.some(t => /减速.+\d+(?:\.\d+)?秒/.test(t))
    ? "此物品的减速时长翻倍。" : "减速一件物品2秒。";
  draft.icy = effects.some(t => /冻结.+\d+(?:\.\d+)?秒/.test(t))
    ? "此物品的冻结时长翻倍。" : "冻结一件物品0.5秒。";
  draft.turbo = effects.some(t => /加速.+\d+(?:\.\d+)?秒/.test(t))
    ? "此物品的加速时长翻倍。" : "加速一件物品2秒。";
  draft.shiny = "此物品+1多重释放。";
  draft.radiant = "此物品免疫冻结、减速和摧毁。";

  const stats = simpleStats(tier), primary = stats.length === 1 ? stats[0] : null;
  const labels = { damage: "伤害", heal: "治疗量", shield: "护盾量",
    burn: "灼烧量", poison: "剧毒量", regen: "生命再生量" };
  const targets = { obsidian: "damage", restorative: "heal", shielded: "shield",
    fiery: "burn", toxic: "poison", mossy: "regen" };
  const referenced = {
    damage: /^造成伤害[，,].*(?:等同于|等量于|等于)此物品/,
    heal: /^治疗[，,].*(?:等同于|等量于|等于)此物品/,
    shield: /^获得护盾[，,].*(?:等同于|等量于|等于)此物品/,
    burn: /^造成灼烧[，,].*(?:等同于|等量于|等于)此物品/,
    poison: /^造成剧毒[，,].*(?:等同于|等量于|等于)此物品/,
    regen: /^生命再生量提高[，,].*(?:等同于|等量于|等于)此物品/,
  };
  const persistent = id => ["burn", "poison", "regen"].includes(id);
  for (const [enchantment, target] of Object.entries(targets)) {
    if (stats.includes(target) || effects.some(text => referenced[target].test(text.trim()))) {
      draft[enchantment] = `此物品的${labels[target]}翻倍。`;
      continue;
    }
    if (!primary) continue;
    const factor = persistent(primary) === persistent(target) ? 1
      : persistent(primary) ? 5 : 0.1;
    const reference = `等同于此物品${labels[primary]}${factor === 1 ? "" : factor === 5 ? "的5倍" : "的10%"}`;
    const start = { damage: "造成伤害", heal: "治疗", shield: "获得护盾",
      burn: "造成灼烧", poison: "造成剧毒", regen: "生命再生量提高" }[target];
    draft[enchantment] = `${start}，${target === "regen" ? "增幅" : ""}${reference}。`;
    if (target === "damage" && !project.types.includes("武器"))
      draft[enchantment] = `此物品获得武器类型。${draft[enchantment]}`;
  }
  if (stats.length) draft.deadly = "此物品+50%暴击率。";
  return draft;
}

export function refreshEnchantments(project, { replaceManual = false } = {}) {
  project.enchantments ??= defaultEnchantments();
  const draft = generateEnchantmentDraft(project);
  for (const { id } of ENCHANTMENTS) {
    const entry = project.enchantments.entries[id];
    if (!entry.manual || replaceManual) {
      entry.text = draft[id];
      entry.manual = false;
    }
  }
  project.enchantments.initialized = true;
}

export function enchantmentRows(project) {
  return ENCHANTMENTS.flatMap(e => {
    const entry = project.enchantments?.entries?.[e.id];
    return entry?.enabled && entry.text.trim() ? [{ ...e, text: entry.text }] : [];
  });
}
