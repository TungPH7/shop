// What gh-guard refuses to agents (quality-gates spec section 2.7): skipping the git hooks, pushing to a protected
// branch, working on a PR or writing through the GitHub API with your account, taking your token or an App key,
// changing the repository settings, starting or disabling its workflows or deleting their runs, running ao-pr.mjs
// with the other role's App, putting the basic auth password of Development and Staging on a command line, and editing protected paths. With the roster, also the role rules of agent-roster spec 2.10 (lib/agents/scope.mjs):
// files outside the role's paths, and git commands that change the checkout for read-only roles. Pure.
// Commands are read the way a shell splits them, with the script of sh -c and eval, the command after a wrapper such as
// env or timeout, and any git or gh further on: good enough for what agents write, not proof against a determined one.
// A file written by a Bash command, such as a redirection, is not checked; the role rules cover Edit and Write.
import { posix } from 'node:path';
import { gitRefusal, writeRefusal } from '../agents/scope.mjs';
import { NON_AGENT_ROLES, WEB_ROLES } from '../rules/references.mjs';
import { configReads, gitSubcommand } from './git-options.mjs';
import { matchesGlob } from './glob.mjs';
import { dependencyProblems, installRefusal, installTargets, SOURCE_NAME, SOURCE_VARIABLE, workspaceCatalogs } from './dependencies.mjs';

const allow = { allow: true };
const deny = (reason) => ({ allow: false, reason: `gh-guard: ${reason}` });

