import { QUALITIES, SIZES, HEROES, TYPES, KEYWORDS, ENCHANTMENTS } from "./data.js";
import {
  createProject,
  available,
  resolveTier,
  editTier,
  compatible,
  clone,
  validateProject,
  numericSignature,
  synchronizeStructure,
  synchronizeText,
  defaultQuest,
  questRewardRegion,
  questTarget,
  questComplete,
  textValue,
  setTextValue,
  defaultBackground,
} from "./model.js";
import { Renderer } from "./renderer.js";
import { CooldownPicker } from "./cooldown-picker.js";
import { fieldCompletion } from "./completion.js";
import { refreshEnchantments, generateEnchantmentDraft } from "./enchantments.js";
const $ = (id) => document.getElementById(id),
  renderer = new Renderer();
let project = createProject(),
  current = "bronze",
  saveTimer,
  paintPending = false,
  focusSnapshot = null,
  pendingStructure = null,
  toastTimer;
let editorPage = "base";
const canvas = $("preview"),
  artInteraction = $("art-interaction"),
  tierButtons = new Map();
const cooldownPicker = new CooldownPicker($("cooldown-picker"), (value) => {
  $("cooldown").value = value;
  mutate((t) => (t.cd = value));
});
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 4000);
}
function option(value, label) {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = label;
  return o;
}
QUALITIES.forEach((q) => {
  $("initial-tier").append(option(q.id, q.name));
  if (q.id === "legendary") return;
  const b = document.createElement("button");
  b.className = "tier-button";
  b.textContent = q.name;
  b.style.setProperty("--tier-color", q.color);
  b.addEventListener("click", () => {
    if (b.disabled) return;
    current = q.id;
    syncForms();
    schedulePaint();
  });
  tierButtons.set(q.id, b);
  $("tier-switch").append(b);
});
HEROES.forEach(([id, label]) => $("hero").append(option(id, label)));
let heroOpen = false;
function syncHeroPicker() {
  const [id, name] = HEROES.find(([id]) => id === project.hero) || HEROES[0];
  $("hero-name").textContent = name;
  $("hero-portrait").src = `./assets/hero-portraits/${id}.png`;
  for (const button of $("hero-list").children)
    button.setAttribute("aria-selected", String(button.dataset.hero === id));
}
function closeHeroPicker(focus = false) {
  heroOpen = false;
  $("hero-list").hidden = true;
  $("hero-toggle").setAttribute("aria-expanded", "false");
  if (focus) $("hero-toggle").focus();
}
function openHeroPicker() {
  heroOpen = true;
  $("hero-list").hidden = false;
  const box = $("hero-toggle").getBoundingClientRect();
  const below = window.innerHeight - box.bottom - 8,
    above = box.top - 8;
  const upward = below < 180 && above > below;
  $("hero-list").style.top = upward ? "auto" : "calc(100% + 5px)";
  $("hero-list").style.bottom = upward ? "calc(100% + 5px)" : "auto";
  $("hero-list").style.maxHeight =
    `${Math.max(100, Math.min(405, (upward ? above : below) - 8))}px`;
  $("hero-toggle").setAttribute("aria-expanded", "true");
  $("hero-list").querySelector('[aria-selected="true"]')?.focus();
}
for (const [id, name] of HEROES) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "hero-option";
  b.dataset.hero = id;
  b.setAttribute("role", "option");
  b.setAttribute("aria-label", name);
  const label = document.createElement("span");
  label.textContent = name;
  const image = new Image();
  image.src = `./assets/hero-portraits/${id}.png`;
  image.alt = "";
  b.append(label, image);
  b.addEventListener("click", () => {
    $("hero").value = id;
    $("hero").dispatchEvent(new Event("change"));
    closeHeroPicker(true);
  });
  $("hero-list").append(b);
}
$("hero-toggle").addEventListener("click", () =>
  heroOpen ? closeHeroPicker() : openHeroPicker(),
);
$("hero-toggle").addEventListener("keydown", (e) => {
  if (["ArrowDown", "ArrowUp"].includes(e.key)) {
    e.preventDefault();
    openHeroPicker();
  }
});
$("hero-list").addEventListener("keydown", (e) => {
  const options = [...$("hero-list").children],
    i = options.indexOf(document.activeElement);
  if (e.key === "Escape") {
    e.preventDefault();
    closeHeroPicker(true);
  } else if (e.key === "Tab") closeHeroPicker();
  else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
    e.preventDefault();
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? options.length - 1
          : (i + (e.key === "ArrowDown" ? 1 : -1) + options.length) %
            options.length;
    options[next].focus();
  }
});
document.addEventListener("pointerdown", (e) => {
  if (heroOpen && !e.target.closest(".hero-picker")) closeHeroPicker();
});
window.addEventListener("resize", () => {
  if (heroOpen) closeHeroPicker();
});
function attachCompletion(ta, wrap) {
  const ghost = document.createElement("div");
  ghost.className = "ghost-suggestion";
  ghost.hidden = true;
  ghost.setAttribute("aria-live", "polite");
  wrap.append(ghost);
  let composing = false;
  const completion = () =>
    fieldCompletion(
      ta.value,
      resolveTier(project, current),
      ta.selectionStart,
      ta.selectionEnd,
    );
  function update() {
    const result =
      !composing && document.activeElement === ta ? completion() : null;
    ghost.hidden = !result;
    if (result) {
      ghost.replaceChildren(document.createTextNode(result.preview));
    }
  }
  ta.addEventListener("focus", update);
  ta.addEventListener("input", update);
  ta.addEventListener("click", update);
  ta.addEventListener("keyup", update);
  ta.addEventListener("blur", () => {
    ghost.hidden = true;
  });
  ta.addEventListener("compositionstart", () => {
    composing = true;
    update();
  });
  ta.addEventListener("compositionend", () => {
    composing = false;
    update();
  });
  ta.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || e.shiftKey || e.isComposing || composing) return;
    const result = completion();
    if (!result) return;
    e.preventDefault();
    const oldEnd = ta.selectionEnd,
      oldLength = ta.value.length;
    ta.value = result.text;
    const caret = oldEnd + ta.value.length - oldLength;
    ta.setSelectionRange(caret, caret);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
