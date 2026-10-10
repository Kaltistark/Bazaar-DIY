import { createProject, defaultTier, defaultQuest } from "../../src/model.js";

// Values reproduce the supplied screenshots. Unshown tiers inherit the sample
// instead of introducing guessed upgrade values.
export const EXAMPLES = {
  stone: {
    name: "空白石碑", hero: "mak", types: ["遗物"],
    art: "blank-slate", cd: "6.0",
    effects: ["使用相邻遗物时，为此物品充能1秒"],
    quests: [
      ["触发剧毒30次", "造成6剧毒"],
      ["生命再生量提高25次", "生命再生量提高6"],
      ["触发灼烧20次", "造成6灼烧"],
      ["触发减速15次", "减速1件物品1秒"],
      ["触发冻结10次", "冻结1件物品1秒"],
    ],
  },
  spring: {
    name: "海底热泉", hero: "vanessa", types: ["水系"],
    art: "spring", cd: "7.0", effects: ["造成3灼烧", "多重触发：3"],
  },
  cannon: {
    name: "火炮", initial: "silver", hero: "vanessa", types: ["武器"],
    art: "cannon", cd: "4.0",
    effects: ["造成80伤害", "造成灼烧，等量于此物品伤害的10%"],
    ammoEnabled: true, ammo: 2, critEnabled: true, crit: 30,
  },
  ball: {
    name: "沙滩充气球", initial: "gold", hero: "vanessa", types: ["水系", "玩具"],
    art: "beach-ball", cd: "4.0", effects: ["加速4件水系或玩具物品2秒"],
  },
  eye: {
    name: "巨像之眼", initial: "legendary", size: "large", hero: "neutral", types: ["遗物"],
    art: "colossus-eye", cd: "10.0", effects: ["摧毁敌人的一件物品"],
    passiveEnabled: true, passive: "使用相邻物品时，充能此物品1秒",
  },
};

export function exampleProject(id) {
  const spec = EXAMPLES[id];
  const project = createProject();
  Object.assign(project, { name: spec.name, hero: spec.hero, types: [...spec.types],
    initial: spec.initial || "bronze", size: spec.size || "medium" });
  project.seed = { ...defaultTier(), ...spec,
    effects: [...spec.effects],
    quests: (spec.quests || []).map(([condition, reward]) => ({ ...defaultQuest(), condition, reward })),
  };
  for (const key of ["name", "hero", "types", "initial", "size", "art"])
    delete project.seed[key];
  if (id === "spring") {
    [3, 6, 9, 12].forEach((n, i) => {
      project.tiers[["bronze", "silver", "gold", "diamond"][i]] = {
        ...defaultTier(), edited: true, cd: "7.0",
        effects: [`造成${n}灼烧`, "多重触发：3"],
      };
    });
  }
  return project;
}

