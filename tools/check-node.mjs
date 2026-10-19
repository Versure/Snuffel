// Fails early with a clear message when the active Node.js is too old for Angular.
const [major, minor] = process.versions.node.split('.').map(Number);
const ok = (major === 22 && minor >= 22) || (major === 24 && minor >= 15) || major >= 26;
if (!ok) {
  console.error(
    `Node.js ${process.versions.node} is too old. Use the version in .nvmrc (nvm use $(cat .nvmrc)).`,
  );
  process.exit(1);
}