for (const type of TYPES) {
  const b = document.createElement("button");
  b.className = "tag";
  b.textContent = type;
  b.setAttribute("aria-pressed", "false");
  b.addEventListener("click", () => {
    project.types = project.types.includes(type)
      ? project.types.filter((t) => t !== type)
      : [...project.types, type];
    syncTags();
    changed();
  });
  $("tag-grid").append(b);
}
function syncTags() {
  const chosen = [SIZES[project.size].name, ...project.types];
  $("selected-types").textContent = chosen.join(" · ");
  for (const b of $("tag-grid").children) {
    const selected = project.types.includes(b.textContent);
    b.classList.toggle("active", selected);
    b.setAttribute("aria-pressed", String(selected));
  }
}
function syncForms() {
  const t = resolveTier(project, current),
    qs = available(project);
  for (const [id, b] of tierButtons) {
    b.disabled = !qs.some((q) => q.id === id);
    b.classList.toggle("selected", id === current);
    b.setAttribute("aria-pressed", String(id === current));
  }
  $("initial-tier").value = project.initial;
  $("item-size").value = project.size;
  $("hero").value = project.hero;
  syncHeroPicker();
  $("item-name").value = project.name;
  syncBackgroundControls();
  $("independent-structure").checked = !!project.independentStructure;
  $("active-enabled").checked = t.active;
  $("active-editor").hidden = !t.active;
  $("cooldown").value = t.cd;
  cooldownPicker.setValue(t.cd);
  $("passive").value = t.passive;
  $("passive-enabled").checked = t.passiveEnabled;
  $("passive-wrap").hidden = !t.passiveEnabled;
  $("ammo-enabled").checked = t.ammoEnabled;
  $("ammo").value = t.ammo;
  $("ammo").disabled = !t.ammoEnabled;
  $("crit-enabled").checked = t.critEnabled;
  $("crit").value = t.crit;
  $("crit").disabled = !t.critEnabled;
  $("multicast-enabled").checked = t.multicastEnabled;
  $("multicast").value = t.multicast;
  $("multicast").disabled = !t.multicastEnabled;
  $("preview-label").textContent =
    `${QUALITIES.find((q) => q.id === current).name} · ${SIZES[project.size].name}`;
  $("editing-tier").textContent =
    `正在编辑 · ${QUALITIES.find((q) => q.id === current).name}`;
  syncTags();
  buildEffectFields(t);
  buildQuestFields(t);
  syncCompatibility();
  buildEnchantmentFields();
}
function setEditorPage(page) {
  if (page === "enchantments") {
    refreshEnchantments(project);
    buildEnchantmentFields();
    changed();
  }
  editorPage = page;
  $("base-editor-page").hidden = page !== "base";
  $("enchantments-editor-page").hidden = page !== "enchantments";
  $("base-tab").setAttribute("aria-selected", String(page === "base"));
  $("enchantments-tab").setAttribute("aria-selected", String(page === "enchantments"));
  schedulePaint();
}
for (const id of ["enchantments-tab", "edit-enchantments"])
  $(id).addEventListener("click", () => setEditorPage("enchantments"));
for (const id of ["base-tab", "back-to-base"])
  $(id).addEventListener("click", () => setEditorPage("base"));