const HOOKS = 'do not skip or move the git hooks; fix what they report';
const TOKEN = 'do not take or change the GitHub token of your account';
const KEY = 'do not read the private key of a GitHub App; ao-pr.mjs uses it for you';
const CREDENTIAL = "do not set a git credential helper: git gets your role's token from the session (dev-workflow spec 2.3)";
const IDENTITY = 'do not set, export or clear GIT_CONFIG_*, GH_TOKEN or the other variables of the session: they hold the git hooks, the credential helper of your role and the read-only token (dev-workflow spec 2.3)';
const STDIN = 'run the commands themselves: gh-guard cannot check a shell that reads its commands from stdin';
const ENCODED = 'run the command itself: gh-guard cannot check an encoded PowerShell command';
// The variables lib/agents/launch.mjs sets or clears for the session, and those git and gh read in their place.
const SESSION_NAMES = 'GIT_CONFIG\\w*|GIT_ASKPASS|SSH_ASKPASS|GIT_TERMINAL_PROMPT|GIT_EXEC_PATH|GH_TOKEN|GH_ENTERPRISE_TOKEN|GITHUB_TOKEN|GITHUB_ENTERPRISE_TOKEN|GH_CONFIG_DIR|GH_HOST|GH_PROMPT_DISABLED';
const SESSION_VARIABLE = new RegExp(`^(?:${SESSION_NAMES})$`, 'i');
// PowerShell reaches them through $env:, the Env: drive and [Environment]::SetEnvironmentVariable.
const POWERSHELL_ENV = new RegExp(`(?:\\benv:[\\\\/]*|SetEnvironmentVariable\\(\\s*['"])(?:${SESSION_NAMES})\\b`, 'i');
// Your user variables of Windows, where the kit keeps its tokens, the CI token among them (reviews of shop PR #21,
// security). gh-guard refuses the usual ways to read them: the user hive by any name (HKCU, HKEY_CURRENT_USER, HKU,
// HKEY_USERS, the PowerShell drive HKCU:), whatever key follows; GetEnvironmentVariable(s) in any form; the registry API
// of .NET; COM (WScript.Shell); WMI (Win32_Environment, wmic); and /proc, where Git Bash shows the registry and the
// environment of your other processes. Agents need none of them: the scripts of the kit read the tokens for you.
// This catches mistakes and an agent led astray by plain words; it is no boundary. gh-guard reads the words of a command,
// and an agent runs as your Windows user, so it can read what you can, through a script it writes and runs or a spelling
// no list holds: four rounds of review each found one more. It is a risk you accept until the tokens leave the user
// variables and the CI token leaves the machine (open).
const USER_VARIABLES = /(?:^|[\s'"=(;&|])\/proc\b|\b(?:HKCU|HKEY_CURRENT_USER|HKU|HKEY_USERS)\b|GetEnvironmentVariables?\b|EnvironmentVariableTarget|Microsoft\.Win32\.Registry|\[Registry\]|WScript\.Shell|ComObject|\bWin32_Environment\b|\bwmic\b/i;
const USER_VARIABLES_REASON = 'do not read the user variables of Windows: they hold the tokens of the kit, which its scripts read for you';
// The scripts that start agents and buy their tokens (dev-workflow spec 2.3, plan decision 5), in any letter case, as
// Windows reads them. Matched at the end of a word: an unquoted Windows path loses its backslashes in the shell.
const ORCHESTRATION = /(ao-step|ao-agent|ao-git-credential)\.mjs$/i;
const GIT_DIR = ".git/ holds git's own settings and hooks: change them with git commands, not by editing the files";
const KEY_FILE = /\.pem\b|ao-keys|AO_(?:DEV|REVIEW|MERGE)_APP_KEY/i;
// The backups of every environment (Pilot 3, spec 2.9): the age identity that opens them, the encrypted copies, the
// folder your machine pulls them into, %USERPROFILE%\.ao where the pull keeps its state (and the identity lay before),
// and the script that pulls and opens them. An agent runs as your Windows user, so gh-guard stops the plain ways; that
// the identity stays off the machine is what holds (review of shop PR #13).
const BACKUP = 'do not read the backup copies or the identity that opens them, and do not run ao-backup-pull.mjs: they hold the data of every environment';
// .ao counts where a path starts: at the start, after a slash, a space, a quote or = (review round 3 of shop PR #13:
// `cd ~ && cat .ao/backup-pull.json` passed).
const BACKUP_FILE = /\.agekey\b|\.dump\.age\b|ao-backups|ao-backup-pull|(?:^|[\s'"=\\/])\.ao(?:[\\/\s'"]|$)/i;
// The marks a private key starts with (review round 3 of shop PR #13), and the five dashes of any PEM block (review of
// shop PR #21): a search for them over your user folder prints the keys of the Apps, whatever the files are called.
// Any character may stand between the words, as a regex has it. Round 4 refused only a command that also named your
// user folder, and Git Bash names it in more ways than a list holds ($USERPROFILE, $HOMEDRIVE$HOMEPATH, a bare cd, /c),
// so a command with a mark now passes only as one git command that stays in the repository (repoOnly): a message of git
// commit, or a search of git grep or git log. The rounds of the review of shop PR #21 found a way past each looser rule
// (cd and git init before it, $_ after it, grep -f - behind a pipe, git log --output): so the line is that git command
// alone, with no redirection, run from a folder of the project. security scans the project with Grep, which its path
// keeps in the project. Round 4 added the usual spellings of the mark: BEGIN with the kind of key, the regex forms of the
// space and the dashes. Like USER_VARIABLES above, this catches mistakes, not an agent set on reading the keys (it runs
// as you, and the kit says so in lib/agents/launch.mjs); holding the App keys away from it needs another account.
// The headers of a PEM block (BEGIN RSA PRIVATE KEY, BEGIN OPENSSH PRIVATE KEY), as a search writes them: in any case,
// with any number of spaces, or with a regex form between the words. Each regex form (REGEX_GAP: \s, \S, \w, \x20, a
// dot, a class such as [A-Z ] or [[:space:]], with its count) becomes GAP first. Then BEGIN, spaces or gaps, and the
// kind of key is a search; so is BEGIN, a gap and KEY within a few words (BEGIN.*KEY, BEGIN [A-Z ]*KEY); and so is the
// upper case header with single spaces. Review round 5 of shop PR #21 matched only the last of these, so grep -ri
// "begin rsa" and BEGIN.*KEY passed (review of shop PR #74, Medium). Still no key search: a SQL transaction (BEGIN; …
// PRIMARY KEY), a test title (begins recording, begin the key step), a word glued to begin (BeginKeyTest).
const GAP = '\u0001';
const REGEX_GAP = /(?:\\[sSwW]|\\x20|\.|\[(?:[^[\]]|\[:[a-z]+:\])+\])(?:[*+?]|\{\d*,?\d*\})?/g;
const KEY_KIND = /\bbegin[ \u0001]+\(?(?:\?:)?(?:rsa|ec|dsa|openssh|encrypted|private|pgp)\b/i;
const KEY_GAP = /\bbegin[ \u0001]*\u0001[ \u0001a-z]{0,40}?key\b/i;
const PEM_UPPER = /\bBEGIN (?:[A-Z]+ ){0,3}KEY\b/;
const PEM_HEADER = { test: (text) => [KEY_KIND, KEY_GAP, PEM_UPPER].some((header) => header.test(text.replace(REGEX_GAP, GAP))) };
const KEY_WORDS = /PRIVATE(?:.{0,3}|\[\[:space:\]\])KEY|AGE.{0,2}SECRET.{0,2}KEY|-{5}BEGIN|-\{\d\}\s*BEGIN/i;
const KEY_MARK = { test: (text) => KEY_WORDS.test(text) || PEM_HEADER.test(text) };
const KEY_SEARCH = 'do not search for a private key: ao-pr.mjs and git get the tokens of your role for you; to scan the project for committed keys, use Grep, or git grep alone on its line from a folder of the project';
// git grep options that read outside the files git tracks (--no-index, --untracked) or start a program
// (--open-files-in-pager, -O alone or in a group such as -nO), by any start git takes for them; git log --output writes
// what it prints to a file.
const GREP_OUTSIDE = /^--(?:no-in|u|op)|^-[A-Za-z]*O/;
const LOG_OUTSIDE = /^--ou/;

// A command that holds a mark of a private key, and stays in the repository: git with no option of its own (-c, -C,
// --work-tree), no variable set before it and no command run inside a word ($( or a backtick), running commit, log
// without --output, or grep without GREP_OUTSIDE.
function repoOnly(words) {
  // bash expands $ (variables, $( ), $'…'), backticks and braces before git sees the words, so a word with any of them
  // may become an option the checks below never saw, such as {<mark>,--no-index} (review round 4 of shop PR #21).
  if (words.env.length > 0 || words.some((word) => /[$`{}]/.test(word))) return false;
  if (programOf(words[0]) !== 'git') return false;
  const { index } = gitSubcommand(words);
  if (index !== 1) return false;
  const [sub, ...rest] = words.slice(1);
  if (sub === 'commit') return true;
  if (sub === 'log') return !rest.some((word) => LOG_OUTSIDE.test(word));
  return sub === 'grep' && !rest.some((word) => GREP_OUTSIDE.test(word));
}

// Whether a command line searches for a private key: it holds a mark and is not one repoOnly command alone, with no
// redirection. checkAgentCall also refuses it from a working folder outside the project.
function searchesForKey(command) {
  if (!KEY_MARK.test(command)) return false;
  const parts = segments(command);
  return command.includes('>') || parts.length !== 1 || !repoOnly(parts[0]);
}

// What a path, or a glob or pattern of Grep and Glob, may not name: keys, the token of gh, the backups. undefined when
// it names none of them.
function forbiddenFile(text) {
  if (KEY_FILE.test(text)) return deny(KEY);
  if (BACKUP_FILE.test(text)) return deny(BACKUP);
  if (GH_HOSTS_FILE.test(text)) return deny(TOKEN);
  return undefined;
}
// gh auth token prints your token, and so does gh auth status with -t, alone or in a group such as -at (after -h the
// rest of the group is the host name); login, switch and the others change it.
const TOKEN_COMMAND = /\bgh(?:\.exe)?\s+auth\s+(?:token|login|logout|switch|refresh|setup-git|git-credential)\b|\bgh(?:\.exe)?\s+auth\s+status\b[^\n;&|]*\s(?:--show-token\b|-[^-h\s]*t)/;
// Without the system keyring, gh keeps your token in hosts.yml: in %AppData%\GitHub CLI on Windows, ~/.config/gh elsewhere.
const GH_HOSTS_FILE = /(?:GitHub CLI|[\\/]gh)[\\/]+hosts\.yml\b/i;

// The main session is you, and agents outside the contract (plugins, Explore) are not checked here. roster, the
// project's agents/roster.yaml, adds the role rules; without it they are skipped. tempDir is the one folder outside the
// project that Edit and Write may reach.
// approved: () => the approved libraries of project.yaml, or undefined where there is none (C1 spec section 5); it rides
// on the gates the command checks get. readFile: (path) => the text of a file of the project, or '' when it has none.
// For a role that reads web pages: ignored, (path inside the project) => whether git ignores it; searched, () => the
// URLs the WebSearch calls of this run gave (webRoleCall).
export function checkAgentCall(input, { gates: kitGates, contract, projectDir, roster, tempDir, approved, readFile = () => '', ignored, searched }) {
  const gates = approved ? { ...kitGates, approvedLibraries: approved } : kitGates;
  const role = input.agent_type;
  const agentRoles = contract.roles.map(({ id }) => id).filter((id) => !NON_AGENT_ROLES.includes(id));
  if (!agentRoles.includes(role)) return allow;
  const args = input.tool_input ?? {};
  const webCall = WEB_ROLES.includes(role) ? webRoleCall(input.tool_name, args, { projectDir, ignored, searched, writes: roster?.roles?.[role]?.writes ?? [] }) : undefined;
  if (webCall) return webCall;
  switch (input.tool_name) {
    case 'Bash':
      // The working folder of the Bash tool stays from one call to the next, so a git grep with a mark from a folder
      // outside the project searches a repository made there (review round 3 of shop PR #21).
      if (KEY_MARK.test(args.command ?? '') && outsideProject(input.cwd, projectDir, tempDir)) return deny(KEY_SEARCH);
      return checkCommand(args.command ?? '', role, gates, roster);
    case 'Read':
      return forbiddenFile(args.file_path ?? '') ?? allow;
    // Grep with output_mode content prints a file, and Glob lists them: the rules of Read, on each path they take
    // (review round 2 of shop PR #13). They also read every file under their path, whatever its name, so like Edit and
    // Write they stay in the project and the temp folder, and Grep looks for no private key (review round 3).
    case 'Grep':
    case 'Glob': {
      const named = [args.path, args.glob, args.pattern].filter((value) => typeof value === 'string').map(forbiddenFile).find(Boolean);
      if (named) return named;
      // The pattern of Glob is a path too: an absolute one, or one that climbs out with .. (review round 4).
      const roots = [args.path, ...(input.tool_name === 'Glob' ? [args.pattern] : [])];
      const outside = roots.find((value) => outsideProject(value, projectDir, tempDir));
      return outside === undefined ? allow : deny(`${outside} is outside the project: Grep and Glob read only in the project and the temp folder`);
    }
    case 'Edit':
    case 'Write':
    case 'NotebookEdit': {
      const decision = checkEdit(args.file_path ?? args.notebook_path ?? '', role, gates, projectDir, roster, tempDir);
      if (!decision.allow || !approved || input.tool_name === 'NotebookEdit') return decision;
      // A dependency written into a pom.xml or a package.json must be approved first, as an install must. An Edit is
      // checked on the whole file it leaves, the file with old_string replaced: its two strings alone are no JSON, and
      // passed every dependency (review of shop PR #79). When the file does not hold old_string, the Edit fails anyway,
      // and its strings are compared as they are.
      const file = args.file_path ?? '';
      const current = readFile(file);
      let before = current;
      let after = args.content ?? '';
      if (input.tool_name === 'Edit') {
        const [old, next] = [args.old_string ?? '', args.new_string ?? ''];
        const found = old !== '' && current.includes(old);
        before = found ? current : old;
        after = found ? (args.replace_all ? current.split(old).join(next) : current.replace(old, () => next)) : next;
      }
      // A spec catalog: takes its version from pnpm-workspace.yaml at the root of the project (second review of shop PR #79).
      const catalogs = workspaceCatalogs(readFile('pnpm-workspace.yaml')) ?? {};
      // The file as Windows opens it: package.json::$DATA or package.json. is package.json (second review of shop PR #81).
      const opened = file.replaceAll('\\', '/').replace(/:[^/]*$/, '').replace(/[. ]+$/, '');
      const [problem] = dependencyProblems({ path: opened, before, after }, approved(), [], { catalogs });
      return problem ? deny(problem) : allow;
    }
    default:
      return allow;
  }
}

function checkCommand(command, role, gates, roster, depth = 0) {
  if (TOKEN_COMMAND.test(command) || GH_HOSTS_FILE.test(command)) return deny(TOKEN);
  if (KEY_FILE.test(command)) return deny(KEY);
  if (searchesForKey(command)) return deny(KEY_SEARCH);
  if (BACKUP_FILE.test(command)) return deny(BACKUP);
  if (POWERSHELL_ENV.test(command)) return deny(IDENTITY);
  if (USER_VARIABLES.test(command)) return deny(USER_VARIABLES_REASON);
  // ${NAME:=value} and ${NAME=value} set NAME as they expand (second review of shop PR #81).
  const expanded = [...command.matchAll(EXPANSION_SET)].map(([, name]) => name);
  // (( NAME = 1 )) and $(( NAME = 1 )) set NAME too (third review of shop PR #81), and so does $[ NAME = 1 ].
  for (const [, inside] of [...command.matchAll(ARITHMETIC), ...command.matchAll(OLD_ARITHMETIC)]) expanded.push(...assignedIn(inside));
  // Bash runs arithmetic in more places: the subscript of an array, an operand of -eq and its kin in [[ ]], the value
  // of a variable declared -i, and the value of a variable that arithmetic reads (review of shop PR #90, security, Low).
  // So a variable of the session named before an assignment sign anywhere in the command counts as set, inside quotes
  // too: those names are the session's own, and no command of a role writes them there.
  expanded.push(...assignedIn(command).filter((name) => SESSION_VARIABLE.test(name)));
  // A name split by quotes or a backslash is one word to bash: 'GIT_CONFIG_COU''NT=0' (review of shop PR #92).
  expanded.push(...assignedIn(command.replace(/['"\\]/g, '')).filter((name) => SESSION_VARIABLE.test(name)));
  if (expanded.some((name) => SESSION_VARIABLE.test(name))) return deny(IDENTITY);
  if (arithmeticTexts(command).some((text) => BUILT_ASSIGNED.test(text))) return deny(BUILT_NAME);
  // An assignment built into a value, as in w="$v=0", runs when arithmetic reads that value: (( w )), $[ w ], a[w] or
  // [[ w -eq 0 ]] (review of shop PR #92). So with any arithmetic in the command, it is refused wherever it is: also when
  // a quote or a backslash stands before the sign, as in v="$n"'=0', and printf -v, which writes a variable from a
  // format (review of shop PR #93). A value read from a file or from $( ) stays out of reach, as a script file does.
  if (arithmeticTexts(command).length > 0 && (BUILT_ASSIGNED.test(command) || BUILT_ASSIGNED.test(command.replace(/['"\\]/g, '')) || PRINTF_TO_VARIABLE.test(command))) return deny(BUILT_NAME);
  if (gates.approvedLibraries && expanded.some((name) => SOURCE_NAME.test(name))) return deny(installRefusal([{ refused: expanded.find((name) => SOURCE_NAME.test(name)), registry: true }], []));
  for (const words of segments(command)) {
    const result = checkWords(words, role, gates, roster, depth);
    if (!result.allow) return result;
  }
  return allow;
}

// sh -c and its kin run their script, and eval its words. The wrappers run the command after their options; the
// options listed here take a value. timeout also takes a duration first.
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash']);
const WRAPPERS = {
  env: ['-u', '--unset', '-C', '--chdir'],
  command: [],
  exec: ['-a'],
  nohup: [],
  time: [],
  nice: ['-n', '--adjustment'],
  timeout: ['-s', '--signal', '-k', '--kill-after'],
};
// NAME=value or NAME+=value, which bash takes before a command too (review of shop PR #81).
const ASSIGNMENT = /^[A-Za-z_]\w*\+?=/;
// The basic auth password ao-step gives qa in its environment (release-workflow spec 2.5), named in a word of a command
// the way bash, PowerShell or cmd expand it. Any process on the machine can read a command line, so the password goes
// to curl on stdin: printf, a builtin of the shell, prints it into the pipe (Pilot 2, T6: qa ran curl -u).
const PASSWORD_REFERENCE = /\$(?:\{|env:)?(?:E2E_HTTP_PASSWORD|AO_ENV_AUTH)\b|%(?:E2E_HTTP_PASSWORD|AO_ENV_AUTH)%/i;
const PASSWORD_SET_CHECK = /\$\{(?:E2E_HTTP_PASSWORD|AO_ENV_AUTH):?\+[^}$`]*\}/gi;
const PASSWORD_BUILTINS = ['printf', '[', '[[', 'test'];
// A copy or a delete of a tree that holds node_modules, or of the whole apps folder (request SHOP-54 of shop: ux copied
// apps into a temp folder to try a check). A copy fills the disk; a delete through a link of pnpm once emptied the
// node_modules of the project. Like the key search, this catches mistakes: a loop over a variable is not followed.
const RECURSIVE = { cp: /^-[A-Za-z]*[rRa]|^--(?:recursive|archive)$/, rm: /^-[A-Za-z]*[rR]|^--recursive$/ };
// node_modules at any depth, the whole apps folder, one app of it, or the project folder itself (. or ./), since each app
// of a pnpm workspace holds node_modules (review of shop PR #78).
const HEAVY_TREE = /(?:^|[\\/])node_modules(?:[\\/]|$)|(?:^|[\\/])apps(?:[\\/][^\\/*]+)?[\\/]?\*?$|^\.[\\/]?$/;
const TREE = 'do not copy or delete a folder tree that holds node_modules, or the whole apps folder: a copy fills the disk, and a delete can empty the node_modules of the project through a link of pnpm. To try a check on a copy, take only the files it needs, as in git archive HEAD <paths> | tar -x -C <temp folder>; to reinstall the packages, ask the human';
const touchesHeavyTree = (program, words) => Boolean(RECURSIVE[program])
  && words.slice(1).some((word) => RECURSIVE[program].test(word))
  && words.slice(1).some((word) => !word.startsWith('-') && HEAVY_TREE.test(word));
const PASSWORD = 'do not put the basic auth password on a command line, where any process can read it: give it to curl on stdin, as in printf \'user = "%s:%s"\\n\' "$E2E_HTTP_USER" "$E2E_HTTP_PASSWORD" | curl -K - <url>';
// Windows reads program names in any letter case.
const programOf = (word) => word?.split(/[\\/]/).at(-1).replace(/\.exe$/i, '').toLowerCase();
const nested = (script, role, gates, roster, depth) => (depth < 5 ? checkCommand(script, role, gates, roster, depth + 1) : deny('too many nested shells'));
// The shell builtins that set, export or clear a variable by name.
const DECLARERS = new Set(['export', 'declare', 'typeset', 'readonly', 'local', 'unset', 'set']);
// The name a word of a declarer or an assignment sets: what comes before =, or +=.
const nameOf = (word) => word.split('=')[0].replace(/\+$/, '');
const sessionVariable = (word) => SESSION_VARIABLE.test(nameOf(word));
// The builtins that set a variable they name without NAME=: printf -v NAME, read NAME, mapfile NAME (second review of
// shop PR #81). Under set -a, the shell exports it too.
const NAME_SETTERS = new Set(['printf', 'read', 'readarray', 'mapfile', 'getopts']);
const namesSet = (program, args) => (program === 'printf'
  ? args.flatMap((word, i) => (word === '-v' ? [args[i + 1] ?? ''] : /^-v./.test(word) ? [word.slice(2)] : []))
  : args.filter((word) => !word.startsWith('-')));
// ${NAME:=value} and ${NAME=value}, which set NAME.
const EXPANSION_SET = /\$\{([A-Za-z_]\w*):?=/g;
// The variables that set the options or the start-up file of bash, before any program: SHELLOPTS=allexport exports every
// variable set after it.
const SHELL_SETUP = /^(?:SHELLOPTS|BASHOPTS|BASH_ENV)$/i;
const SHELL_OPTIONS = 'do not set the options or the start-up file of a shell, set -a or allexport among them: a variable set after it is exported with no word for gh-guard to read. Pass a variable to one command as NAME=value in front of it';
// Whether the options of set, or of a shell before its script, turn on allexport: -a, a group of flags with a, or
// -o allexport. A group of flags with o takes the name after it, wherever o is in the group (set -ox allexport), and
// set takes -o more than once (set -o pipefail -o allexport; third review of shop PR #81).
function exportsAll(args) {
  for (let i = 0; i < args.length; i++) {
    const word = args[i];
    if (word === '--' || !/^[-+]/.test(word)) return false;
    // A long option of bash, such as --norc.
    if (word.startsWith('--')) continue;
    const flags = word.slice(1);
    if (word.startsWith('-') && flags.includes('a')) return true;
    if (flags.includes('o')) {
      if (word.startsWith('-') && /^allexport$/i.test(args[i + 1] ?? '')) return true;
      i++;
    }
  }
  return false;
}
// shopt -s -o allexport, shopt -so allexport: shopt -o sets the options of set (third review of shop PR #81).
const shoptExportsAll = (args) => args.some((word) => /^allexport$/i.test(word)) && args.some((word) => /^-[A-Za-z]*s/.test(word));
// The names for, select and let set, with no NAME= word (third review of shop PR #81): the name after for or select,
// and each name let assigns or steps. An arithmetic (( )) or $(( )) sets one too: checkCommand reads those on the whole
// command, since ( and ) end a command for segments.
const ARITHMETIC = /\(\(([\s\S]*?)\)\)/g;
const ASSIGNED = /([A-Za-z_]\w*)\s*(?:[-+*/%&|^]|<<|>>)?=(?!=)|([A-Za-z_]\w*)\s*(?:\+\+|--)|(?:\+\+|--)\s*([A-Za-z_]\w*)/g;
const assignedIn = (text) => [...text.matchAll(ASSIGNED)].map((found) => found[1] ?? found[2] ?? found[3]);
// The other places where Bash runs arithmetic (review of shop PR #90, security, Low): $[ ], the old form of $(( ));
// the subscript of an array, a[…] and ${a[…]}; and an operand next to -eq, -ne, -lt, -le, -gt or -ge in [[ ]].
const OLD_ARITHMETIC = /\$\[([\s\S]*?)\]/g;
const SUBSCRIPT = /[A-Za-z_]\w*\[([^\]]*)\]/g;
const TEST_ARITHMETIC = /(\S+)\s+-(?:eq|ne|lt|le|gt|ge)\s+(\S+)/g;
function arithmeticTexts(command) {
  const texts = [ARITHMETIC, OLD_ARITHMETIC, SUBSCRIPT].flatMap((pattern) => [...command.matchAll(pattern)].map(([, inside]) => inside));
  for (const [, test] of command.matchAll(/\[\[([\s\S]*?)\]\]/g)) for (const [, left, right] of test.matchAll(TEST_ARITHMETIC)) texts.push(left, right);
  return texts;
}
// An assignment in arithmetic to a name read from a variable, as in $[ $n = 0 ]: the variable may hold the name of
// one of the session.
const BUILT_ASSIGNED = /\$\{?[A-Za-z_]\w*\}?\s*(?:[-+*/%&|^]|<<|>>)?=(?!=)/;
const PRINTF_TO_VARIABLE = /(?:^|[\s;&|(`])printf\s+(?:-\S+\s+)*-v\b/;
const BUILT_NAME = 'write out the name of the variable you set: gh-guard reads the name, and an arithmetic that sets a name built from a variable could set one of the session';
// declare -i gives a variable the integer attribute: each value it gets then runs as arithmetic, which can set another
// variable that gh-guard cannot see (review of shop PR #90, security, Low).
const INTEGER_ATTRIBUTE = 'do not give a variable the integer attribute (declare -i): bash runs each value it gets as arithmetic, and gh-guard cannot tell which variable that sets';
function namesByKeyword(program, words) {
  const names = [];
  if (['for', 'select'].includes(program) && words[1]) names.push(words[1]);
  if (program === 'let') names.push(...words.slice(1).flatMap(assignedIn));
  return names;
}
// A variable that points a package manager, Maven or its JVM elsewhere, before any program, since a script of the
// project may run them; or set for the commands after it (review of shop PR #80); or named to printf -v, read and the
// like (second review of shop PR #81).
function sourceWord(words, env, program) {
  const before = env.find((word) => SOURCE_VARIABLE.test(word));
  if (before) return before;
  if (DECLARERS.has(program)) return words.slice(1).find((word) => SOURCE_VARIABLE.test(word) || SOURCE_NAME.test(word));
  if (NAME_SETTERS.has(program)) return namesSet(program, words.slice(1)).find((word) => SOURCE_NAME.test(word));
  return namesByKeyword(program, words).find((name) => SOURCE_NAME.test(name));
}

// env: the VAR=value words before the command, which git reads too (GIT_CONFIG_*). A line of assignments alone changes
// a variable the session already exports, so it counts too.
function checkWords(words, role, gates, roster, depth, env = words.env ?? []) {
  if (env.some(sessionVariable)) return deny(IDENTITY);
  if (env.some((word) => SHELL_SETUP.test(nameOf(word)))) return deny(SHELL_OPTIONS);
  const first = words.length > 0 ? programOf(words[0]) : '';
  const source = gates.approvedLibraries ? sourceWord(words, env, first) : undefined;
  if (source) return deny(installRefusal([{ refused: source, registry: true }], []));
  if (words.length === 0) return allow;
  const program = first;
  if (NAME_SETTERS.has(program) && namesSet(program, words.slice(1)).some((word) => SESSION_VARIABLE.test(word))) return deny(IDENTITY);
  if (namesByKeyword(program, words).some((name) => SESSION_VARIABLE.test(name))) return deny(IDENTITY);
  if (program === 'set' && exportsAll(words.slice(1))) return deny(SHELL_OPTIONS);
  if (program === 'shopt' && shoptExportsAll(words.slice(1))) return deny(SHELL_OPTIONS);
  // set takes words, not names, after its options.
  if (DECLARERS.has(program) && program !== 'set') {
    const names = words.slice(1).filter((word) => !word.startsWith('-')).map(nameOf);
    if (names.some((name) => SHELL_SETUP.test(name))) return deny(SHELL_OPTIONS);
    // A name built from a variable, or a reference to another (declare -n), sets a variable gh-guard cannot name.
    if (names.some((name) => /[$`]/.test(name))) return deny('write out the name of the variable you set or export: gh-guard reads the name, and a name built from a variable could be one of the session or of a package manager');
    if (['declare', 'typeset', 'local'].includes(program) && words.slice(1).some((word) => /^-[A-Za-z]*n/.test(word))) return deny('do not make a reference to a variable (declare -n): gh-guard cannot tell which variable it sets');
    if (['declare', 'typeset', 'local'].includes(program) && words.slice(1).some((word) => /^-[A-Za-z]*i/.test(word))) return deny(INTEGER_ATTRIBUTE);
  }
  // A library installed by name, or downloaded and run by npx, must be on the approved list of project.yaml first, from
  // the project's registry and inside its range (C1 spec section 5, review of shop PR #79).
  if (gates.approvedLibraries) {
    const refusal = installRefusal(installTargets(program.replace(/\.(cmd|bat|ps1)$/, ''), words.slice(1), { env }), gates.approvedLibraries(), { tools: gates.dependencies?.tools ?? [] });
    if (refusal) return deny(refusal);
  }
  if (DECLARERS.has(program) && words.slice(1).some((word) => !word.startsWith('-') && sessionVariable(word))) return deny(IDENTITY);
  if (SHELLS.has(program)) {
    if (exportsAll(words.slice(1))) return deny(SHELL_OPTIONS);
    const at = words.findIndex((word, i) => i > 0 && /^-[a-z]*c[a-z]*$/.test(word));
    const script = words[at + 1] === '--' ? words[at + 2] : words[at + 1];
    if (at > 0 && script !== undefined) return nested(script, role, gates, roster, depth);
    if (readsStdin(words)) return deny(STDIN);
  }
  if (POWERSHELLS.has(program)) return checkPowerShell(words, role, gates, roster, depth);
  if (program === 'cmd') {
    const at = words.findIndex((word, i) => i > 0 && /^\/{1,2}[ck]$/i.test(word));
    if (at > 0) return nested(words.slice(at + 1).join(' '), role, gates, roster, depth);
    return words.slice(1).every((word) => word.startsWith('/')) ? deny(STDIN) : allow;
  }
  if (program.startsWith('git-credential-') || words.some((word, i) => i > 0 && programOf(word).startsWith('git-credential-'))) return deny(TOKEN);
  if (program === 'eval') return nested(words.slice(1).join(' '), role, gates, roster, depth);
  if (Object.hasOwn(WRAPPERS, program)) {
    const values = WRAPPERS[program];
    const assignments = [];
    let i = 1;
    for (; i < words.length; i++) {
      const word = words[i];
      if (word === '--') {
        i++;
        break;
      }
      // env -S splits its value into a command.
      if (program === 'env' && (word === '-S' || word === '--split-string')) return nested(words[i + 1] ?? '', role, gates, roster, depth);
      if (program === 'env' && /^-S./.test(word)) return nested(word.slice(2), role, gates, roster, depth);
      // env -i and env - start the command with no variables, the session's included; -u takes one away.
      if (program === 'env' && (word === '-' || word === '--ignore-environment' || /^-[A-Za-z]*i/.test(word))) return deny(IDENTITY);
      if (program === 'env' && ['-u', '--unset'].includes(word) && sessionVariable(words[i + 1] ?? '')) return deny(IDENTITY);
      if (program === 'env' && /^(?:-u|--unset=)./.test(word) && sessionVariable(word.replace(/^-u|^--unset=/, ''))) return deny(IDENTITY);
      if (values.includes(word)) i++;
      else if (program === 'env' && ASSIGNMENT.test(word)) assignments.push(word);
      // env sets a name built from a variable, as in env "$n=x": bash would not take it for an assignment.
      else if (program === 'env' && /^[^=]*[$`][^=]*=/.test(word)) return deny('write out the name of the variable you set or export: gh-guard reads the name, and a name built from a variable could be one of the session or of a package manager');
      else if (!word.startsWith('-')) break;
    }
    if (program === 'timeout') i++;
    return i < words.length ? checkWords(words.slice(i), role, gates, roster, depth, [...env, ...assignments]) : allow;
  }
  // Only the builtins themselves: /usr/bin/printf is a process of its own. printf prints it into a pipe; [, [[ and test
  // only check it. ${…:+word} gives word or nothing, never the value, so it is no reference (QA SHOP-13 of shop).
  // A word that runs a command, $( or a backtick, puts what it names on that command's line, under a builtin too
  // (review of shop PR #78: [ "$(curl -u …$E2E_HTTP_PASSWORD …)" = 200 ] passed).
  const names = (word) => PASSWORD_REFERENCE.test(word.replace(PASSWORD_SET_CHECK, ''));
  const runsInside = (word) => /\$\(|`/.test(word);
  if (words.slice(1).some((word) => names(word) && (!PASSWORD_BUILTINS.includes(words[0]) || runsInside(word)))) return deny(PASSWORD);
  if (touchesHeavyTree(program, words)) return deny(TREE);
  if (program === 'git' && env.some((assignment) => /^GIT_CONFIG/.test(assignment))) return deny(HOOKS);
  const result = program === 'git' ? checkGit(words, gates) : program === 'gh' ? checkGh(words) : (checkOrchestration(words) ?? checkAoPr(words, role, gates));
  if (!result.allow) return result;
  const refusal = program === 'git' && roster ? gitRefusal(roster, role, words) : null;
  if (refusal) return deny(refusal);
  // A git or gh further on, as after xargs or a wrapper not listed above: its refusals apply too.
  const at = program === 'git' || program === 'gh' ? -1 : words.findIndex((word, i) => i > 0 && ['git', 'gh'].includes(programOf(word)));
  if (at < 0) return allow;
  if (programOf(words[at]) === 'git' && env.some((assignment) => /^GIT_CONFIG/.test(assignment))) return deny(HOOKS);
  return programOf(words[at]) === 'git' ? checkGit(words.slice(at), gates) : checkGh(words.slice(at));
}

// sh and its kin without -c run a script file, which gh-guard does not read, like any file; with -s, or with no file,
// they read their commands from stdin, as in `echo '…' | bash`.
function readsStdin(words) {
  const rest = words.slice(1);
  if (rest.some((word) => ['--version', '--help'].includes(word))) return false;
  return rest.some((word) => /^-[a-z]*s[a-z]*$/.test(word)) || rest.every((word) => word.startsWith('-'));
}

// powershell and pwsh: -Command, or the words after the options, is a script checked like any command line; -File runs
// a script file; -EncodedCommand cannot be read; with no command, or -Command -, they read stdin. Options are matched by
// any start of their name, as PowerShell takes them.
const POWERSHELLS = new Set(['powershell', 'pwsh']);
const PS_COMMAND = /^[-/]c(?:o(?:m(?:m(?:a(?:n(?:d)?)?)?)?)?)?$/i;
const PS_ENCODED = /^[-/](?:e|ec|en[a-z]*)$/i;
const PS_FILE = /^[-/]f(?:i(?:l(?:e)?)?)?$/i;
const PS_VALUES = /^[-/](?:ex|ep|executionpolicy|w|windowstyle|config\w*|o|of|outputformat|in|if|inputformat|v|version|psconsolefile|wd|workingdirectory|settingsfile|custompipename)$/i;

function checkPowerShell(words, role, gates, roster, depth) {
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    if (PS_ENCODED.test(word)) return deny(ENCODED);
    if (PS_FILE.test(word)) return allow;
    if (PS_COMMAND.test(word)) {
      const script = words.slice(i + 1).join(' ');
      return script === '' || script === '-' ? deny(STDIN) : nested(script, role, gates, roster, depth);
    }
    if (PS_VALUES.test(word)) i++;
    else if (!/^[-/]/.test(word)) return nested(words.slice(i).join(' '), role, gates, roster, depth);
  }
  return deny(STDIN);
}

// The keywords of bash that may stand before a command, as the first word of a simple command.
const SHELL_KEYWORDS = new Set(['{', '}', '!', 'do', 'done', 'then', 'else', 'elif', 'fi', 'if', 'while', 'until']);

// The simple commands of a command line, as lists of words, with quotes removed. The leading VAR=value words are
// dropped from the list and kept in its `env`; a line of assignments alone is an empty list with its `env`.
function segments(command) {
  const all = [];
  let words = [];
  let word = '';
  let started = false;
  let quote = null;
  // The next word is the file of a redirection, not a word of the command.
  let target = false;
  const endWord = () => {
    if (started && target) target = false;
    else if (started) words.push(word);
    word = '';
    started = false;
  };
  const endCommand = () => {
    endWord();
    target = false;
    // A keyword of the shell is not the command: after do, then or {, the command is the next word (QA SHOP-73 of shop:
    // printf in a loop or a function was taken for a command named do or {, and the stdin form was refused).
    while (words.length > 0 && SHELL_KEYWORDS.has(words[0])) words.shift();
    const start = words.findIndex((w) => !ASSIGNMENT.test(w));
    if (start >= 0) all.push(Object.assign(words.slice(start), { env: words.slice(0, start) }));
    else if (words.length > 0) all.push(Object.assign([], { env: words }));
    words = [];
  };
  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (quote) {
      if (char === quote) quote = null;
      else if (char === '\\' && quote === '"' && i + 1 < command.length) word += command[++i];
      else word += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (char === '\\' && i + 1 < command.length) {
      word += command[++i];
      started = true;
    } else if (char === '<' || char === '>') {
      // A redirection: the digits of its file descriptor, its operator (>, >>, <, <<, <<< …) and its file are not words
      // of the command (ba ran ao-pr.mjs 2>&1 in dev-workflow T17). >&1 and >&- copy a descriptor and take no file.
      if (started && /^\d+$/.test(word)) {
        word = '';
        started = false;
      } else endWord();
      let j = i + 1;
      while (command[j] === '<' || command[j] === '>') j++;
      if (command[j] === '&') {
        j++;
        while (j < command.length && /[\d-]/.test(command[j])) j++;
      } else target = true;
      i = j - 1;
    } else if (char === '\n' || ';|&()'.includes(char)) endCommand();
    else if (/\s/.test(char)) endWord();
    else {
      word += char;
      started = true;
    }
  }
  endCommand();
  return all;
}

const isProtected = (branch, gates) => gates.protected_branches.some((pattern) => matchesGlob(pattern, branch));

// -c include.path and includeIf read a whole config file, which may move the hooks; an alias may run any command.
function checkGit(words, gates) {
  const { index, settings } = gitSubcommand(words);
  if (settings.some((name) => name === 'core.hookspath' || name.startsWith('include.') || name.startsWith('includeif.'))) return deny(HOOKS);
  if (settings.some((name) => name.startsWith('alias.'))) return deny('do not define a git alias on the command line; run the git command itself');
  if (settings.some((name) => name.startsWith('credential.'))) return deny(CREDENTIAL);
  const [sub, ...rest] = words.slice(index);
  if (sub === 'credential' || sub?.startsWith('credential-')) return deny(TOKEN);
  if (sub === 'config' && !configReads(rest) && rest.some((w) => /^core\.hookspath(=|$)/i.test(w))) return deny(HOOKS);
  if (sub === 'config' && !configReads(rest) && rest.some((w) => /^credential\./i.test(w))) return deny(CREDENTIAL);
  if (sub === 'commit' && commitSkipsHooks(rest)) return deny(HOOKS);
  if (sub === 'push') return checkPush(rest, gates);
  return allow;
}

// git commit options whose value is the next word, so a message such as -m "-n" is not read as an option.
const COMMIT_SHORT_VALUES = new Set(['m', 'F', 'C', 'c', 't']);
const COMMIT_LONG_VALUES = new Set(['--message', '--file', '--reuse-message', '--reedit-message', '--template', '--author', '--date', '--fixup', '--squash', '--cleanup', '--trailer']);

// git takes an unambiguous start of a long option: --no-veri is --no-verify.
const NO_VERIFY = /^--no-veri(?:f|fy)?$/;

function commitSkipsHooks(args) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (NO_VERIFY.test(arg)) return true;
    if (arg === '--') break;
    if (arg.startsWith('--')) {
      if (COMMIT_LONG_VALUES.has(arg)) i++;
    } else if (/^-[A-Za-z]+$/.test(arg)) {
      for (let j = 1; j < arg.length; j++) {
        if (arg[j] === 'n') return true;
        if (COMMIT_SHORT_VALUES.has(arg[j])) {
          if (j === arg.length - 1) i++;
          break;
        }
      }
    }
  }
  return false;
}

const PUSH_VALUES = new Set(['--repo', '-o', '--push-option', '--receive-pack', '--exec']);

// git push [options] [<remote> [<refspec>...]]. A plain `git push` names no branch; the pre-push hook sees its refs.
function checkPush(args, gates) {
  if (args.some((arg) => NO_VERIFY.test(arg))) return deny(HOOKS);
  if (args.some((a) => ['--all', '--mirror', '--branches'].includes(a))) return deny('pushing every branch reaches the protected ones: change them through a pull request');
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (PUSH_VALUES.has(args[i])) i++;
    else if (!args[i].startsWith('-')) positional.push(args[i]);
  }
  for (const refspec of positional.slice(1)) {
    const target = refspec.split(':').at(-1).replace(/^\+/, '').replace(/^refs\/heads\//, '');
    if (isProtected(target, gates)) return deny(`${target} is protected: change it through a pull request, not a push`);
  }
  return allow;
}

// revert and update-branch came after gh 2.16, like repo autolink and run delete below.
const PR_WRITES = ['create', 'edit', 'merge', 'review', 'close', 'ready', 'reopen', 'comment', 'revert', 'update-branch'];
const REPO_WRITES = ['edit', 'delete', 'rename', 'archive', 'unarchive'];

// gh auth token and status -t print your token; login, switch and the others change it. TOKEN_COMMAND sees the same in
// the raw text; here the words are read after the shell's quotes and backslashes.
const AUTH_TOKEN = ['token', 'login', 'logout', 'switch', 'refresh', 'setup-git', 'git-credential'];

function checkGh(words) {
  const [group, sub, action] = positional(words.slice(1));
  if (group === 'auth' && (AUTH_TOKEN.includes(sub) || (sub === 'status' && words.some((w) => w === '--show-token' || /^-[^-h\s]*t/.test(w))))) {
    return deny(TOKEN);
  }
  if (group === 'alias' && ['set', 'import'].includes(sub)) return deny('do not add a gh alias; run the gh command itself');
  if (group === 'pr' && PR_WRITES.includes(sub)) {
    return deny(`do not run gh pr ${sub} with your account; use node .ai-orchestrator/scripts/ao-pr.mjs (create, edit, comment, review), and leave merging to merge-gate`);
  }
  if (group === 'api' && apiWrites(words.slice(2))) return deny('gh api may only read (GET); write through ao-pr.mjs');
  if ((group === 'secret' || group === 'variable') && ['set', 'delete', 'remove'].includes(sub)) return deny(`do not change the repository ${group}s`);
  if (group === 'repo' && (REPO_WRITES.includes(sub) || (sub === 'autolink' && ['create', 'delete'].includes(action)))) {
    return deny('do not change the repository settings');
  }
  if (group === 'run' && sub === 'delete') return deny('do not delete workflow runs; they record what the gates did');
  // A run by hand of CI skips the checks of a PR; a disabled workflow stops its gates (review of ao-sample PR #30).
  if (group === 'workflow' && ['run', 'enable', 'disable'].includes(sub)) {
    return deny(`do not run gh workflow ${sub}: CI runs on its own on a PR or a push, and the workflows stay as they are`);
  }
  return allow;
}

// The words of a gh command that are not options, so that gh pr -R o/r merge 12 reads as pr merge 12. -R and --repo
// take a value.
function positional(args) {
  const words = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-R' || args[i] === '--repo') i++;
    else if (!args[i].startsWith('-')) words.push(args[i]);
  }
  return words;
}

// gh api sends GET unless told otherwise; a field or an input file makes it POST.
function apiWrites(args) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-X' || arg === '--method') {
      if ((args[++i] ?? '').toUpperCase() !== 'GET') return true;
    } else if (/^(?:-X|--method=)./.test(arg)) {
      if (arg.replace(/^-X|^--method=/, '').toUpperCase() !== 'GET') return true;
    } else if (/^(?:-f|-F|--field|--raw-field|--input)(?:=|$)/.test(arg) || /^-[fF]./.test(arg)) return true;
  }
  return false;
}

// node running ao-step.mjs, ao-agent.mjs or ao-git-credential.mjs, wherever node is in the command (xargs node ...).
// Another program that names the file, such as cat or grep, only reads it. Returns a refusal, or undefined.
function checkOrchestration(words) {
  if (!words.some((word) => programOf(word) === 'node')) return undefined;
  const script = words.map((word) => word.match(ORCHESTRATION)?.[1]).find(Boolean);
  return script ? deny(`${script.toLowerCase()}.mjs is for the human's session: an agent does not start agents or buy a token itself`) : undefined;
}

// The options of node whose value is the next word, so that in node -r ./x.cjs ao-pr.mjs the script is ao-pr.mjs.
const NODE_VALUES = new Set(['-r', '--require', '--import', '--loader', '--experimental-loader', '-C', '--conditions', '--env-file', '--input-type', '--title', '--inspect-port', '--redirect-warnings', '--diagnostic-dir', '--report-dir']);

// node ao-pr.mjs <command>: each role runs only the commands of its own App (quality/gates.yaml, github_apps). The
// script is the first word after node's options and their values; another program that names the file, such as grep,
// only reads it.
function checkAoPr(words, role, gates) {
  if (programOf(words[0]) !== 'node') return allow;
  let at = -1;
  for (let i = 1; i < words.length && at < 0; i++) {
    if (NODE_VALUES.has(words[i])) i++;
    else if (!words[i].startsWith('-')) at = i;
  }
  if (at < 0 || !/(?:^|[\\/])ao-pr\.mjs$/i.test(words[at])) return allow;
  // The first word after the script that is not an option; with none, ao-pr.mjs only prints its usage.
  const command = words.slice(at + 1).find((word) => !word.startsWith('-'));
  if (command === undefined) return allow;
  const app = Object.entries(gates.github_apps).find(([, { roles }]) => roles.includes(role));
  if (!app) return deny(`${role} has no GitHub App, so it does not work on PRs`);
  const [kind, { commands }] = app;
  return commands.includes(command) ? allow : deny(`${role} uses the ${kind} App, which runs ao-pr.mjs ${commands.join(', ')}, not ${command}`);
}

// Outside the project an agent writes only in the temp folder: a user setting such as ~/.gitconfig could move the hooks.
// Windows paths ignore letter case, so the globs do too. tempDir may list several names of the temp folder, such as the
// short (8.3) name os.tmpdir() gives for a user name with a space and the long one.
function checkEdit(file, role, gates, projectDir, roster, tempDir) {
  const inside = relativeToProject(file, projectDir);
  if (inside === null) {
    const inTemp = [tempDir].flat().some((dir) => dir && relativeToProject(file, dir) !== null);
    return inTemp ? allow : deny(`${file} is outside the project: agents write only in the project and the temp folder`);
  }
  // The path as Windows opens it, so a stream (seo-ok.json::$DATA) or a dot at the end (.npmrc.) is the file itself; and
  // no short name, which reaches a file by another name (second review of shop PR #81).
  if (inside.split('/').some((part) => SHORT_NAME.test(part))) return deny(`${file}: write a file by its long name, not a short name such as NPMRC~1`);
  const path = windowsPath(inside);
  if (/^\.git(?:\/|$)/i.test(path)) return deny(GIT_DIR);
  // The seo-ok of an item, its run state and the locks are ao-step's: an agent that wrote them could approve a comment
  // of seo, or free an item another run holds (review of shop PR #81). The screenshots of a preview stay the agents'.
  // So is the file of the comment of seo you approved, which a run reads in place of Jira (third review of shop PR #81).
  // So are the files of the watcher: a pid written there would keep every watcher from starting (review of shop PR #93).
  if (/^\.ai\/runs\/(?:active\/|[^/]+\/(?:seo-ok|state)\.json$|[^/]+\/seo-[0-9a-f]+\.md$|watch(?:-process)?\.json$)/i.test(path)) return deny(`${path} is ao-step's: agents do not write it`);
  // The report of a review after merge is the role's that wrote it: ao-step posts it with the App (review of shop PR #93).
  const report = /^\.ai\/reviews\/[A-Z][A-Z0-9]*-\d+-(reviewer|security)-[0-9a-f]{7}\.md$/i.exec(path);
  if (report && report[1].toLowerCase() !== role) return deny(`${path} is the report of ${report[1].toLowerCase()}: only ${report[1].toLowerCase()} writes it`);
  const hit = gates.protected_paths.find(({ path: glob }) => matchesGlob(glob.toLowerCase(), path.toLowerCase()));
  if (hit && !(hit.editors ?? []).includes(role)) {
    return deny(`${hit.path} is protected: ${hit.editors ? `only ${hit.editors.join(', ')} may edit it` : 'agents do not edit it'}`);
  }
  const refusal = roster ? writeRefusal(roster, role, path) : null;
  return refusal ? deny(refusal) : allow;
}


// The calls of a role of WEB_ROLES (C1 spec 6.4). Such a role reads web pages, which can carry orders, and could send
// what it read out with WebFetch. So (review of shop PR #79):
// - Read, Grep and Glob stay in the project, not in the temp folder either, and away from the .env files but
//   .env.example, by any spelling Windows opens (.env., .env::$DATA, .env/., a short name such as ENV~1.DEV), and from
//   the files git ignores, where the secrets of a machine live: `ignored` asks git. The files of its own `writes` in
//   agents/roster.yaml, such as its ledger under .ai/, pass before that rule: Claude Code edits no file it has not read,
//   so a run that stopped could not go on (second review of shop PR #79).
// - Grep reads every file under its path whatever the pattern, and its glob reaches the files git ignores too: so it
//   takes a file, or a glob or a type of code and docs files only, where a secret has no place.
// - Edit and Write stay in the project: a file of its own in the temp folder could pass for the record of its searches.
// - WebFetch takes only a page a WebSearch of this run gave (`searched`, which web-search.mjs records), or one of the
//   docs below: a page cannot have it send what it read to an address of the page's choosing.
// undefined when the call is fine.
const ENV_NAMED = /(?:^|[\\/{,*])\.env(?!\.example(?:$|[},]))|\{(?:[^}]*,)?env[^,}]*[,}]/i;
const ENV_PART = /^\.env(?!\.example$)/;
const SHORT_NAME = /~\d/;
const ONE_EXTENSION = /^(?:[\w.-]+\/)*(?:\*\*\/)?\*\.([A-Za-z0-9]+|\{[A-Za-z0-9]+(?:,[A-Za-z0-9]+)*\})$/;
const CODE_EXTENSIONS = ['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs', 'md', 'mdx', 'css', 'scss', 'html', 'vue', 'svelte', 'astro', 'java', 'kt'];
const CODE_TYPES = ['ts', 'js', 'md', 'markdown', 'css', 'sass', 'html', 'vue', 'svelte', 'java', 'kotlin'];
const A_FILE = /(?:^|[\\/])[^.\\/][^\\/]*\.[A-Za-z0-9]+$/;
export const DOC_HOSTS = ['developers.google.com', 'schema.org', 'nextjs.org', 'web.dev', 'developer.mozilla.org', 'www.w3.org', 'search.google.com', 'support.google.com'];
const WEB_ENV = 'the .env files are not read by a role that reads web pages (C1 spec 6.4); .env.example is';
const WEB_OUTSIDE = (path) => `${path} is outside the project: a role that reads web pages reads and writes only in the project (C1 spec 6.4)`;
const WEB_GREP = `give Grep a file, a glob of code or docs files such as "**/*.{ts,tsx}" or "*.md", or a type such as "ts": its glob reaches the files git ignores too, so a role that reads web pages does not search others, such as *.json (C1 spec 6.4). Read a JSON file by its path`;

