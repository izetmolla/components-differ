## components-differ

CLI to generate shadcn-compatible registry items (`registry:block`) from your project.

You can use it in two ways:

- **Folder mode** (default): create a registry item from every file in a folder (default: current directory).
- **Git mode** (`--git`): create a registry item from files changed since the initial git commit.

### Install & build

From the `differ` folder:

```bash
pnpm install
pnpm build
```

After building, you can run the CLI with `node` or via the `components-differ` bin (if linked/installed).

### Default: folder mode (current directory)

Run with no arguments to generate a registry item from the **current folder** (and all files it imports):

```bash
# from your project root – includes whole project and resolves imports
components-differ > block.json

# optional name
components-differ -n my-block > block.json
```

Or target a specific folder:

```bash
components-differ --folder src/app/dashboard -n dashboard-block > block.json
components-differ --folder src/app/dashboard > block.json
```

### Git mode (changed files only)

Use `--git` when you want a registry item only from files changed since the initial commit:

```bash
# initialize a clean git history first
components-differ --init

# after making changes, generate from changed files only
components-differ --git -n my-block > block.json
```

### Add the block locally

```bash
npx shadcn add ./block.json
```

### Options summary

- **`--init`**: initialize a clean git repo and first commit (for use with `--git` later).
- **`-n, --name <name>`**: registry item name; defaults to current (or folder) name.
- **`-f, --folder <folder>`**: folder to include (default: current directory). Ignored if `--git` is set.
- **`--git`**: use git mode (only files changed since initial commit).