$("regenerate-enchantments").addEventListener("click", () => {
  refreshEnchantments(project);
  buildEnchantmentFields();
  changed();
  toast("已更新自动生成的附魔，手动修改内容已保留");
});
function buildEnchantmentFields() {
  $("enchantment-list").replaceChildren();
  for (const enchantment of ENCHANTMENTS) {
    const entry = project.enchantments.entries[enchantment.id];
    const card = document.createElement("div");
    card.className = "enchantment-card";
    card.classList.toggle("excluded", !entry.enabled);
    card.style.setProperty("--enchantment-color", enchantment.color);
    const heading = document.createElement("div");
    heading.className = "enchantment-heading";
    const label = document.createElement("label");
    label.className = "check-label";
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = entry.enabled;
    toggle.setAttribute("aria-label", `启用${enchantment.name}附魔`);
    toggle.addEventListener("change", () => {
      entry.enabled = toggle.checked;
      card.classList.toggle("excluded", !entry.enabled);
      changed();
    });
    label.append(toggle, document.createTextNode(enchantment.name));
    const reset = document.createElement("button");
    reset.className = "button text";
    reset.textContent = "恢复自动";
    reset.setAttribute("aria-label", `重新生成${enchantment.name}附魔`);
    const input = document.createElement("textarea");
    input.rows = 2;
    input.maxLength = 4000;
    input.value = entry.text;
    input.placeholder = "尚未生成，可手动填写…";
    input.setAttribute("aria-label", `${enchantment.name}附魔效果`);
    input.addEventListener("input", () => {
      entry.text = input.value;
      entry.manual = true;
      changed();
    });
    reset.addEventListener("click", () => {
      entry.text = generateEnchantmentDraft(project)[enchantment.id];
      entry.manual = false;
      input.value = entry.text;
      changed();
    });
    heading.append(label, reset);
    card.append(heading, input);
    $("enchantment-list").append(card);
  }
}
function buildEffectFields(t) {
  $("effect-list").replaceChildren();
  t.effects.forEach((value, i) => {
    const row = document.createElement("div");
    row.className = "effect-row";
    const n = document.createElement("span");
    n.className = "effect-number";
    n.textContent = "➜";
    const wrap = document.createElement("div");
    wrap.className = "effect-input-wrap";
    const ta = document.createElement("textarea");
    ta.className = "effect-text";
    ta.rows = 2;
    ta.maxLength = 4000;
    ta.value = value;
    ta.placeholder =
      i === 0 ? "例如：奶60 / 充左 / 加速右2 / 火=伤" : "输入另一条效果…";
    ta.setAttribute("aria-label", `主动效果 ${i + 1}`);
    ta.addEventListener("focus", () => {
      focusSnapshot = clone(project);
    });
    ta.addEventListener("input", () => {
      editText("effects", i, ta.value);
      changed();
    });
    ta.addEventListener("blur", () => {
      checkStructure(focusSnapshot);
      focusSnapshot = null;
    });
    const remove = document.createElement("button");
    remove.className = "icon-button effect-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `删除效果 ${i + 1}`);
    remove.addEventListener("click", () =>
      mutate(
        (t) => {
          t.effects.splice(i, 1);
          if (!t.effects.length) t.effects = [""];
        },
        { warn: true, refresh: true, structure: true },
      ),
    );
    wrap.append(ta);
    attachCompletion(ta, wrap);
    row.append(n, wrap, remove);
    $("effect-list").append(row);
  });
}
function syncCompatibility() {
  const ok = compatible(project);
  $("compatibility-note").hidden = ok;
  const all = document.querySelector('input[name="export-mode"][value="all"]');
  all.disabled = !ok;
  if (!ok)
    document.querySelector(
      'input[name="export-mode"][value="current"]',
    ).checked = true;
  $("export-incompatible").hidden = ok;
}
let activeQuestIconPicker = null;
function questIconPicker(value, reward, index, onChange) {
  const root = document.createElement("div");
  root.className = "quest-icon-picker";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "quest-icon-toggle";
  toggle.setAttribute("role", "combobox");
  toggle.setAttribute("aria-label", `任务 ${index + 1} 奖励图标`);
  toggle.setAttribute("aria-haspopup", "listbox");
  toggle.setAttribute("aria-expanded", "false");
  const label = document.createElement("span"), portrait = new Image();
  portrait.alt = "";
  const arrow = document.createElement("span");
  arrow.textContent = "⌄"; arrow.setAttribute("aria-hidden", "true");
  toggle.append(label, portrait, arrow);
  const menu = document.createElement("div");
  menu.className = "quest-icon-list";
  menu.id = `quest-icons-${index}`;
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", `任务 ${index + 1} 奖励图标选项`);
  menu.hidden = true;
  toggle.setAttribute("aria-controls", menu.id);
  const choices = [
    { id: "auto", name: "自动匹配奖励关键词", icon: null },
    { id: "quest-lock", name: "解锁效果 · 锁", icon: "quest-lock" },
    ...KEYWORDS.filter(k => k.icon).map(k => ({ id: k.icon, name: k.name, icon: k.icon })),
  ];
  const imageSource = icon => icon === "quest-lock" ? "./assets/ui/Tooltip_Quest_Lock.png" : `./assets/icons/${icon}.png`;
  let automaticIcon;
  const buttons = [];
  function sync() {
    automaticIcon = KEYWORDS.find(k => k.icon && k.aliases.some(a => reward.includes(a)))?.icon || "value";
    const choice = choices.find(c => c.id === value) || choices[0];
    label.textContent = choice.name;
    portrait.src = imageSource(choice.icon || automaticIcon);
    buttons.forEach((button, i) => {
      button.setAttribute("aria-selected", String(choices[i].id === value));
      if (choices[i].id === "auto") button.querySelector("img").src = imageSource(automaticIcon);
    });
  }
  function close(focus = false) {
    menu.hidden = true;
    menu.remove();
    toggle.setAttribute("aria-expanded", "false");
    if (activeQuestIconPicker?.root === root) activeQuestIconPicker = null;
    if (focus) toggle.focus();
  }
  function open() {
    activeQuestIconPicker?.close();
    document.body.append(menu);
    menu.hidden = false;
    const box = toggle.getBoundingClientRect();
    const below = innerHeight - box.bottom - 12, above = box.top - 12;
    const upward = below < 220 && above > below;
    const height = Math.min(330, Math.max(100, upward ? above : below));
    menu.style.width = `${Math.min(box.width, innerWidth - 24)}px`;
    menu.style.left = `${Math.max(12, Math.min(box.left, innerWidth - box.width - 12))}px`;
    menu.style.maxHeight = `${height}px`;
    menu.style.top = upward ? "auto" : `${box.bottom + 5}px`;
    menu.style.bottom = upward ? `${innerHeight - box.top + 5}px` : "auto";
    activeQuestIconPicker = { root, menu, close };
    toggle.setAttribute("aria-expanded", "true");
    buttons[choices.findIndex(c => c.id === value)]?.focus();
  }
  choices.forEach(choice => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quest-icon-option";
    button.setAttribute("role", "option");
    const title = document.createElement("span"); title.textContent = choice.name;
    const icon = new Image(); icon.alt = ""; icon.src = imageSource(choice.icon || "value");
    button.append(title, icon);
    button.addEventListener("click", () => { value = choice.id; sync(); close(true); onChange(value); });
    buttons.push(button); menu.append(button);
  });
  toggle.addEventListener("click", () => menu.hidden ? open() : close());
  toggle.addEventListener("keydown", event => {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); open(); }
  });
  menu.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); close(true); }
    else if (event.key === "Tab") close();
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const i = buttons.indexOf(document.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 :
        (i + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
    }
  });
  root.append(toggle); sync();
  return { element: root, updateReward(text) { reward = text; sync(); } };
}
document.addEventListener("pointerdown", event => {
  const picker = activeQuestIconPicker;
  if (picker && !picker.root.contains(event.target) && !picker.menu.contains(event.target)) picker.close();
});
window.addEventListener("resize", () => activeQuestIconPicker?.close());
window.addEventListener("scroll", event => {
  const picker = activeQuestIconPicker;
  if (picker && event.target !== picker.menu && !picker.menu.contains(event.target)) picker.close();
}, true);
function buildQuestFields(t) {
  activeQuestIconPicker?.close();
  $("quest-count").textContent = t.quests.length
    ? `${t.quests.length} 条任务`
    : "可选";
  $("quest-list").replaceChildren();
  t.quests.forEach((q, i) => {
    const card = document.createElement("div");
    card.className = "quest-card";
    const heading = document.createElement("div");
    heading.className = "quest-heading";
    const title = document.createElement("strong");
    title.textContent = `任务 ${i + 1}`;
    const remove = document.createElement("button");
    remove.className = "icon-button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `删除任务 ${i + 1}`);
    remove.addEventListener("click", () =>
      mutate((t) => t.quests.splice(i, 1), {
        structure: true,
        warn: true,
        refresh: true,
      }),
    );
    heading.append(title, remove);
    card.append(heading);
    const labelFor = (text, input) => {
      const label = document.createElement("label");
      label.append(document.createTextNode(text), input);
      card.append(label);
      return label;
    };
    for (const [key, label, placeholder] of [
      ["condition", "任务条件", "例如：触发剧毒30次"],
      ["reward", "完成奖励", "例如：造成6剧毒"],
    ]) {
      const ta = document.createElement("textarea");
      ta.rows = 2;
      ta.maxLength = 4000;
      ta.value = q[key];
      ta.placeholder = placeholder;
      ta.setAttribute("aria-label", `任务 ${i + 1} ${label}`);
      ta.addEventListener("focus", () => {
          focusSnapshot = clone(project);
      });
      ta.addEventListener("input", () => {
        editText(`quest-${key}`, i, ta.value);
        updateState();
        changed();
      });
      ta.addEventListener("blur", () => {
        checkStructure(focusSnapshot);
        focusSnapshot = null;
      });
      const textLabel = labelFor(label, ta);
      if (key === "reward") attachCompletion(ta, textLabel);
    }
    const row = document.createElement("div");
    row.className = "field-row two";
    const count = (label, key, min) => {
      const input = document.createElement("input");
      input.type = "number";
      input.min = min;
      input.max = 999999;
      input.step = 1;
      input.setAttribute("aria-label", `任务 ${i + 1} ${label}`);
      input.addEventListener("input", () => {
        const value = Math.min(
          999999,
          Math.max(min, Math.floor(Number(input.value) || min)),
        );
        mutate((t) => {
          t.quests[i][key] = value;
          if (key === "target") t.quests[i].targetManual = true;
        });
        updateState();
      });
      const l = labelFor(label, input);
      row.append(l);
      return input;
    };
    const target = count("目标次数", "target", 1);
    const progress = count("当前进度", "progress", 0);
    card.append(row);
    const check = (text, label) => {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("aria-label", `任务 ${i + 1} ${label}`);
      const l = labelFor(text, input);
      l.className = "check-label";
      l.prepend(input);
      return input;
    };
    const automatic = check("从条件自动读取目标次数", "自动目标");
    automatic.addEventListener("change", () => {
      mutate((t) => {
        t.quests[i].targetManual = !automatic.checked;
      });
      updateState();
    });
    const complete = check("已完成", "已完成");
    complete.addEventListener("change", () => {
      mutate((t) => {
        t.quests[i].progress = complete.checked ? questTarget(t.quests[i]) : 0;
      });
      updateState();
    });
    const icons = questIconPicker(q.icon, q.reward, i, value => mutate(
      t => { t.quests[i].icon = value; }, { structure: true, warn: true },
    ));
    labelFor("奖励图标", icons.element);
    const locked = check("在任务上方显示锁定奖励", "显示锁定奖励");
    locked.checked = q.locked;
    locked.addEventListener("change", () =>
      mutate(
        (t) => {
          t.quests[i].locked = locked.checked;
        },
        { structure: true, warn: true },
      ),
    );
    const region = document.createElement("select");
    region.setAttribute("aria-label", `任务 ${i + 1} 锁定奖励显示区域`);
    region.append(option("auto", "自动 · 按奖励描述"), option("active", "主动效果区"), option("passive", "被动效果区"));
    region.value = q.rewardRegion;
    const regionLabel = labelFor("锁定奖励显示区域", region);
    const regionHint = document.createElement("span");
    regionHint.className = "field-help";
    regionLabel.append(regionHint);
    region.addEventListener("change", () => {
      mutate(t => { t.quests[i].rewardRegion = region.value; }, { structure: true, warn: true });
      updateState();
    });
    locked.addEventListener("change", updateState);
    function updateState() {
      const value = resolveTier(project, current).quests[i];
      icons.updateReward(value.reward);
      region.disabled = !value.locked;
      regionHint.textContent = value.locked && value.rewardRegion === "auto"
        ? `自动显示在${questRewardRegion(value) === "active" ? "主动" : "被动"}效果区` : "";
      target.value = questTarget(value);
      progress.value = value.progress;
      automatic.checked = !value.targetManual;
      complete.checked = questComplete(value);
    }
    updateState();
    $("quest-list").append(card);
  });
}
function mutate(
  change,
  { warn = false, refresh = false, structure = false } = {},
) {
  const before = clone(project);
  if (structure && !project.independentStructure)
    synchronizeStructure(project, current, change);
  else editTier(project, current, change);
  if (refresh) syncForms();
  changed();
  if (warn) checkStructure(before);
}
function editText(field, index, text) {
  const t = resolveTier(project, current),
    old = textValue(t, field, index);
  if (
    !project.independentStructure &&
    numericSignature(old) !== numericSignature(text)
  )
    synchronizeText(
      project,
      current,
      field,
      index,
      text,
      focusSnapshot || project,
    );
  else
    editTier(project, current, (t) => {
      setTextValue(t, field, index, text);
    });
}
function checkStructure(before) {
  if (
    !project.independentStructure ||
    !before ||
    pendingStructure ||
    compatible(project) ||
    !compatible(before)
  )
    return;
  pendingStructure = before;
  $("structure-dialog").showModal();
}
$("structure-confirm").addEventListener("click", () => {
  pendingStructure = null;
  $("structure-dialog").close();
  changed();
});
function cancelStructure() {
  if (pendingStructure) {
    project = pendingStructure;
    pendingStructure = null;
    syncForms();
    changed();
  }
  $("structure-dialog").close();
}
$("structure-cancel").addEventListener("click", cancelStructure);
$("structure-dialog").addEventListener("cancel", (e) => {
  e.preventDefault();
  cancelStructure();
});
function changed() {
  if (project.enchantments.initialized) refreshEnchantments(project);
  syncCompatibility();
  schedulePaint();
  clearTimeout(saveTimer);
  $("save-status").textContent = "正在保存…";
  saveTimer = setTimeout(async () => {
    try {
      await saveLocal(project);
      $("save-status").textContent = "已保存到本地";
    } catch {
      $("save-status").textContent = "本地保存失败";
      toast("本地存储不可用，请使用“保存作品”备份。");
    }
  }, 450);
}
function schedulePaint() {
  if (paintPending) return;
  paintPending = true;
  requestAnimationFrame(() => {
    paintPending = false;
    try {
      const stacked = $("preview-stage").clientWidth < 500;
      renderer.render(canvas, project, current, {
        includeEnchantments: editorPage === "enchantments",
        scale: Math.min(devicePixelRatio || 1, 2),
        stacked,
        background: project.background.useDefault ? "transparent" : "preview",
      });
      positionOverlay();
    } catch (e) {
      toast(e.message);
    }
  });
}
function syncBackgroundControls() {
  $("background-color").value = project.background.color;
  $("remove-background").hidden = !project.background.image;
  $("preview-stage").style.background = project.background.useDefault ? "" : project.background.color;
  $("preview-stage").classList.toggle("has-background-image", !!project.background.image);
}
$("background-color").addEventListener("input", () => {
  project.background.color = $("background-color").value;
  project.background.useDefault = false;
  syncBackgroundControls();
  changed();
});
$("upload-background").addEventListener("click", () => $("background-file").click());
let backgroundUploadEpoch = 0;
async function decodeBackground(source) {
  if (!source) return null;
  const image = new Image();
  image.src = source;
  try {
    await image.decode();
    return image;
  } catch {
    throw new Error("背景图片无法读取，请尝试另一张图片");
  }
}
$("background-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const target = project, request = ++backgroundUploadEpoch;
  try {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
      throw new Error("请选择 PNG、JPG 或 WebP 图片");
    if (file.size > 20 * 1024 * 1024) throw new Error("图片不能超过 20 MB");
    let source = await readDataURL(file), image = await decodeBackground(source);
    if (Math.max(image.width, image.height) > 4096) {
      const factor = 4096 / Math.max(image.width, image.height);
      const resized = document.createElement("canvas");
      resized.width = Math.max(1, Math.round(image.width * factor));
      resized.height = Math.max(1, Math.round(image.height * factor));
      resized.getContext("2d").drawImage(image, 0, 0, resized.width, resized.height);
      source = resized.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.94);
      image = await decodeBackground(source);
    }
    if (source.length > 30_000_000) throw new Error("背景图片过大，请选择较小的图片");
    if (request !== backgroundUploadEpoch || project !== target) return;
    project.background.image = source;
    project.background.useDefault = false;
    renderer.backgroundImage = image;
    syncBackgroundControls();
    changed();
    toast("背景已更新");
  } catch (error) {
    if (request === backgroundUploadEpoch && project === target) toast(error.message);
  } finally {
    e.target.value = "";
  }
});
$("remove-background").addEventListener("click", () => {
  backgroundUploadEpoch++;
  project.background.image = null;
  renderer.backgroundImage = null;
  syncBackgroundControls();
  changed();
});
$("reset-background").addEventListener("click", () => {
  backgroundUploadEpoch++;
  project.background = defaultBackground();
  renderer.backgroundImage = null;
  syncBackgroundControls();
  changed();
  toast("已恢复默认背景");
});
function positionOverlay() {
  const l = renderer.lastLayout;
  if (!l) return;
  const stage = $("preview-stage").getBoundingClientRect(),
    rect = canvas.getBoundingClientRect(),
    a = l.art,
    ratio = rect.width / l.width,
    o = $("empty-upload");
  o.hidden = !!project.art;
  o.style.left = `${rect.left - stage.left + (a.x + 28 * a.scale) * ratio}px`;
  o.style.top = `${rect.top - stage.top + (a.y + 45 * a.scale) * ratio}px`;
  o.style.width = `${(a.w - 56 * a.scale) * ratio}px`;
  o.style.height = `${(a.h - 100 * a.scale) * ratio}px`;
  artInteraction.hidden = !project.art;
  artInteraction.style.left = `${rect.left - stage.left + a.x * ratio}px`;
  artInteraction.style.top = `${rect.top - stage.top + a.y * ratio}px`;
  artInteraction.style.width = `${a.w * ratio}px`;
  artInteraction.style.height = `${a.h * ratio}px`;
}
$("initial-tier").addEventListener("change", () => {
  project.seed = resolveTier(project, current);
  delete project.seed.edited;
  project.initial = $("initial-tier").value;
  current = project.initial;
  syncForms();
  changed();
});
$("item-size").addEventListener("change", () => {
  project.size = $("item-size").value;
  syncTags();
  $("preview-label").textContent =
    `${QUALITIES.find((q) => q.id === current).name} · ${SIZES[project.size].name}`;
  changed();
});
$("hero").addEventListener("change", () => {
  project.hero = $("hero").value;
  syncHeroPicker();
  changed();
});
$("item-name").addEventListener("input", () => {
  project.name = $("item-name").value;
  changed();
});
$("independent-structure").addEventListener("change", () => {
  project.independentStructure = $("independent-structure").checked;
  changed();
});
$("active-enabled").addEventListener("change", () => {
  const active = $("active-enabled").checked;
  mutate((t) => (t.active = active), {
    warn: true,
    refresh: true,
    structure: true,
  });
});
$("passive-enabled").addEventListener("change", () => {
  const enabled = $("passive-enabled").checked;
  mutate((t) => (t.passiveEnabled = enabled), {
    warn: true, refresh: true, structure: true,
  });
});
$("add-effect").addEventListener("click", () => {
  if (resolveTier(project, current).effects.length >= 20)
    return toast("最多支持 20 条主动效果");
  mutate((t) => t.effects.push(""), {
    warn: true,
    refresh: true,
    structure: true,
  });
  document.querySelector(".effect-row:last-child textarea")?.focus();
});
$("add-quest").addEventListener("click", () => {
  if (resolveTier(project, current).quests.length >= 20)
    return toast("最多支持 20 条任务");
  mutate((t) => t.quests.push(defaultQuest()), {
    structure: true,
    warn: true,
    refresh: true,
  });
  $("quest-editor").open = true;
  document.querySelector(".quest-card:last-child textarea")?.focus();
});
$("passive").maxLength = 12000;
$("passive").addEventListener("focus", () => {
  focusSnapshot = clone(project);
});
$("passive").addEventListener("input", () => {
  editText("passive", null, $("passive").value);
  changed();
});
$("passive").addEventListener("blur", () => {
  checkStructure(focusSnapshot);
  focusSnapshot = null;
});
attachCompletion($("passive"), $("passive-wrap"));
for (const [toggle, field, key] of [
  ["ammo-enabled", "ammo", "ammo"],
  ["crit-enabled", "crit", "crit"],
  ["multicast-enabled", "multicast", "multicast"],
]) {
  $(toggle).addEventListener("change", () => {
    mutate((t) => (t[key + "Enabled"] = $(toggle).checked));
    $(field).disabled = !$(toggle).checked;
  });
  $(field).addEventListener("input", () => {
    const v = Number($(field).value);
    const max = key === "crit" ? 100 : 999;
    mutate(
      (t) =>
        (t[key] = Math.min(
          max,
          Math.max(
            key === "multicast" ? 1 : 0,
            Number.isFinite(v)
              ? key !== "crit"
                ? Math.floor(v)
                : Math.round(v * 10) / 10
              : 0,
          ),
        )),
    );
  });
}
$("reset-crop").addEventListener("click", () => {
  project.crop = { x: 0, y: 0, zoom: 1 };
  changed();
});
for (const id of ["upload-button", "upload-inline"])
  $(id).addEventListener("click", () => $("art-file").click());
