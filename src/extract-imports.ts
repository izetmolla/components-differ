/**
 * Extract npm package names from import/require statements in source code.
 * Used to include only dependencies that are actually used by the registry item files.
 */

/**
 * Returns the root package name for a specifier. Handles scoped packages and subpaths.
 * - "react" -> "react"
 * - "lodash/merge" -> "lodash"
 * - "@scope/pkg" -> "@scope/pkg"
 * - "@scope/pkg/sub" -> "@scope/pkg"
 */
function specifierToPackageName(specifier: string): string | null {
  const s = specifier.trim();
  if (!s) return null;
  // Node / bundler builtins
  if (s.startsWith("node:") || s === "node") return null;
  // Relative imports – not packages
  if (s.startsWith(".") || s.startsWith("/")) return null;
  // Common path aliases (not package names)
  if (s.startsWith("@/") || s.startsWith("~/") || s.startsWith("#")) return null;
  // Scoped package: @scope/pkg or @scope/pkg/subpath
  if (s.startsWith("@")) {
    const firstSlash = s.indexOf("/");
    if (firstSlash === -1) return s;
    const secondSlash = s.indexOf("/", firstSlash + 1);
    return secondSlash === -1 ? s : s.slice(0, secondSlash);
  }
  // Normal package or subpath
  const slash = s.indexOf("/");
  return slash === -1 ? s : s.slice(0, slash);
}

const RE_IMPORT =
  /(?:import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?|import\s*)['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * Collect all package names that are imported or required in the given file content.
 */
function extractFromContent(content: string): Set<string> {
  const packages = new Set<string>();
  let m: RegExpExecArray | null;
  RE_IMPORT.lastIndex = 0;
  while ((m = RE_IMPORT.exec(content)) !== null) {
    const specifier = (m[1] ?? m[2] ?? m[3]) ?? "";
    const pkg = specifierToPackageName(specifier);
    if (pkg) packages.add(pkg);
  }
  return packages;
}

/**
 * Collect all package names imported by any of the given files (by their content).
 */
export function extractImportedPackages(files: { content: string }[]): Set<string> {
  const all = new Set<string>();
  for (const { content } of files) {
    for (const pkg of extractFromContent(content)) {
      all.add(pkg);
    }
  }
  return all;
}

/** True if the import specifier refers to a project file (relative or path alias), not npm. */
export function isPathSpecifier(specifier: string): boolean {
  const s = specifier.trim();
  if (!s || s.startsWith("node:")) return false;
  if (s.startsWith(".") || s.startsWith("/")) return true;
  if (s.startsWith("@/") || s.startsWith("~/") || s.startsWith("#")) return true;
  return false;
}

/**
 * Extract all import/require specifiers that are project paths (relative or alias)
 * from file content. Used to pull in imported files into the registry.
 */
export function extractPathSpecifiers(content: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  RE_IMPORT.lastIndex = 0;
  while ((m = RE_IMPORT.exec(content)) !== null) {
    const specifier = (m[1] ?? m[2] ?? m[3]) ?? "";
    if (isPathSpecifier(specifier)) out.push(specifier);
  }
  return out;
}
