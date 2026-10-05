/**
 * The speech box at the bottom of the screen.
 */
import { GAMES } from '../challenges/games/index.js';

// Dialog UI
const ui = {
  prompt: document.getElementById('prompt'), dialog: document.getElementById('dialog'),
  name: document.getElementById('dname'), text: document.getElementById('dtext'), seal: document.getElementById('dseal'),
};
const dlg = { npc: null, full: '', shown: 0, timer: 0 };
/** The interaction prompt above the dialog box. */
const promptBox = { label: '' };
/** Hide the prompt and forget what it said. */
function clearPrompt() {
  promptBox.label = '';
  ui.prompt.classList.remove('show');
}
function openDialog(npc, text) {
  dlg.npc = npc; dlg.full = text; dlg.shown = 0; dlg.timer = Math.max(4, text.length * 0.07 + 2.5);
  ui.name.textContent = npc.def.name; ui.seal.textContent = npc.def.seal || GAMES[npc.def.game].seal; ui.text.textContent = '';
  ui.dialog.classList.add('show');
}
function closeDialog() { dlg.npc = null; ui.dialog.classList.remove('show'); }

export { clearPrompt, closeDialog, dlg, openDialog, promptBox, ui };
