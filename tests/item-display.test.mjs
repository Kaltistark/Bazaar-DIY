import test from "node:test";
import assert from "node:assert/strict";
import { createProject, defaultQuest, resolveTier, editTier, validateProject, extractStats, scaleIntensityText, displayText, questRewardRegion, compatible } from "../src/model.js";
import { Renderer } from "../src/renderer.js";
import { generateEnchantmentDraft } from "../src/enchantments.js";
import { KEYWORDS } from "../src/data.js";

const context = { measureText: text => ({ width: [...text].length * 12 }) };
function richText(text) {
  const p = createProject(); p.seed.effects = [text];
  return new Renderer().rich(displayText(p, "bronze", t => t.effects[0]));
}
test("增幅效果不产生顶部徽章，混合物品仍保留自身输出数值", () => {
  const p = createProject(), t = resolveTier(p, "bronze");
  for (const text of [
    "相邻物品+5灼烧。", "相邻物品+5（灼烧）。", "左侧武器获得10伤害。",
    "己方物品获得6伤害、6治疗和6护盾。", "此物品+20伤害。",
    "使用相邻物品时，此物品的灼烧提高5。", "相邻物品获得护盾，等同于此物品伤害。",
  ]) { t.effects = [text]; assert.deepEqual(extractStats(t), {}, text); }
  t.effects = ["造成60伤害。", "相邻物品+5（灼烧）。", "此物品伤害提高20。"];
  assert.deepEqual(extractStats(t), { damage: 60 });
  t.effects = ["使用相邻物品时，造成5（灼烧），并治疗20生命值。"];
  assert.deepEqual(extractStats(t), { burn: 5, heal: 20 });
  t.effects = ["造成5灼烧，并使相邻物品获得30伤害。"];
  assert.deepEqual(extractStats(t), { burn: 5 });
  t.effects = ["造成60（伤害）。", "造成（灼烧），等同于此物品伤害的10%。"];
  assert.deepEqual(extractStats(t), { damage: 60, burn: 6 });
  assert.equal(scaleIntensityText("相邻物品+5（灼烧），充能2秒。", 2), "相邻物品+10（灼烧），充能2秒。");
});
test("全部带图标关键词及别名支持两种括号，普通关键词仍保留文字", () => {
  for (const keyword of KEYWORDS.filter(k => k.icon)) {
    for (const alias of keyword.aliases) {
      for (const text of [`（${alias}）`, `(${alias})`]) {
        const runs = richText(text);
        assert.equal(runs.length, 1, text);
        assert.equal(runs[0].icon, keyword.icon, text);
        assert.equal(runs[0].text, "", text);
        assert.equal(runs[0].iconOnly, true, text);
      }
    }
  }
  for (const text of ["（高温）", "（任务）", "（未知关键词）", "(灼烧）", "（伤害提高）"])
    assert.equal(richText(text).map(r => r.text).join(""), text);
  const runs = richText("相邻物品+5（灼烧）。");
  const marker = runs.findIndex(r => r.iconOnly);
  assert.equal(runs[marker - 1].text, "5");
  assert.equal(runs[marker - 1].icon, undefined);
  const charge = richText("（充能）右侧物品2秒。");
  assert.equal(charge[0].icon, "charge");
  assert.equal(charge.find(r => r.kind === "number").icon, undefined);
});
test("纯图标与前面的数值一起换行，全品质数值不挤掉后面的图标", () => {
  const r = new Renderer();
  const lines = r.wrap(context, richText("相邻物品+50（灼烧）。"), 140, 22);
  const line = lines.find(line => line.some(u => u.icon === "burn"));
  assert.ok(line.some(u => u.text === "50"));
  const p = createProject(); p.seed.effects = ["相邻物品+50（灼烧）。"];
  const all = r.wrap(context, r.rich(displayText(p, "bronze", t => t.effects[0], "all")), 150, 22);
  const allLine = all.find(line => line.some(u => u.values));
  assert.ok(allLine.some(u => u.icon === "burn"));
  assert.ok(allLine.reduce((sum, u) => sum + u.width, 0) <= 150);
});
test("基础多重释放按品质编辑、合并显示，旧作品迁移并验证范围", () => {
  const p = createProject();
  assert.equal(p.seed.multicastEnabled, false);
  editTier(p, "bronze", t => { t.multicastEnabled = true; t.multicast = 2; });
  editTier(p, "diamond", t => { t.multicastEnabled = true; t.multicast = 4; });
  const all = displayText(p, "bronze", t => String(t.multicastEnabled ? t.multicast : 1), "all");
  assert.deepEqual(all[0].values.map(v => v.value), ["2", "2", "2", "4"]);
  assert.equal(compatible(p), true);
  assert.equal(validateProject(structuredClone(p)).tiers.diamond.multicast, 4);
  const old = createProject(); delete old.seed.multicast; delete old.seed.multicastEnabled;
  assert.equal(validateProject(old).seed.multicast, 1);
  for (const multicast of [0, 1.5, 1000, "3"])
    assert.throws(() => validateProject({ ...createProject(), seed: { ...createProject().seed, multicast } }), /多重/);
  const l = new Renderer().layout(context, p, "bronze", "all");
  assert.ok(l.effectLines.flat().some(line => line.some(u => u.icon === "multicast")));
});
test("任务奖励自动识别主动与被动，手动选择可覆盖并随作品保存", () => {
  const q = defaultQuest(); q.locked = true;
  for (const reward of ["造成6（剧毒）。", "相邻物品+5（灼烧）。", "加速右侧物品2秒。", "获得30护盾。", "此物品和一件物品开始飞行。", "为右侧物品（充能）2秒。"])
    assert.equal(questRewardRegion({ ...q, reward }), "active");
  for (const reward of ["每场战斗开始时，获得30护盾。", "使用相邻物品时，造成10伤害。", "此物品冷却时间减少1秒。", "相邻物品免疫冻结。"])
    assert.equal(questRewardRegion({ ...q, reward }), "passive");
  const p = createProject(); p.seed.quests = [{ ...q, condition: "触发剧毒30次", reward: "造成6（剧毒）。" }];
  let l = new Renderer().layout(context, p, "bronze", "current");
  assert.equal(l.activeLockedRewards.length, 1); assert.equal(l.lockedRewards.length, 0);
  p.seed.quests[0].rewardRegion = "passive";
  l = new Renderer().layout(context, p, "bronze", "current");
  assert.equal(l.activeLockedRewards.length, 0); assert.equal(l.lockedRewards.length, 1);
  assert.equal(validateProject(structuredClone(p)).seed.quests[0].rewardRegion, "passive");
  p.seed.quests[0].rewardRegion = "bad";
  assert.throws(() => validateProject(p), /任务/);
});

test("原游戏增幅物品与图标输入的附魔识别一致", () => {
  const p = createProject(), t = resolveTier(p, "bronze");
  for (const effects of [
    ["己方物品获得6（伤害）、6（治疗）和6（护盾）。"],
    ["左侧武器获得10（伤害）。"],
    ["相邻物品获得20（伤害）和3（灼烧）。"],
    ["此物品和一件物品开始飞行。"],
  ]) { t.effects = effects; assert.deepEqual(extractStats(t), {}); }
  p.seed.effects = ["造成60（伤害）。"];
  assert.equal(generateEnchantmentDraft(p).fiery, "造成灼烧，等同于此物品伤害的10%。");
  p.seed.effects = ["左侧武器获得10（伤害）。"];
  assert.equal(generateEnchantmentDraft(p).fiery, "");
});
