// Shared state module — prevents circular dependencies
// All modules import from here, never from each other

export let prompts = [];

export function setPrompts(p) { prompts = p; }

const modeModules = {};

export function registerMode(name, mod) { modeModules[name] = mod; }

export function getModeModules() { return modeModules; }

export function updateStats() {
  const el = document.getElementById('headerStats');
  if (!el) return;
  const totalImgs = prompts.reduce((sum, p) => sum + (p.imageCount || 0), 0);
  el.textContent = `${prompts.length} prompts / ${totalImgs} images`;
}
