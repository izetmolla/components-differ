import {
  findComponentFiles,
  getAliasedPaths,
  isBuiltinComponent,
  type ComponentsConfig,
} from "./components.js";
import { parseFilePath, type ParsedFile } from "./parse-file-path.js";
import { extractImportedPackages } from "./extract-imports.js";
import type { ScannedFile } from "./git.js";

interface CreateDiffOptions {
  name: string;
  config: ComponentsConfig & { isSrcDir?: boolean };
  alteredFiles: ScannedFile[];
  specificFiles: Record<string, string>;
  currentFiles: ScannedFile[];
  currentPackageJson: string;
}

export interface RegistryDiffOutput {
  name: string;
  type: "registry:block";
  dependencies: string[];
  devDependencies: string[];
  registryDependencies: string[];
  files: ParsedFile[];
  tailwind: Record<string, unknown>;
  cssVars: Record<string, unknown>;
  meta: Record<string, unknown>;
}

function addFile(
  output: RegistryDiffOutput,
  config: ComponentsConfig,
  inSrcDir: boolean,
  relativeFilePath: string,
  content: string,
): void {
  output.files.push(
    parseFilePath(inSrcDir, config, `./${relativeFilePath}`, content),
  );
}

function addDependencies(
  output: RegistryDiffOutput,
  _initialPackageContents: string,
  currentPackageContents: string,
  usedPackages: Set<string>,
): void {
  const currentPackageJson = JSON.parse(currentPackageContents) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const currentDependencies = currentPackageJson.dependencies ?? {};
  const currentDevDependencies = currentPackageJson.devDependencies ?? {};

  const shadcnNamespaces = new Set(
    output.registryDependencies
      .map((dep) => dep.split("/")[0])
      .filter((ns) => ns === "@shadcn"),
  );

  const shouldKeepDep = (dep: string): boolean => {
    if (!usedPackages.has(dep)) return false;
    if (!shadcnNamespaces.size) return true;

    if (dep === "shadcn/ui") return false;

    for (const ns of shadcnNamespaces) {
      if (dep === ns || dep === `${ns}/ui`) {
        return false;
      }
    }

    return true;
  };

  // Only include packages that are actually imported in the registry item files
  // (and exist in package.json so we know dep vs devDep). No other deps.
  output.dependencies = Object.keys(currentDependencies).filter(shouldKeepDep);
  output.devDependencies = Object.keys(currentDevDependencies).filter(shouldKeepDep);
}

function scanWithSrcDir(
  output: RegistryDiffOutput,
  config: ComponentsConfig,
  alteredFiles: ScannedFile[],
): void {
  for (const { path, content } of alteredFiles) {
    if (path.startsWith("src/")) {
      addFile(output, config, true, path.replace("src/", ""), content);
    } else {
      addFile(output, config, false, path, content);
    }
  }
}

function isInAppDir(filePath: string): boolean {
  return filePath.startsWith("app/");
}

function scanWithoutSrcDir(
  output: RegistryDiffOutput,
  config: ComponentsConfig,
  alteredFiles: ScannedFile[],
): void {
  const aliasedPaths = getAliasedPaths(config);

  for (const { path, content } of alteredFiles) {
    const inSrcDir = aliasedPaths.includes(path) || isInAppDir(path);
    addFile(output, config, inSrcDir, path, content);
  }
}

export function createDiff({
  name,
  config,
  alteredFiles,
  specificFiles,
  currentFiles,
  currentPackageJson,
}: CreateDiffOptions): RegistryDiffOutput {
  const output: RegistryDiffOutput = {
    name,
    type: "registry:block",
    dependencies: [],
    devDependencies: [],
    registryDependencies: [],
    files: [],
    tailwind: {},
    cssVars: {},
    meta: {},
  };

  if (config.isSrcDir) {
    scanWithSrcDir(output, config, alteredFiles);
  } else {
    scanWithoutSrcDir(output, config, alteredFiles);
  }

  output.registryDependencies = findComponentFiles(config, currentFiles);

  const usedPackages = extractImportedPackages(alteredFiles);
  addDependencies(
    output,
    specificFiles["./package.json"],
    currentPackageJson,
    usedPackages,
  );

  return output;
}

