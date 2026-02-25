import path from "node:path";
import type { ComponentsConfig } from "./components.js";

function fixAlias(alias: string): string {
  return alias.replace("@", ".");
}

export type RegistryFileType =
  | "registry:example"
  | "registry:ui"
  | "registry:block"
  | "registry:hook"
  | "registry:lib"
  | "registry:page"
  | "registry:theme"
  | "registry:style"
  | "registry:file"
  | "registry:component";

export interface ParsedFile {
  path: string;
  content: string;
  type: RegistryFileType;
  target?: string;
}

export function parseFilePath(
  wasInSrcDir: boolean,
  config: ComponentsConfig,
  filePath: string,
  content: string,
): ParsedFile {
  const normalizedPath = filePath.replace(/^\.\//, "");
  const extension = path.extname(normalizedPath);
  const baseName = path.basename(normalizedPath);

  const styleExtensions = new Set([
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".pcss",
  ]);
  const fileExtensions = new Set([
    ".json",
    ".yaml",
    ".yml",
    ".md",
    ".mdx",
    ".txt",
  ]);
  const themePattern = /(\/|^)(theme|.*-theme)(\.[a-z0-9]+)?$/i;

  const sanitizedTargetPath = normalizedPath.replace(/^src\//, "");
  const defaultTarget = wasInSrcDir ? filePath : `~/${normalizedPath}`;

  const out: ParsedFile = {
    path: filePath,
    content,
    type: "registry:example",
    target: defaultTarget,
  };

  if (filePath.startsWith(fixAlias(config.ui))) {
    out.type = "registry:ui";
    out.target = undefined;
  } else if (filePath.startsWith(fixAlias(config.components))) {
    out.type = "registry:block";
    out.target = undefined;
  } else if (filePath.startsWith(fixAlias(config.hooks))) {
    out.type = "registry:hook";
    out.target = undefined;
  } else if (filePath.startsWith(fixAlias(config.lib))) {
    out.type = "registry:lib";
    out.target = undefined;
  } else if (normalizedPath.startsWith("app/")) {
    out.type = "registry:page";
    out.target = `./${sanitizedTargetPath}`;
  } else if (themePattern.test(normalizedPath)) {
    out.type = "registry:theme";
    out.target = undefined;
  } else if (styleExtensions.has(extension)) {
    out.type = "registry:style";
  } else if (baseName.startsWith(".env") || fileExtensions.has(extension)) {
    out.type = "registry:file";
    out.target = `~/${sanitizedTargetPath}`;
  } else if (extension === ".tsx" || extension === ".jsx") {
    out.type = "registry:component";
    out.target = undefined;
  } else {
    out.type = "registry:file";
    out.target = `./${sanitizedTargetPath}`;
  }

  return out;
}

