// The encrypted copies of the dumps, which your machine pulls (Pilot 3, spec 2.4; plan, decision 3). After each run,
// ao-backup keeps one copy, <dump>.age, of each dump it keeps, in /var/backups/ao-offsite/<project>/<environment>/,
// encrypted to the age recipient of /etc/ao/deployer.yaml. The identity that decrypts it lives on your machine only, so
// whoever reads the VPS cannot read a copy. X25519 keys (age1…), which every age tool reads, such as the age 1.1 of
// Ubuntu 24.04; the post-quantum ones are not. Files go through streams, so a large dump never sits in memory.
import { chmodSync, chownSync, createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Decrypter, Encrypter, generateX25519Identity, identityToRecipient } from 'age-encryption';
import { backupTime } from './backup.mjs';

export const COPY_SUFFIX = '.age';
// bech32: no 1, b, i or o after the separator.
export const RECIPIENT = /^age1[02-9ac-hj-np-z]{58}$/;

// What to do in one folder of copies, by name: the dumps kept that have no copy yet, and the files that are no copy of
// a dump kept (a dump that went, a .part a stopped run left). Pure.
export function copyChanges({ dumps, copies }) {
  const kept = new Set(dumps);
  const have = new Set(copies);
  return {
    encrypt: dumps.filter((name) => !have.has(`${name}${COPY_SUFFIX}`)).sort(),
    remove: copies.filter((name) => !name.endsWith(COPY_SUFFIX) || !kept.has(name.slice(0, -COPY_SUFFIX.length))).sort(),
  };
}

// A new key pair: the identity (AGE-SECRET-KEY-1…) stays on your machine; the recipient (age1…) goes to the VPS.
export async function newKeyPair() {
  const identity = await generateX25519Identity();
  return { identity, recipient: await identityToRecipient(identity) };
}

export async function encryptFile(source, target, recipient) {
  if (!RECIPIENT.test(recipient ?? '')) throw new Error('the recipient must be an X25519 age recipient, age1 and 58 letters');
  const encrypter = new Encrypter();
  encrypter.addRecipient(recipient);
  const sealed = await encrypter.encrypt(Readable.toWeb(createReadStream(source)));
  await pipeline(Readable.fromWeb(sealed), createWriteStream(target, { flags: 'wx', mode: 0o600 }));
}

// Brings the copies in line with the dumps: for each <project>/<environment> of dumpsRoot, the copies folder of the
// same name gets the copies missing and loses the stale ones. The copies root stays root's and 0755, as sshd wants of a
// ChrootDirectory; below it, folders are root:<gid> 0750 and copies root:<gid> 0640, so aobackup reads and never
// writes. A copy is written to .part and renamed once whole. Returns the number of copies that failed.
export async function syncCopies({ dumpsRoot, copiesRoot, recipient, gid, chown = chownSync, log = () => {} }) {
  const folders = (dir) => (existsSync(dir) ? readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory()) : []);
  mkdirSync(copiesRoot, { recursive: true });
  chmodSync(copiesRoot, 0o755);
  let failed = 0;
  for (const project of folders(dumpsRoot)) {
    for (const env of folders(join(dumpsRoot, project))) {
      const from = join(dumpsRoot, project, env);
      const to = join(copiesRoot, project, env);
      for (const dir of [join(copiesRoot, project), to]) {
        mkdirSync(dir, { recursive: true });
        chown(dir, 0, gid);
        chmodSync(dir, 0o750);
      }
      const dumps = readdirSync(from).filter((name) => backupTime(name));
      const { encrypt, remove } = copyChanges({ dumps, copies: readdirSync(to) });
      for (const name of remove) {
        rmSync(join(to, name), { force: true, recursive: true });
        log(`${project}/${env}: removed the copy ${name}`);
      }
      for (const name of encrypt) {
        const part = join(to, `${name}${COPY_SUFFIX}.part`);
        try {
          await encryptFile(join(from, name), part, recipient);
          chown(part, 0, gid);
          chmodSync(part, 0o640);
          renameSync(part, join(to, `${name}${COPY_SUFFIX}`));
          log(`${project}/${env}: copy ${name}${COPY_SUFFIX}, ${statSync(join(to, `${name}${COPY_SUFFIX}`)).size} bytes`);
        } catch (error) {
          rmSync(part, { force: true });
          log(`${project}/${env}: the copy of ${name} failed: ${error.message}`);
          failed++;
        }
      }
    }
  }
  return failed;
}

// target: a path, written once, or a writable stream, such as stdout, so the dump can go straight to pg_restore and never
// lie in a file an agent could read (review round 2 of shop PR #13).
export async function decryptFile(source, target, identity) {
  const decrypter = new Decrypter();
  decrypter.addIdentity(identity);
  const opened = await decrypter.decrypt(Readable.toWeb(createReadStream(source)));
  await pipeline(Readable.fromWeb(opened), typeof target === 'string' ? createWriteStream(target, { flags: 'wx', mode: 0o600 }) : target);
}
