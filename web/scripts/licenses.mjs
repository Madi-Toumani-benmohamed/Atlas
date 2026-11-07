import { execFileSync } from "node:child_process";
import {
  mkdir,
  readFile,
  readdir,
  copyFile,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
const root = resolve(".");
const modules = execFileSync("npm", ["ls", "--omit=dev", "--parseable", "--all"], {
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .filter((path) => path.startsWith(root + "/node_modules/"));
const lines = [
  "Atlas Portfolio — third-party notices",
  "",
  "Project license: /licenses/Atlas-LICENSE",
  "Backend notices: /licenses/backend/NOTICE.txt",
  "",
];
for (const path of modules) {
  const pkg = JSON.parse(await readFile(join(path, "package.json"), "utf8"));
  const name = pkg.name.replaceAll("/", "_");
  const target = join("dist/licenses", name);
  await mkdir(target, { recursive: true });
  const notices = (await readdir(path)).filter((file) =>
    /^(licen[cs]e|copying|notice|copyright|patents)([.-].*)?$/i.test(file),
  );
  if (!notices.length) throw Error(`Missing license for ${pkg.name}`);
  for (const file of notices) {
    await copyFile(join(path, file), join(target, file));
    lines.push(`${pkg.name} ${pkg.version}: /licenses/${name}/${file}`);
  }
}
await mkdir("dist/licenses", { recursive: true });
await writeFile("dist/licenses/NOTICE.txt", lines.join("\n") + "\n");