async function upload(file) {
  if (!file) return;
  try {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
      throw new Error("请选择 PNG、JPG 或 WebP 图片");
    if (file.size > 20 * 1024 * 1024) throw new Error("图片不能超过 20 MB");
    const source = await readDataURL(file);
    await renderer.setArt(source);
    if (!renderer.art) throw new Error("无法读取图片，请尝试另一张图片");
    const im = renderer.art;
    let stored = source;
    if (Math.max(im.width, im.height) > 4096) {
      const ratio = 4096 / Math.max(im.width, im.height),
        c = document.createElement("canvas");
      c.width = Math.round(im.width * ratio);
      c.height = Math.round(im.height * ratio);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      stored = c.toDataURL(
        file.type === "image/png" ? "image/png" : "image/jpeg",
        0.94,
      );
      await renderer.setArt(stored);
    }
    project.art = stored;
    project.crop = { x: 0, y: 0, zoom: 1 };
    changed();
    toast("插画已放入卡框，可拖动与缩放");
  } catch (e) {
    toast(e.message);
  } finally {
    $("art-file").value = "";
  }
}
function readDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}
$("art-file").addEventListener("change", (e) => upload(e.target.files[0]));
const stage = $("preview-stage");
stage.addEventListener("dragover", (e) => {
  e.preventDefault();
  stage.classList.add("drag-over");
});
stage.addEventListener("dragleave", () => stage.classList.remove("drag-over"));
stage.addEventListener("drop", (e) => {
  e.preventDefault();
  stage.classList.remove("drag-over");
  upload(e.dataTransfer.files[0]);
});
function point(e) {
  const r = canvas.getBoundingClientRect(),
    l = renderer.lastLayout;
  return {
    x: ((e.clientX - r.left) * l.width) / r.width,
    y: ((e.clientY - r.top) * l.height) / r.height,
  };
}
function insideArt(p) {
  const a = renderer.lastLayout?.art;
  return a && p.x >= a.x && p.x <= a.x + a.w && p.y >= a.y && p.y <= a.y + a.h;
}
let drag = null,
  pointers = new Map(),
  pinch = null;
