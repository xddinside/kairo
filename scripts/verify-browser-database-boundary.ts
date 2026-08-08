import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const roots = ["src/routes", "src/components", "src/state", "dist/client", ".output/public"];
const forbidden = /(?:drizzle-orm|postgres(?:-js)?|@neondatabase|DATABASE_URL|DIRECT_DATABASE_URL|CLERK_SECRET_KEY|kairo_(?:runtime|migrator)|NEON)/i;

const walk = async (root: string): Promise<string[]> => {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const path = join(root, entry.name);
      if (entry.isDirectory()) files.push(...(await walk(path)));
      else if (/\.(?:ts|tsx|js|mjs|css|html)$/.test(entry.name)) files.push(path);
    }
    return files;
  } catch {
    return [];
  }
};

const violations: string[] = [];
for (const root of roots) {
  for (const file of await walk(root)) {
    const source = await readFile(file, "utf8");
    if (forbidden.test(source)) violations.push(file);
  }
}

if (violations.length > 0) {
  console.error(`Browser database boundary failed in: ${violations.join(", ")}`);
  process.exit(1);
}
console.log(`Browser database boundary passed for ${roots.join(", ")}.`);
