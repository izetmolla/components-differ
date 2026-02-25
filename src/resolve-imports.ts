import path from "node:path";
import type { ComponentsConfig } from "./components.js";
import { extractPathSpecifiers } from "./extract-imports.js";
import type { ScannedFile } from "./git.js";

const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mts", ".mjs", ".cts", ".cjs"];
const INDEX_NAMES = ["index.tsx", "index.ts", "index.jsx", "index.js"];

/** Build [aliasPrefix, pathPrefix] pairs, longest first. pathPrefix is project-relative (e.g. src/lib when isSrcDir). */
function getAliasEntries(config: ComponentsConfig & { isSrcDir?: boolean }): [string, string][] {
  const entries: [string, string][] = [];
  const prefix = config.isSrcDir ? "src/" : "";
  const keys: (keyof ComponentsConfig)[] = ["components", "utils", "ui", "lib", "hooks"];
  for (const k of keys) {
    const v = config[k];
    if (typeof v === "string" && v.startsWith("@/")) {
      const pathPart = v.replace(/^@\//, "").replace(/\/$/, "");
      entries.push([v.replace(/\/$/, ""), prefix + pathPart]);
    }
  }
  entries.push(["@", config.isSrcDir ? "src" : ""]);
  entries.sort((a, b) => b[0].length - a[0].length);
  return entries;
}

/**
 * Resolve a path-like import specifier to a project-relative file path.
 * Tries common extensions and /index.*. Returns the first path that exists in projectPaths.
 */
function resolveSpecifier(
  specifier: string,
  fromFilePath: string,
  aliasEntries: [string, string][],
  projectPaths: Set<string>,
  rootFallback: string,
): string | null {
  const normalizedFrom = fromFilePath.replace(/\\/g, "/");
  const fromDir = path.dirname(normalizedFrom).replace(/\\/g, "/");

  let candidate: string;

  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    candidate = path.normalize(path.join(fromDir, specifier)).replace(/\\/g, "/");
  } else {
    // Alias: @/components/Button -> components/Button
    let matched = false;
    for (const [aliasPrefix, pathPrefix] of aliasEntries) {
      const prefix = aliasPrefix === "@" ? "@/" : aliasPrefix.endsWith("/") ? aliasPrefix : aliasPrefix + "/";
      if (specifier === aliasPrefix || specifier.startsWith(prefix)) {
        const suffix = specifier.slice(prefix.length).replace(/^\//, "");
        candidate = path.normalize(path.join(pathPrefix, suffix)).replace(/\\/g, "/");
        matched = true;
        break;
      }
    }
    if (!matched) {
      const suffix = specifier.replace(/^@\//, "").replace(/^~\//, "");
      candidate = path.normalize(path.join(rootFallback, suffix)).replace(/\\/g, "/");
    }
  }

  if (!candidate) return null;
  if (projectPaths.has(candidate)) return candidate;

  for (const ext of EXTENSIONS) {
    const p = candidate.endsWith(ext) ? candidate : candidate + ext;
    if (projectPaths.has(p)) return p;
  }
  for (const name of INDEX_NAMES) {
    const p = candidate.endsWith("/") ? candidate + name : candidate + "/" + name;
    if (projectPaths.has(p)) return p;
  }
  return null;
}

/**
 * Expand the list of included files by recursively adding any project file
 * that is imported (via relative or alias path) by an already-included file.
 * Uses TypeScript/JS import syntax only.
 */
export function expandIncludedFiles(
  includedFiles: ScannedFile[],
  allProjectFiles: ScannedFile[],
  config: ComponentsConfig & { isSrcDir?: boolean },
): ScannedFile[] {
  const projectPathToFile = new Map<string, ScannedFile>();
  for (const f of allProjectFiles) {
    const key = f.path.replace(/\\/g, "/");
    projectPathToFile.set(key, f);
  }
  const projectPaths = new Set(projectPathToFile.keys());
  const aliasEntries = getAliasEntries(config);
  const rootFallback = config.isSrcDir ? "src" : "";

  const includedPaths = new Set<string>();
  for (const f of includedFiles) {
    includedPaths.add(f.path.replace(/\\/g, "/"));
  }

  let added = true;
  while (added) {
    added = false;
    for (const file of [...includedFiles]) {
      const content = file.content;
      const fromPath = file.path.replace(/\\/g, "/");
      for (const spec of extractPathSpecifiers(content)) {
        const resolved = resolveSpecifier(spec, fromPath, aliasEntries, projectPaths, rootFallback);
        if (resolved && !includedPaths.has(resolved)) {
          const scanned = projectPathToFile.get(resolved);
          if (scanned) {
            includedFiles.push(scanned);
            includedPaths.add(resolved);
            added = true;
          }
        }
      }
    }
  }

  return includedFiles;
}