artInteraction.addEventListener("pointerdown", (e) => {
  if (!project.art || !insideArt(point(e))) return;
  artInteraction.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) drag = { p: point(e), crop: { ...project.crop } };
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      zoom: project.crop.zoom,
    };
    drag = null;
  }
});
artInteraction.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    project.crop.zoom = Math.max(
      0.3,
      Math.min(
        4,
        (pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) /
          Math.max(1, pinch.distance),
      ),
    );
  } else if (drag) {
    const p = point(e),
      a = renderer.lastLayout.art;
    project.crop.x = Math.max(
      -2,
      Math.min(2, drag.crop.x + (p.x - drag.p.x) / a.w),
    );
    project.crop.y = Math.max(
      -2,
      Math.min(2, drag.crop.y + (p.y - drag.p.y) / a.h),
    );
  }
  changed();
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  artInteraction.addEventListener(event, (e) => {
    pointers.delete(e.pointerId);
    drag = null;
    pinch = null;
  });
artInteraction.addEventListener(
  "wheel",
  (e) => {
    if (!project.art || !insideArt(point(e))) return;
    e.preventDefault();
    project.crop.zoom = Math.max(
      0.3,
      Math.min(4, project.crop.zoom * Math.exp(-e.deltaY * 0.001)),
    );
    changed();
  },
  { passive: false },
);
function cropKeys(e) {
  if (!project.art) return;
  const amount = e.shiftKey ? 0.04 : 0.01;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
    e.preventDefault();
    if (e.key === "ArrowLeft") project.crop.x -= amount;
    if (e.key === "ArrowRight") project.crop.x += amount;
    if (e.key === "ArrowUp") project.crop.y -= amount;
    if (e.key === "ArrowDown") project.crop.y += amount;
    changed();
  }
}
canvas.addEventListener("keydown", cropKeys);
artInteraction.addEventListener("keydown", cropKeys);
function showExport() {
  syncCompatibility();
  $("current-export-label").textContent =
    `${QUALITIES.find((q) => q.id === current).name}品质 · 当前效果与数值`;
  document.querySelector(
    `input[name="export-mode"][value="${compatible(project) ? "all" : "current"}"]`,
  ).checked = true;
  $("export-enchantments").checked = editorPage === "enchantments";
  $("export-dialog").showModal();
  updateExportPreview();
}
for (const id of ["export-open", "export-bottom"])
  $(id).addEventListener("click", showExport);
