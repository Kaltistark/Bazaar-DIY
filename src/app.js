import { QUALITIES, SIZES, HEROES, TYPES, KEYWORDS } from "./data.js";
import {
  createProject,
  defaultTier,
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
  questTarget,
  questComplete,
  textValue,
  setTextValue,
} from "./model.js";
import { Renderer } from "./renderer.js";
import { fieldCompletion, COMPLETION_EXAMPLES } from "./completion.js";
const $ = (id) => document.getElementById(id),
  renderer = new Renderer();
let project = createProject(),
  current = "bronze",
  saveTimer,
  paintPending = false,
  lastEditable = null,
  focusSnapshot = null,
  pendingStructure = null,
  toastTimer;
const canvas = $("preview"),
  artInteraction = $("art-interaction"),
  tierButtons = new Map();
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
for (const [input, result] of COMPLETION_EXAMPLES) {
  const row = document.createElement("div"),
    code = document.createElement("code"),
    text = document.createElement("span");
  code.textContent = input;
  text.textContent = result;
  row.append(code, text);
  $("completion-examples").append(row);
}
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
      const hint = document.createElement("small");
      hint.textContent = "Tab 接受";
      ghost.append(hint);
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
    toast("已接受效果补全");
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
for (const kw of KEYWORDS) {
  const b = document.createElement("button");
  b.className = "keyword-chip";
  b.style.setProperty("--keyword-color", kw.color);
  b.title = `插入${kw.name}`;
  if (kw.icon) {
    const img = new Image();
    img.src = `./assets/icons/${kw.icon}.png`;
    img.alt = "";
    img.onerror = () => img.remove();
    b.append(img);
  }
  b.append(document.createTextNode(kw.name));
  b.addEventListener("pointerdown", (e) => e.preventDefault());
  b.addEventListener("click", () => {
    const target = lastEditable?.isConnected
      ? lastEditable
      : document.querySelector(".effect-text") || $("passive");
    target.focus();
    target.setRangeText(
      kw.name,
      target.selectionStart,
      target.selectionEnd,
      "end",
    );
    target.dispatchEvent(new Event("input", { bubbles: true }));
  });
  $("keyword-chips").append(b);
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
  $("independent-structure").checked = !!project.independentStructure;
  $("active-enabled").checked = t.active;
  $("active-editor").hidden = !t.active;
  $("cooldown").value = t.cd;
  $("passive").value = t.passive;
  $("ammo-enabled").checked = t.ammoEnabled;
  $("ammo").value = t.ammo;
  $("ammo").disabled = !t.ammoEnabled;
  $("crit-enabled").checked = t.critEnabled;
  $("crit").value = t.crit;
  $("crit").disabled = !t.critEnabled;
  $("art-zoom").value = project.crop.zoom;
  $("zoom-value").value = `${Math.round(project.crop.zoom * 100)}%`;
  $("preview-label").textContent =
    `${QUALITIES.find((q) => q.id === current).name} · ${SIZES[project.size].name}`;
  $("editing-tier").textContent =
    `正在编辑 · ${QUALITIES.find((q) => q.id === current).name}`;
  syncTags();
  buildEffectFields(t);
  buildQuestFields(t);
  syncCompatibility();
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
      lastEditable = ta;
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
function buildQuestFields(t) {
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
        lastEditable = ta;
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
    const icons = document.createElement("select");
    icons.setAttribute("aria-label", `任务 ${i + 1} 奖励图标`);
    icons.append(
      option("auto", "自动匹配奖励关键词"),
      option("quest-lock", "解锁效果 · 锁"),
    );
    for (const k of KEYWORDS.filter((k) => k.icon))
      icons.append(option(k.icon, k.name));
    icons.value = q.icon;
    icons.addEventListener("change", () =>
      mutate(
        (t) => {
          t.quests[i].icon = icons.value;
        },
        { structure: true, warn: true },
      ),
    );
    labelFor("奖励图标", icons);
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
    function updateState() {
      const value = resolveTier(project, current).quests[i];
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
        scale: Math.min(devicePixelRatio || 1, 2),
        stacked,
      });
      positionOverlay();
    } catch (e) {
      toast(e.message);
    }
  });
}
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
$("cooldown").addEventListener("input", () => {
  let value = $("cooldown").value.replace(/[^\d.]/g, "");
  const parts = value.split(".");
  value =
    (parts.length > 1 ? parts[0] || "0" : parts[0]).slice(0, 3) +
    (parts.length > 1 ? "." + parts[1].slice(0, 1) : "");
  $("cooldown").value = value;
  mutate((t) => (t.cd = value));
});
$("cooldown").addEventListener("blur", () => {
  const value = $("cooldown").value;
  if (value !== "" && Number.isFinite(Number(value)))
    mutate((t) => (t.cd = Number(value).toFixed(1)), { refresh: true });
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
  lastEditable = $("passive");
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
]) {
  $(toggle).addEventListener("change", () => {
    mutate((t) => (t[key + "Enabled"] = $(toggle).checked));
    $(field).disabled = !$(toggle).checked;
  });
  $(field).addEventListener("input", () => {
    const v = Number($(field).value);
    const max = key === "ammo" ? 999 : 100;
    mutate(
      (t) =>
        (t[key] = Math.min(
          max,
          Math.max(
            0,
            Number.isFinite(v)
              ? key === "ammo"
                ? Math.floor(v)
                : Math.round(v * 10) / 10
              : 0,
          ),
        )),
    );
  });
}
$("art-zoom").addEventListener("input", () => {
  project.crop.zoom = Number($("art-zoom").value);
  $("zoom-value").value = `${Math.round(project.crop.zoom * 100)}%`;
  changed();
});
$("reset-crop").addEventListener("click", () => {
  project.crop = { x: 0, y: 0, zoom: 1 };
  $("art-zoom").value = 1;
  $("zoom-value").value = "100%";
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
    $("art-zoom").value = 1;
    $("zoom-value").value = "100%";
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
  $("art-zoom").value = project.crop.zoom;
  $("zoom-value").value = `${Math.round(project.crop.zoom * 100)}%`;
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
    $("art-zoom").value = project.crop.zoom;
    $("zoom-value").value = `${Math.round(project.crop.zoom * 100)}%`;
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
async function loadExample() {
  try {
    const blob = await (await fetch("./assets/demo-art.jpg")).blob();
    await upload(new File([blob], "示例.jpg", { type: "image/jpeg" }));
    project = createProject();
    project.art = await readDataURL(blob);
    project.name = "海底热泉";
    project.hero = "vanessa";
    project.types = ["水系"];
    project.tiers.bronze = {
      ...defaultTier(),
      edited: true,
      cd: "7.0",
      effects: ["造成3灼烧。", "多重触发：3。"],
    };
    [6, 9, 12].forEach((n, i) => {
      project.tiers[QUALITIES[i + 1].id] = {
        ...defaultTier(),
        edited: true,
        cd: "7.0",
        effects: [`造成${n}灼烧。`, "多重触发：3。"],
      };
    });
    current = "bronze";
    await renderer.setArt(project.art);
    syncForms();
    changed();
    toast("已载入示例，可直接编辑");
  } catch (e) {
    toast("示例未能加载：" + e.message);
  }
}
$("load-example").addEventListener("click", () => {
  if (project.name || project.art) {
    if (!window.confirm("载入示例会替换当前作品。可以先保存作品文件备份。"))
      return;
  }
  loadExample();
});
function showExport() {
  syncCompatibility();
  $("current-export-label").textContent =
    `${QUALITIES.find((q) => q.id === current).name}品质 · 当前效果与数值`;
  document.querySelector(
    `input[name="export-mode"][value="${compatible(project) ? "all" : "current"}"]`,
  ).checked = true;
  $("export-dialog").showModal();
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
$("export-download").addEventListener("click", async () => {
  const b = $("export-download");
  b.disabled = true;
  b.textContent = "正在生成图片…";
  try {
    const mode = document.querySelector(
      'input[name="export-mode"]:checked',
    ).value;
    if (mode === "all" && !compatible(project))
      throw new Error("各品质效果结构不同，请导出当前品质");
    await document.fonts.ready;
    await renderer.setArt(project.art);
    const exportCanvas = document.createElement("canvas");
    renderer.render(exportCanvas, clone(project), current, {
      mode,
      scale: Number($("export-scale").value),
      background: $("export-background").value,
    });
    const blob = await new Promise((resolve) =>
      exportCanvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("图片生成失败，请选择较低清晰度");
    download(
      blob,
      `${safeName()}_${mode === "all" ? "全等级" : QUALITIES.find((q) => q.id === current).name}.png`,
    );
    $("export-dialog").close();
    toast("PNG 图片已生成");
    schedulePaint();
  } catch (e) {
    toast(e.message);
  } finally {
    b.disabled = false;
    b.textContent = "下载 PNG 图片";
  }
});
$("new-project").addEventListener("click", async () => {
  if (
    (project.name || project.art) &&
    !window.confirm("新建会替换当前作品。请先保存作品文件备份。")
  )
    return;
  project = createProject();
  current = "bronze";
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
    if (f.size > 35 * 1024 * 1024) throw new Error("作品文件过大");
    const parsed = validateProject(JSON.parse(await f.text()));
    await renderer.setArt(parsed.art);
    if (parsed.art && !renderer.art) throw new Error("作品中的图片无法读取");
    project = parsed;
    current = project.initial;
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
    project = validateProject(saved);
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
