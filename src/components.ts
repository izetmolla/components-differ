import path from "node:path";
import fs from "node:fs";

const WHITELISTED_COMPONENTS = [
  "accordion",
  "alert",
  "alert-dialog",
  "aspect-ratio",
  "avatar",
  "badge",
  "breadcrumb",
  "button",
  "button-group",
  "calendar",
  "card",
  "carousel",
  "chart",
  "checkbox",
  "collapsible",
  "combobox",
  "command",
  "context-menu",
  "data-table",
  "date-picker",
  "dialog",
  "drawer",
  "dropdown-menu",
  "empty",
  "field",
  "form",
  "hover-card",
  "input",
  "input-group",
  "input-otp",
  "item",
  "kbd",
  "label",
  "menubar",
  "native-select",
  "navigation-menu",
  "pagination",
  "popover",
  "progress",
  "radio-group",
  "resizable",
  "scroll-area",
  "select",
  "separator",
  "sheet",
  "sidebar",
  "skeleton",
  "slider",
  "sonner",
  "spinner",
  "switch",
  "table",
  "tabs",
  "textarea",
  "toast",
  "toggle",
  "toggle-group",
  "tooltip",
  "typography",
] as const;

type WhitelistedComponent = (typeof WHITELISTED_COMPONENTS)[number];

export interface ComponentsConfig {
  components: string;
  utils: string;
  ui: string;
  lib: string;
  hooks: string;
  registries?: Record<string, unknown>;
  isSrcDir?: boolean;
}

function findComponentsJson(startDir: string): string | null {
  let currentDir = startDir;

  while (true) {
    const manifestPath = path.join(currentDir, "components.json");
    if (fs.existsSync(manifestPath)) {
      return manifestPath;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

export function findComponentFiles(
  config: ComponentsConfig,
  originalFiles: { path: string }[],
): string[] {
  const registryDependencies: string[] = [];
  const compDir = config.ui.replace("@/", config.isSrcDir ? "src/" : "");

  const registriesConfig = config.registries ?? {};
  const registryNamespaces = Object.keys(registriesConfig);
  const defaultNamespace =
    registryNamespaces.find((name) => name === "@shadcn") ??
    registryNamespaces[0] ??
    null;

  for (const { path: filePath } of originalFiles) {
    if (filePath.startsWith(compDir)) {
      const fileExtension = path.extname(filePath);
      const fileName = path.basename(filePath, fileExtension) as WhitelistedComponent;
      if (
        (fileExtension === ".tsx" || fileExtension === ".jsx") &&
        WHITELISTED_COMPONENTS.includes(fileName)
      ) {
        const baseName = path.basename(filePath, fileExtension);
        const dependencyName = defaultNamespace
          ? `${defaultNamespace}/${baseName}`
          : baseName;
        registryDependencies.push(dependencyName);
      }
    }
  }

  return registryDependencies;
}

export function readComponentsManifest(dir: string): ComponentsConfig {
  const manifestPath = findComponentsJson(dir);

  if (!manifestPath) {
    console.error("Components manifest (components.json) not found");
    process.exit(1);
  }

  const json = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
    aliases: Omit<ComponentsConfig, "registries" | "isSrcDir">;
    registries?: ComponentsConfig["registries"];
  };

  return {
    ...json.aliases,
    registries: json.registries ?? {},
  };
}

export function getAliasedPaths(config: ComponentsConfig): string[] {
  return [
    config.components.replace("@/", ""),
    config.utils.replace("@/", ""),
    config.ui.replace("@/", ""),
    config.lib.replace("@/", ""),
    config.hooks.replace("@/", ""),
  ];
}

export function isBuiltinComponent(
  config: ComponentsConfig,
  filePath: string,
): boolean {
  if (filePath.startsWith(config.ui.replace("@/", ""))) {
    const component = path.basename(filePath, path.extname(filePath));
    return (WHITELISTED_COMPONENTS as readonly string[]).includes(component);
  }
  return false;
}

