import test from "node:test";
import assert from "node:assert/strict";
import { createProject, editTier, validateProject } from "../src/model.js";
import { generateEnchantmentDraft, refreshEnchantments, enchantmentRows } from "../src/enchantments.js";

const projectWith = effect => {
  const p = createProject();
  editTier(p, "bronze", t => { t.effects = [effect]; });
  return p;
};
test("伤害附魔使用属性引用，品质数值变化不会让公式过时", () => {
  const p = projectWith("造成60伤害。");
  editTier(p, "diamond", t => { t.effects = ["造成240伤害。"]; });
  const draft = generateEnchantmentDraft(p);
  assert.equal(Object.keys(draft).length, 13);
  assert.equal(draft.obsidian, "此物品的伤害翻倍。");
  assert.equal(draft.shielded, "获得护盾，等同于此物品伤害。");
  assert.equal(draft.toxic, "造成剧毒，等同于此物品伤害的10%。");
  assert.equal(draft.shiny, "此物品+1多重释放。");
});
test("剧毒主效果遵循5倍直接属性和同量持续属性的非对称换算", () => {
  const draft = generateEnchantmentDraft(projectWith("造成6剧毒。"));
  assert.equal(draft.toxic, "此物品的剧毒量翻倍。");
  assert.equal(draft.shielded, "获得护盾，等同于此物品剧毒量的5倍。");
  assert.equal(draft.fiery, "造成灼烧，等同于此物品剧毒量。");
  assert.match(draft.obsidian, /^此物品获得武器类型/);
});
test("辅助、复杂成长和纯被动不被错误折算为自身输出", () => {
  const support = generateEnchantmentDraft(projectWith("加速4件水系或玩具物品2秒。"));
  assert.equal(support.turbo, "此物品的加速时长翻倍。");
  assert.equal(support.toxic, "");
  assert.equal(support.deadly, "");
  for (const effect of ["使用左侧物品时，治疗60生命值。", "此物品的伤害提高60。", "每次使用时，摧毁此物品。"])
    assert.equal(generateEnchantmentDraft(projectWith(effect)).toxic, "");
  const passive = projectWith("造成60伤害。");
  editTier(passive, "bronze", t => { t.active = false; t.passiveEnabled = true; t.passive = "出售时治疗60生命值。"; });
  const draft = generateEnchantmentDraft(passive);
  assert.equal(draft.shiny, "");
  assert.equal(draft.radiant, "");
});
test("多主属性各自翻倍，跨属性引用有歧义时留空", () => {
  const p = projectWith("造成60伤害。");
  editTier(p, "bronze", t => t.effects.push("造成6灼烧。"));
  const draft = generateEnchantmentDraft(p);
  assert.equal(draft.obsidian, "此物品的伤害翻倍。");
  assert.equal(draft.fiery, "此物品的灼烧量翻倍。");
  assert.equal(draft.shielded, "");
});
test("已存在的属性引用也采用同类翻倍，不重复新增该效果", () => {
  const p = projectWith("造成60伤害。");
  editTier(p, "bronze", t => t.effects.push("造成灼烧，等量于此物品伤害的10%。"));
  const draft = generateEnchantmentDraft(p);
  assert.equal(draft.fiery, "此物品的灼烧量翻倍。");
  assert.equal(draft.shielded, "获得护盾，等同于此物品伤害。");
});
test("重新生成保留手动文案、手动留空和关闭状态", () => {
  const p = projectWith("治疗60生命值。");
  refreshEnchantments(p);
  Object.assign(p.enchantments.entries.toxic, { text: "自定义附魔。", manual: true });
  Object.assign(p.enchantments.entries.shiny, { text: "", manual: true });
  p.enchantments.entries.golden.enabled = false;
  editTier(p, "bronze", t => { t.effects = ["造成60伤害。"]; });
  refreshEnchantments(p);
  assert.equal(p.enchantments.entries.toxic.text, "自定义附魔。");
  assert.equal(p.enchantments.entries.shiny.text, "");
  const rows = enchantmentRows(p);
  assert.ok(rows.some(r => r.id === "toxic"));
  assert.ok(rows.every(r => r.id !== "golden" && r.id !== "shiny"));
});
test("旧作品补齐附魔，作品往返保留手动内容并拒绝非法数据", () => {
  const p = projectWith("造成60伤害。");
  delete p.enchantments;
  validateProject(p);
  refreshEnchantments(p);
  Object.assign(p.enchantments.entries.mossy, { manual: true, text: "生命再生量提高3。" });
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))), p);
  p.enchantments.entries.mossy.text = 3;
  assert.throws(() => validateProject(p), /附魔效果/);
});