document
  .querySelectorAll(".dialog-close")
  .forEach((b) =>
    b.addEventListener("click", () => b.closest("dialog").close()),
  );
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
function safeName() {
  return (project.name || "我的物品")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .slice(0, 55);
}
const exportRenderer = new Renderer();
exportRenderer.images = renderer.images;
let exportPreviewEpoch = 0, exportPreviewState = null;
function clearExportPreview() {
  exportPreviewEpoch++;
  if (exportPreviewState) URL.revokeObjectURL(exportPreviewState.url);
  exportPreviewState = null;
  $("export-preview").removeAttribute("src");
  $("export-preview").hidden = true;
  $("export-view-original").hidden = true;
  $("export-view-original").removeAttribute("href");
  $("export-download").disabled = true;
}
async function updateExportPreview() {
  const dialog = $("export-dialog");
  if (!dialog.open) return;
  const request = ++exportPreviewEpoch;
  const mode = document.querySelector('input[name="export-mode"]:checked').value;
  const scale = Number($("export-scale").value);
  const background = $("export-background").value;
  const includeEnchantments = $("export-enchantments").checked;
  if (includeEnchantments) {
    refreshEnchantments(project);
    buildEnchantmentFields();
    changed();
  }
  const snapshot = clone(project), tierId = current, art = renderer.art,
    backgroundImage = renderer.backgroundImage;
  const filename = `${safeName()}_${mode === "all" ? "全等级" : QUALITIES.find((q) => q.id === tierId).name}${includeEnchantments ? "_附魔" : ""}.png`;
  $("export-download").disabled = true;
  $("export-preview").hidden = true;
  $("export-view-original").hidden = true;
  $("export-preview-status").textContent = "正在生成预览…";
  $("export-preview-status").classList.remove("error");
  try {
    if (mode === "all" && !compatible(snapshot))
      throw new Error("各品质效果结构不同，请选择当前品质");
    await document.fonts.ready;
    if (request !== exportPreviewEpoch || !dialog.open) return;
    exportRenderer.art = art;
    exportRenderer.backgroundImage = backgroundImage;
    const imageCanvas = document.createElement("canvas");
    exportRenderer.render(imageCanvas, snapshot, tierId, { mode, scale, background, includeEnchantments });
    const blob = await new Promise((resolve) => imageCanvas.toBlob(resolve, "image/png"));
    if (request !== exportPreviewEpoch || !dialog.open) return;
    if (!blob) throw new Error("图片生成失败，请选择较低清晰度");
    if (exportPreviewState) URL.revokeObjectURL(exportPreviewState.url);
    const url = URL.createObjectURL(blob);
    exportPreviewState = { blob, url, filename };
    $("export-preview").src = url;
    await $("export-preview").decode();
    if (request !== exportPreviewEpoch || !dialog.open) return;
    $("export-preview").hidden = false;
    $("export-view-original").href = url;
    $("export-view-original").hidden = false;
    $("export-preview-status").textContent = `${imageCanvas.width} × ${imageCanvas.height} 像素`;
    $("export-download").disabled = false;
  } catch (error) {
    if (request !== exportPreviewEpoch || !dialog.open) return;
    $("export-preview-status").textContent = error.message;
    $("export-preview-status").classList.add("error");
  }
}
for (const control of document.querySelectorAll('input[name="export-mode"], #export-background, #export-scale, #export-enchantments'))
  control.addEventListener("change", updateExportPreview);
