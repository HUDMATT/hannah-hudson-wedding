import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

const entries = [
  "assets",
  "index.html",
  "rsvp.html",
  "registry.html",
  "gallery.html",
  "admin.html",
  "guest-info.html",
  "_routes.json",
];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const entry of entries) {
  cpSync(join(root, entry), join(dist, entry), { recursive: true });
}
