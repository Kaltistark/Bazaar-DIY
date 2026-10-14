import { mkdir, copyFile, cp, rm } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(process.cwd());
const output = path.resolve(root, "dist");
const includeSkills = process.argv.includes("--include-skills");
if (path.dirname(output) !== root || path.basename(output) !== "dist")
  throw new Error("Unexpected build directory");
await rm(output, { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const file of ["index.html", "styles.css", ...(includeSkills ? ["skills.html", "skills.css"] : [])])
  await copyFile(file, `dist/${file}`);
await cp("src", "dist/src", { recursive: true,
  filter: source => includeSkills || !path.basename(source).startsWith("skill-"),
});
await cp("public/assets", "dist/assets", {
  recursive: true,
  filter: (source) =>
    !source.endsWith(".ttf") &&
    !["icons-source", "heroes-source", "examples", ...(!includeSkills ? ["skills"] : [])].some((part) =>
      source.split(path.sep).includes(part),
    ),
});
console.log("静态网站已生成：dist/");
