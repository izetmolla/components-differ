import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import ignore from "ignore";

const INITIAL_DIR = "_initial";

const EXCLUDE_DIRS = [
  "node_modules",
  "dist",
  "fonts",
  "build",
  "public",
  "static",
  ".next",
  ".git",
  INITIAL_DIR,
];

const EXCLUDE_FILES = [
  ".DS_Store",
  "next-env.d.ts",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "package.json",
  "tailwind.config.ts",
  "tailwind.config.js",
  "components.json",
  "favicon.ico",
];

function cloneInitialCommit(): void {
  deleteInitialDir();

  try {
    const initialCommit = execSync("git rev-list --max-parents=0 HEAD")
      .toString()
      .trim();

    execSync(`git worktree add -f ${INITIAL_DIR} ${initialCommit}`, {
      stdio: "ignore",
    });
  } catch (error: any) {
    console.error("Error cloning initial commit:", error.message);
    process.exit(1);
  }
}

function deleteInitialDir(): void {
  if (fs.existsSync(INITIAL_DIR)) {
    fs.rmSync(INITIAL_DIR, { recursive: true, force: true });

    try {
      execSync("git worktree prune", { stdio: "ignore" });
    } catch (error: any) {
      console.error("Error pruning git worktree:", error.message);
    }
  }
}

function checkIfFileIsChanged(relativeFilePath: string): boolean {
  const initialFilePath = path.join(INITIAL_DIR, relativeFilePath);
  const fullPath = path.join(process.cwd(), relativeFilePath);
  if (!fs.existsSync(initialFilePath)) {
    return true;
  }
  const currentContent = fs.readFileSync(fullPath, "utf-8");
  const initialContent = fs.readFileSync(initialFilePath, "utf-8");
  return currentContent !== initialContent;
}

export interface ScannedFile {
  path: string;
  content: string;
}

export function scanForFiles(
  startDir: string,
  checkFile = false,
): ScannedFile[] {
  const foundFiles: ScannedFile[] = [];

  let ignorer: (relativeFilePath: string) => boolean = () => false;
  const gitignorePath = path.join(startDir, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const gitIgnore = ignore().add(
      fs.readFileSync(gitignorePath).toString(),
    );
    ignorer = (relativeFilePath: string) => gitIgnore.ignores(relativeFilePath);
  }

  function scanDirectory(dir: string, relativePath = ""): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativeFilePath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.includes(entry.name)) {
          scanDirectory(path.join(dir, entry.name), relativeFilePath);
        }
      } else if (
        !checkFile ||
        (checkFile && checkIfFileIsChanged(relativeFilePath))
      ) {
        if (
          !EXCLUDE_FILES.includes(entry.name) &&
          !ignorer(relativeFilePath)
        ) {
          foundFiles.push({
            path: relativeFilePath,
            content: fs.readFileSync(fullPath, "utf-8"),
          });
        }
      }
    }
  }

  scanDirectory(startDir);

  return foundFiles.sort((a, b) => a.path.localeCompare(b.path));
}

export function scanForAlteredFiles(
  specificFilesToReturn: string[] = [],
): {
  alteredFiles: ScannedFile[];
  specificFiles: Record<string, string>;
} {
  cloneInitialCommit();

  const alteredFiles = scanForFiles(process.cwd(), true);

  const specificFiles = specificFilesToReturn.reduce<Record<string, string>>(
    (out, file) => {
      const fullPath = path.join(process.cwd(), INITIAL_DIR, file);
      out[file] = fs.existsSync(fullPath)
        ? fs.readFileSync(fullPath, "utf-8")
        : "";
      return out;
    },
    {},
  );

  deleteInitialDir();

  return {
    alteredFiles,
    specificFiles,
  };
}

export function hasSrcDir(dir: string): boolean {
  return fs.existsSync(path.join(dir, "src"));
}