// A path inside the project as Windows opens it: forward slashes, no . or .. parts, no stream after a colon, and no
// dots or spaces at the end of a part, which Windows drops.
const windowsPath = (path) => posix.normalize(path.replaceAll('\\', '/')).split('/').map((part) => (part === '.' || part === '..' ? part : part.replace(/:.*$/, '').replace(/[. ]+$/, ''))).join('/');

// The key a URL is compared by: its host, path and query, whatever its scheme, fragment or a slash at the end.
const urlKey = (text) => {
  try {
    const url = new URL(text);
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, '')}${url.search}`;
  } catch {
    return null;
  }
};

function webRoleCall(tool, args, { projectDir, ignored = () => false, searched = () => [], writes = [] }) {
  const outside = (path) => typeof path === 'string' && path.trim() !== '' && outsideProject(path, projectDir, []);
  const hidden = (value) => {
    if (typeof value !== 'string' || value.trim() === '') return undefined;
    const inside = relativeToProject(value, projectDir);
    if (inside === null) return undefined;
    const path = windowsPath(inside);
    const parts = path.toLowerCase().split('/');
    if (parts.some((part) => ENV_PART.test(part))) return deny(WEB_ENV);
    if (parts.some((part) => SHORT_NAME.test(part))) return deny(`${value} has a short name, such as ENV~1.DEV, that can name a .env file: a role that reads web pages gives the long name (C1 spec 6.4)`);
    if (writes.some((glob) => matchesGlob(glob, path))) return undefined;
    if (!['', '.'].includes(path) && ignored(path)) return deny(`${value} is a file git ignores, as a .env file or a key is: a role that reads web pages reads only what the repo may hold (C1 spec 6.4)`);
    return undefined;
  };
  if (tool === 'Read') {
    const file = args.file_path ?? '';
    return outside(file) ? deny(WEB_OUTSIDE(file)) : hidden(file);
  }
  if (['Edit', 'Write', 'NotebookEdit'].includes(tool)) {
    const file = args.file_path ?? args.notebook_path ?? '';
    return outside(file) ? deny(WEB_OUTSIDE(file)) : undefined;
  }
  if (tool === 'WebFetch') {
    const key = urlKey(args.url ?? '');
    let host = null;
    try {
      const url = new URL(args.url);
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) host = url.hostname.toLowerCase();
    } catch {
      host = null;
    }
    if (host && DOC_HOSTS.includes(host)) return undefined;
    if (host && key && searched().map(urlKey).includes(key)) return undefined;
    return deny(`a role that reads web pages fetches only a page a WebSearch of this run gave, or the docs of ${DOC_HOSTS.join(', ')}: ${args.url} is neither, so a page cannot have it send what it read to an address of its choosing (C1 spec 6.4)`);
  }
  if (tool !== 'Grep' && tool !== 'Glob') return undefined;
  const roots = [args.path, ...(tool === 'Glob' ? [args.pattern] : [])];
  const away = roots.find(outside);
  if (away !== undefined) return deny(WEB_OUTSIDE(away));
  if ([args.path, args.glob, ...(tool === 'Glob' ? [args.pattern] : [])].some((value) => typeof value === 'string' && ENV_NAMED.test(value))) return deny(WEB_ENV);
  const named = hidden(args.path);
  if (named) return named;
  if (tool === 'Glob') return undefined;
  const path = typeof args.path === 'string' ? args.path : '';
  const glob = typeof args.glob === 'string' ? args.glob.replaceAll('\\', '/') : '';
  if (glob) {
    const extensions = ONE_EXTENSION.exec(glob)?.[1].replace(/[{}]/g, '').split(',') ?? [];
    return extensions.length > 0 && extensions.every((extension) => CODE_EXTENSIONS.includes(extension.toLowerCase())) ? undefined : deny(WEB_GREP);
  }
  if (A_FILE.test(path) || CODE_TYPES.includes(args.type)) return undefined;
  return deny(WEB_GREP);
}

// Whether the path of a Grep or Glob reaches outside the project and the temp folder: your home folder (~) does, and no
// path at all is the working folder, which is the project's or its worktree's.
function outsideProject(value, projectDir, tempDir) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  if (/^~(?:[\\/]|$)/.test(value)) return true;
  // The folder itself counts as inside it: relativeToProject takes only what lies under it.
  const plain = (path) => posix.normalize(path.replaceAll('\\', '/').replace(/^\/\/[?.]\//, '')).replace(/\/+$/, '').toLowerCase();
  const inside = (dir) => Boolean(dir) && (plain(value) === plain(dir) || relativeToProject(value, dir) !== null);
  return ![projectDir, ...[tempDir].flat()].some(inside);
}

// The path inside the project with forward slashes and no `.` or `..`, or null for a file outside it. The Windows
// prefixes \\?\ and \\.\ name the same file.
function relativeToProject(file, projectDir) {
  // A drive with no slash after it, as in C:notes.txt, is the working folder of that drive, wherever that is: outside.
  if (/^[A-Za-z]:(?![\\/])/.test(file)) return null;
  const path = posix.normalize(file.replaceAll('\\', '/').replace(/^\/\/[?.]\//, ''));
  if (!/^(?:[A-Za-z]:)?\//.test(path)) return path === '..' || path.startsWith('../') ? null : path;
  const root = `${projectDir.replaceAll('\\', '/').replace(/\/+$/, '')}/`;
  return path.toLowerCase().startsWith(root.toLowerCase()) ? path.slice(root.length) : null;
}
