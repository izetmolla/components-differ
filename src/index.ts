#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { program } from "commander";

import {
  scanForAlteredFiles,
  scanForFiles,
  hasSrcDir,
  type ScannedFile,
} from "./git.js";
import { readComponentsManifest } from "./components.js";
import { createDiff } from "./create-diff.js";
import { expandIncludedFiles } from "./resolve-imports.js";

function runCommand(command: string): void {
  try {
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error(`Failed to execute command: ${command}`);
    process.exit(1);
  }
}

function ensureGitignore(): void {
  const gitignorePath = path.join(process.cwd(), ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    const content = `
/node_modules
/.pnp
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# env files (can opt-in for committing if needed)
.env*

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
`;
    fs.writeFileSync(gitignorePath, content, "utf8");
  }
}

function main(): void {
  program
    .option("-n, --name <name>")
    .option("--init")
    .option("-f, --folder <folder>", "folder to include (default: current directory)")
    .option("--git", "use git mode: only files changed since initial commit");
  program.parse();

  const options = program.opts<{
    name?: string;
    init?: boolean;
    folder?: string;
    git?: boolean;
  }>();

  if (options.init) {
    // Initialize a clean git repository for the current component
    if (process.platform === "win32") {
      runCommand(
        'rmdir /s /q .git && git init && git add . && git commit -m "Initial commit"',
      );
    } else {
      runCommand(
        'rm -fr .git && git init && git add . && git commit -m "Initial commit"',
      );
    }
    ensureGitignore();
    return;
  }

  const useFolderMode = !options.git;
  const folderOpt = options.folder ?? (useFolderMode ? "." : undefined);

  const baseName = folderOpt != null
    ? path.basename(path.resolve(process.cwd(), folderOpt))
    : path.basename(process.cwd());
  const name = options.name || baseName;

  let alteredFiles: ScannedFile[];
  let specificFiles: Record<string, string>;

  if (useFolderMode && folderOpt != null) {
    const folderPath = path.resolve(process.cwd(), folderOpt);
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      console.error(
        `Folder path is not a directory: ${folderOpt}`,
      );
      process.exit(1);
    }

    const folderPrefix = path
      .relative(process.cwd(), folderPath)
      .replace(/\\/g, "/")
      .replace(/^\.\//, "");

    const allFiles = scanForFiles(process.cwd());
    alteredFiles = allFiles.filter(({ path: filePath }) => {
      const normalized = filePath.replace(/\\/g, "/");
      return (
        normalized === folderPrefix ||
        normalized.startsWith(`${folderPrefix}/`)
      );
    });

    specificFiles = {
      "./package.json": "{}",
    };
  } else {
    const result = scanForAlteredFiles(["./package.json"]);
    alteredFiles = result.alteredFiles;
    specificFiles = result.specificFiles;
  }

  const currentFiles = scanForFiles(process.cwd());

  const currentPackageJson = fs.readFileSync("./package.json", "utf-8");

  const config = readComponentsManifest(process.cwd());
  (config as any).isSrcDir = hasSrcDir(process.cwd());

  // Recursively add any project file imported by the included files so the
  // registry item is self-contained (no "component not found").
  alteredFiles = expandIncludedFiles(alteredFiles, currentFiles, config as any);

  const output = createDiff({
    name,
    config,
    alteredFiles,
    currentFiles,
    specificFiles,
    currentPackageJson,
  });

  // Emit a complete registry:block JSON object suitable for local file support
  // (e.g. `npx shadcn add ./block.json`)
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(output, null, 2));
}

main();

