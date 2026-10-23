import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { AGENTS, AGENT_IDS, isKnownAgent } from "./agents.ts";
import type { AgentSpec } from "./agents.ts";
import { detectPresentAgents, detectStack } from "./detector.ts";
import type { TechDef } from "./catalog.ts";
import { generate } from "./generator.ts";
import { writeForAgents } from "./writer.ts";
import { bold, cyan, dim, green, log, red, write, yellow, SHOW_CURSOR } from "./colors.ts";
import { multiSelect, printBanner, formatTime } from "./ui.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const VERSION: string = (() => {
  for (const base of [__dirname, resolve(__dirname, "..")]) {
    const p = join(base, "package.json");
    if (!existsSync(p)) continue;
    try {
      const pkg = JSON.parse(readFileSync(p, "utf-8"));
      if (pkg.name === "autostackrc") return pkg.version;
    } catch {}
  }
  return "0.0.0";
})();

process.on("SIGINT", () => {
  write(SHOW_CURSOR + "\n");
  process.exit(130);
});

interface CliArgs {
  autoYes: boolean;
  dryRun: boolean;
  noLlm: boolean;
  verbose: boolean;
  help: boolean;
  model?: string;
  coder?: string;
  agents: string[];
}

function parseArgs(argv: string[]): CliArgs {
  const agents: string[] = [];
  const ai = argv.findIndex((a) => a === "-a" || a === "--agent");
  if (ai !== -1) {
    for (let i = ai + 1; i < argv.length; i++) {
      if (argv[i]!.startsWith("-")) break;
      agents.push(argv[i]!);
    }
  }
  const mi = argv.findIndex((a) => a === "--model");
  const model = mi !== -1 ? argv[mi + 1] : undefined;
  const ci = argv.findIndex((a) => a === "--coder");
  const coder = ci !== -1 ? argv[ci + 1] : undefined;

  return {
    autoYes: argv.includes("-y") || argv.includes("--yes"),
    dryRun: argv.includes("--dry-run"),
    noLlm: argv.includes("--no-llm"),
    verbose: argv.includes("-v") || argv.includes("--verbose"),
    help: argv.includes("-h") || argv.includes("--help"),
    model: model && !model.startsWith("-") ? model : undefined,
    coder: coder && !coder.startsWith("-") ? coder : undefined,
    agents,
  };
}

function showHelp(): void {
  log(`
  ${bold("autostackrc")} — Generate rules & commands for your AI code assistants

  ${bold("Usage:")}
    npx autostackrc                        Detect stack, generate, write (interactive)
    npx autostackrc ${dim("-y")}                     Skip prompts, accept defaults
    npx autostackrc ${dim("--dry-run")}              Show what would be written
    npx autostackrc ${dim("-a claude-code cursor")}  Target specific assistants
    npx autostackrc ${dim("--no-llm")}               Static templates only (offline)

  ${bold("Options:")}
    -y, --yes         Skip confirmation prompts
    --dry-run         Show plan, write nothing
    -a, --agent       Target subset: ${AGENT_IDS.join(", ")}
    --no-llm          Skip enrichment, emit static templates only
    --coder <id>      Force coder CLI: claude, opencode, cursor-agent
    --model <id>      Model hint passed to the coder CLI (if it supports it)
    -v, --verbose     Show traces and error detail
    -h, --help        Show this help

  ${bold("Enrichment:")}
    Uses your installed AI coder CLI (claude / opencode / cursor-agent) and its
    existing login session — no API key. Falls back to static templates if none.
`);
}

function printDetected(techs: TechDef[], language: string, pm: string): void {
  log(cyan("   ◆ ") + bold("Detected stack") + dim(`  (${language}, ${pm})`));
  log();
  const width = Math.max(...techs.map((t) => t.name.length)) + 3;
  const COLS = 3;
  for (let i = 0; i < techs.length; i += COLS) {
    const row = techs
      .slice(i, i + COLS)
      .map((t) => green("✔ ") + t.name.padEnd(width))
      .join("");
    log("     " + row);
  }
  log();
}

