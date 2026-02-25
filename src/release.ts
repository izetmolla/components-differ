import { spawnSync } from "node:child_process";

type VersionBump = "patch" | "minor" | "major";

function run(command: string, args: string[] = []) {
  const full = [command, ...args].join(" ");
  console.log(`\n$ ${full}`);

  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(`\nCommand failed: ${full}`);
    process.exit(result.status === null ? 1 : result.status);
  }
}

function getVersionBumpFromArgs(): VersionBump {
  const type = (process.argv[2] as VersionBump | undefined) ?? "patch";
  if (!["patch", "minor", "major"].includes(type)) {
    console.error(
      `Invalid version bump "${type}". Use one of: patch, minor, major.`
    );
    process.exit(1);
  }
  return type;
}

function ensureCleanGit() {
  const result = spawnSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    console.error("Failed to check git status.");
    process.exit(1);
  }

  if ((result.stdout ?? "").trim().length > 0) {
    console.error(
      "Git working tree is not clean. Commit or stash your changes before releasing."
    );
    process.exit(1);
  }
}

async function main() {
  const bump = getVersionBumpFromArgs();

  console.log("Ensuring clean git working tree...");
  ensureCleanGit();

  console.log("\nBuilding project...");
  run("npm", ["run", "build"]);

  console.log(`\nBumping version (${bump})...`);
  run("npm", ["version", bump]);

  console.log("\nPublishing to npm...");
  run("npm", ["publish"]);

  console.log("\nRelease complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

