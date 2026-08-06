#!/usr/bin/env node
/**
 * `jumpcloud-sso` — the CLI shipped with @tetrascience-npm/jumpcloud-sso.
 *
 * Onboarding entry point:
 *
 *   npx @tetrascience-npm/jumpcloud-sso setup
 *
 * Scaffolds the SSO integration into an existing Next.js or Express project:
 * writes the wiring files, merges an env-var block into .env.example, and
 * prints the remaining manual steps (install, secrets, JumpCloud redirect
 * URI). Never overwrites existing files unless --force is passed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import type { PackageManager, ProjectType, SetupPlan } from './lib/plan.js';
import { buildPlan, mergeEnvExample } from './lib/plan.js';

const HELP = `jumpcloud-sso — JumpCloud OIDC SSO for TetraScience internal apps

Usage:
  npx @tetrascience-npm/jumpcloud-sso setup [options]

Scaffolds SSO into an existing Next.js (App Router) or Express project.

Options:
  -t, --type <next|express>  Integration to scaffold (default: auto-detected
                             from the project's package.json dependencies)
  -d, --dir <path>           Project directory (default: current directory)
  -f, --force                Overwrite files that already exist
  -y, --yes                  Skip the confirmation prompt
  -h, --help                 Show this help

Docs: https://github.com/tetrascience/ts-lib-jumpcloud-sso
`;

interface CliOptions {
  type?: ProjectType;
  dir: string;
  force: boolean;
  yes: boolean;
}

function fail(message: string): never {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function parseCli(
  argv: string[],
): { command: string | undefined } & CliOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      type: { type: 'string', short: 't' },
      dir: { type: 'string', short: 'd', default: '.' },
      force: { type: 'boolean', short: 'f', default: false },
      yes: { type: 'boolean', short: 'y', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(HELP);
    process.exit(0);
  }
  if (
    values.type !== undefined &&
    values.type !== 'next' &&
    values.type !== 'express'
  ) {
    fail(`Unknown --type "${values.type}" — expected "next" or "express".`);
  }

  return {
    command: positionals[0],
    type: values.type as ProjectType | undefined,
    dir: resolve(values.dir),
    force: values.force,
    yes: values.yes,
  };
}

/** Reads the target project's package.json dependencies (empty on absence). */
function readDependencies(dir: string): Record<string, string> {
  const manifestPath = join(dir, 'package.json');
  if (!existsSync(manifestPath)) {
    return {};
  }
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return { ...manifest.dependencies, ...manifest.devDependencies };
  } catch {
    return {};
  }
}

function detectType(deps: Record<string, string>): ProjectType | undefined {
  const hasNext = 'next' in deps;
  const hasExpress = 'express' in deps;
  if (hasNext && !hasExpress) {
    return 'next';
  }
  if (hasExpress && !hasNext) {
    return 'express';
  }
  return undefined; // neither, or both — the user has to say.
}

function detectPackageManager(dir: string): PackageManager {
  if (existsSync(join(dir, 'yarn.lock'))) {
    return 'yarn';
  }
  if (existsSync(join(dir, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  return 'npm';
}

/** Next.js only: does the app tree live under `src/`? */
function detectSrcDir(dir: string): boolean {
  if (existsSync(join(dir, 'app'))) {
    return false;
  }
  return existsSync(join(dir, 'src', 'app')) || existsSync(join(dir, 'src'));
}

async function promptType(): Promise<ProjectType> {
  if (!process.stdin.isTTY) {
    fail(
      'Could not auto-detect the project type and no terminal is attached — ' +
        'pass it explicitly: --type next | --type express',
    );
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const answer = (
        await rl.question(
          'What kind of project is this?\n  1) Next.js (App Router)\n  2) Express (BFF for a React SPA)\nSelect 1 or 2: ',
        )
      ).trim();
      if (answer === '1' || answer.toLowerCase() === 'next') {
        return 'next';
      }
      if (answer === '2' || answer.toLowerCase() === 'express') {
        return 'express';
      }
      console.log(`Sorry, "${answer}" is not an option.`);
    }
  } finally {
    rl.close();
  }
}

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return true; // non-interactive: --yes semantics (the plan was printed).
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${question} [Y/n] `))
      .trim()
      .toLowerCase();
    return answer === '' || answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

function applyPlan(plan: SetupPlan, options: CliOptions): void {
  const written: string[] = [];
  const skipped: string[] = [];

  for (const file of plan.files) {
    const target = join(options.dir, file.path);
    if (existsSync(target) && !options.force) {
      skipped.push(`${file.path} (exists — re-run with --force to overwrite)`);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.contents);
    written.push(file.path);
  }

  const envPath = join(options.dir, '.env.example');
  const existingEnv = existsSync(envPath)
    ? readFileSync(envPath, 'utf8')
    : null;
  const mergedEnv = mergeEnvExample(existingEnv, plan.envExample);
  if (mergedEnv !== null) {
    writeFileSync(envPath, mergedEnv);
    written.push('.env.example');
  } else {
    skipped.push('.env.example (already has JUMPCLOUD_CLIENT_ID)');
  }

  console.log('');
  for (const path of written) {
    console.log(`  ✔ wrote   ${path}`);
  }
  for (const entry of skipped) {
    console.log(`  ↷ skipped ${entry}`);
  }

  console.log('\nNext steps:');
  plan.nextSteps.forEach((step, index) => {
    console.log(`  ${index + 1}. ${step}`);
  });
  console.log('');
}

async function runSetup(options: CliOptions): Promise<void> {
  if (!existsSync(options.dir)) {
    fail(`Directory not found: ${options.dir}`);
  }
  if (!existsSync(join(options.dir, 'package.json'))) {
    fail(
      `No package.json in ${options.dir} — run this inside an existing ` +
        'Next.js or Express project (or pass --dir).',
    );
  }

  const type =
    options.type ??
    detectType(readDependencies(options.dir)) ??
    (await promptType());

  const plan = buildPlan(type, {
    hasSrcDir: type === 'next' && detectSrcDir(options.dir),
    packageManager: detectPackageManager(options.dir),
  });

  console.log(
    `\nSetting up JumpCloud SSO (${type}) in ${options.dir}\n\nFiles to create:`,
  );
  for (const file of plan.files) {
    console.log(`  - ${file.path}`);
  }
  console.log('  - .env.example (merged)');

  if (!options.yes && !(await confirm('\nProceed?'))) {
    console.log('Aborted — nothing written.');
    return;
  }

  applyPlan(plan, options);
}

const cli = parseCli(process.argv.slice(2));

if (cli.command === undefined || cli.command === 'help') {
  console.log(HELP);
  process.exit(cli.command === undefined ? 1 : 0);
}
if (cli.command !== 'setup') {
  fail(
    `Unknown command "${cli.command}" — try: npx @tetrascience-npm/jumpcloud-sso setup`,
  );
}

await runSetup(cli);