async function selectTechs(techs: TechDef[], autoYes: boolean): Promise<TechDef[]> {
  if (autoYes) return techs;
  log(cyan("   ◆ ") + bold("Select technologies to generate for"));
  log();
  return multiSelect(techs, {
    labelFn: (t) => t.name,
    groupFn: (t) => t.category,
    initialSelected: techs.map(() => true),
  });
}

async function selectAgents(resolved: AgentSpec[], autoYes: boolean): Promise<AgentSpec[]> {
  if (autoYes) return resolved;
  log(cyan("   ◆ ") + bold("Select target assistants"));
  log();
  return multiSelect(resolved, {
    labelFn: (a) => a.name,
    hintFn: (a) => a.blurb,
    initialSelected: resolved.map(() => true),
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // Validate any explicit agent tokens.
  for (const a of args.agents) {
    if (!isKnownAgent(a)) {
      log(red(`   ✘ Unknown assistant: ${a}`));
      log(dim(`   Known: ${AGENT_IDS.join(", ")}`));
      process.exit(1);
    }
  }

  printBanner(VERSION);

  const projectDir = resolve(".");
  write(dim("   Scanning project...\r"));
  const traces: string[] = [];
  const stack = detectStack(projectDir, { onTrace: args.verbose ? (m) => traces.push(m) : undefined });
  write("\x1b[K");
  for (const t of traces) log(dim(`     ${t}`));

  if (stack.techs.length === 0) {
    log(yellow("   ⚠ No supported technologies detected."));
    log(dim("   Run this inside a project directory."));
    process.exit(0);
  }

  printDetected(stack.techs, stack.language, stack.packageManager);

  // Resolve target assistants.
  let agentIds: string[];
  if (args.agents.length > 0) {
    agentIds = args.agents;
  } else {
    const present = detectPresentAgents(projectDir);
    agentIds = present.length > 0 ? present : AGENT_IDS;
  }
  const resolvedAgents = AGENTS.filter((a) => agentIds.includes(a.id));

  // Interactive selection.
  const selectedTechs = await selectTechs(stack.techs, args.autoYes);
  if (selectedTechs.length === 0) {
    log(dim("\n   Nothing selected.\n"));
    process.exit(0);
  }
  const selectedAgents = await selectAgents(resolvedAgents, args.autoYes);
  if (selectedAgents.length === 0) {
    log(dim("\n   No assistants selected.\n"));
    process.exit(0);
  }

  const chosenStack = { ...stack, techs: selectedTechs };

  log();
  log(
    cyan("   ◆ ") +
      bold(args.noLlm ? "Building from templates..." : "Generating (delegating to your coder)..."),
  );
  const start = Date.now();

  const { content, enriched, enrichedBy, warning } = await generate(chosenStack, {
    llm: !args.noLlm,
    coder: args.coder,
    model: args.model,
    onTrace: args.verbose ? (m) => log(dim(`     ${m}`)) : undefined,
  });

  const agentTokens = selectedAgents.map((a) => a.id);
  const { written } = writeForAgents(content, agentTokens, {
    projectDir,
    dryRun: args.dryRun,
  });

  const elapsed = Date.now() - start;

  log();
  if (warning) log(yellow(`   ⚠ ${warning}`));
  log(
    dim(
      `   ${content.rules.length} rules · ${content.commands.length} commands · ${enriched ? `enriched by ${enrichedBy}` : "static"}`,
    ),
  );
  log();

  const verb = args.dryRun ? "Would write" : "Wrote";
  log(cyan("   ◆ ") + bold(`${verb} ${written.length} files`));
  log();
  for (const f of [...written].sort()) {
    log(dim("     ") + (args.dryRun ? dim(f) : green("✔ ") + f));
  }
  log();

  if (args.dryRun) {
    log(dim("   --dry-run: nothing was written.\n"));
  } else {
    log(green(bold(`   ✔ Done in ${formatTime(elapsed)}.`)));
    log(dim(`   Targets: ${agentTokens.join(", ")}`));
    log();
  }
}

main().catch((err: Error) => {
  console.error(red(`\n   Error: ${err.message}\n`));
  process.exit(1);
});