$("export-dialog").addEventListener("close", clearExportPreview);
$("export-download").addEventListener("click", () => {
  if (!exportPreviewState || $("export-download").disabled) return;
  download(exportPreviewState.blob, exportPreviewState.filename);
  $("export-dialog").close();
  toast("PNG 图片已生成");
});
$("new-project").addEventListener("click", async () => {
  if (
    (project.name || project.art) &&
    !window.confirm("新建会替换当前作品。请先保存作品文件备份。")
  )
    return;
  project = createProject();
  backgroundUploadEpoch++;
  renderer.backgroundImage = null;
  current = "bronze";
  setEditorPage("base");
  await renderer.setArt(null);
  syncForms();
  changed();
});
function saveProject() {
  download(
    new Blob([JSON.stringify(project)], { type: "application/json" }),
    `${safeName()}.bazaar.json`,
  );
  toast("可编辑作品已保存");
}
$("save-project").addEventListener("click", saveProject);
$("save-project-bottom").addEventListener("click", saveProject);
$("open-project").addEventListener("click", () => $("project-file").click());
$("project-file").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const previous = project;
  try {
    if (f.size > 65 * 1024 * 1024) throw new Error("作品文件过大");
    const parsed = validateProject(JSON.parse(await f.text()));
    const backgroundImage = await decodeBackground(parsed.background.image);
    await renderer.setArt(parsed.art);
    if (parsed.art && !renderer.art) throw new Error("作品中的图片无法读取");
    project = parsed;
    backgroundUploadEpoch++;
    renderer.backgroundImage = backgroundImage;
    current = project.initial;
    setEditorPage("base");
    syncForms();
    changed();
    toast("作品已打开");
  } catch (err) {
    await renderer.setArt(previous.art);
    toast(err.message || "作品文件无法读取");
  } finally {
    e.target.value = "";
  }
});
let dbPromise;
function database() {
  return (dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("bazaar-diy", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("works");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}
async function saveLocal(data) {
  const snapshot = clone(data);
  for (const t of [snapshot.seed, ...Object.values(snapshot.tiers)].filter(
    Boolean,
  ))
    if (t.cd !== "" && Number.isFinite(Number(t.cd)))
      t.cd = Number(t.cd).toFixed(1);
  const db = await database();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("works", "readwrite");
    tx.objectStore("works").put(snapshot, "latest");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function loadLocal() {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db.transaction("works").objectStore("works").get("latest");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
new ResizeObserver(schedulePaint).observe($("preview-stage"));
window.addEventListener("resize", positionOverlay);
syncForms();
schedulePaint();
document.querySelector(".workspace").inert = true;
document.querySelector(".header-actions").inert = true;
$("save-status").textContent = "正在载入游戏素材…";
try {
  const saved = await loadLocal();
  if (saved) {
    const restored = validateProject(saved);
    const backgroundImage = await decodeBackground(restored.background.image);
    project = restored;
    renderer.backgroundImage = backgroundImage;
    current = project.initial;
    await renderer.setArt(project.art);
    syncForms();
    $("save-status").textContent = "已恢复上次作品";
  }
} catch {
  $("save-status").textContent = "本地存储不可用";
}
await renderer.load();
document.querySelector(".workspace").inert = false;
document.querySelector(".header-actions").inert = false;
if ($("save-status").textContent === "正在载入游戏素材…")
  $("save-status").textContent = "本地工坊";
schedulePaint();
