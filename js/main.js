import { LEADERS } from './cards.js';
import { Game } from './game.js';
import { UI } from './ui.js';

const ui = new UI();
const store = {
  get(k, d) { try { return localStorage.getItem('hts.' + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('hts.' + k, v); } catch { /* storage unavailable */ } },
};

const speedSel = document.getElementById('speed');
speedSel.value = store.get('speed', '1');
ui.speed = +speedSel.value;
speedSel.addEventListener('change', () => { ui.speed = +speedSel.value; store.set('speed', speedSel.value); });

const RULES = `
<h3>How to play</h3>
<p><b>Goal:</b> be the first to <b>SLAY three Monsters</b>, or <b>end your turn with a full Party</b> — your Party Leader plus Heroes covering all six classes.</p>
<h4>Your turn: 3 action points</h4>
<ul>
  <li><b>1 AP</b> — Draw a card.</li>
  <li><b>1 AP</b> — Play a Hero, Item or Magic card from your hand. When you play a Hero you may roll for its effect for free.</li>
  <li><b>1 AP</b> — Roll 2 dice to use the effect of a Hero in your Party (once per Hero per turn). Meet the number on the card to succeed.</li>
  <li><b>2 AP</b> — ATTACK a Monster. You must meet its Party requirements (class icons / any Hero “H”). Roll its number or higher to SLAY it and gain its skill; roll at or below its lower number and you pay the penalty.</li>
  <li><b>3 AP</b> — Discard your hand and draw 5 new cards.</li>
</ul>
<h4>Other cards</h4>
<ul>
  <li><b>Items</b> attach under a Hero (one each). Cursed Items go on enemy Heroes. Masks change a Hero's class.</li>
  <li><b>Modifiers</b> are played on <i>any</i> roll, by anyone, for free. You'll be offered the chance whenever one of yours could change the outcome.</li>
  <li><b>Challenge</b> cards stop another player's Hero, Item or Magic card: both roll, and the challenger wins ties.</li>
</ul>
<h4>Controls</h4>
<ul>
  <li>Glowing cards are things you can do right now. Click a card in your hand to play it, a Hero in your Party to roll for it, or a Monster to attack it.</li>
  <li>Hover any card to see it large (on a phone, tap it).</li>
  <li>Click the discard pile to look through it.</li>
</ul>
<p class="muted">A fan-made, unofficial solo clone inspired by <i>Here to Slay</i> by Unstable Games. Card names and art here are original placeholders.</p>`;

function showRules(onClose) {
  const box = ui.modal(`${RULES}<div class="btns"><button class="primary" data-close>Got it</button></div>`, true);
  box.querySelector('[data-close]').addEventListener('click', () => { ui.closeModal(); onClose?.(); });
}

function setup() {
  let leader = +store.get('leader', '0');
  const bots = store.get('bots', '3');
  const name = store.get('name', 'Adventurer');
  const box = ui.modal(`
    <h3>New game</h3>
    <div class="setup-row">
      <label>Your name <input id="s-name" maxlength="14" value="${name.replace(/"/g, '')}"></label>
      <label>Opponents
        <select id="s-bots">${[1, 2, 3, 4, 5].map(n => `<option ${String(n) === bots ? 'selected' : ''}>${n}</option>`).join('')}</select>
      </label>
    </div>
    <p>Choose your Party Leader:</p>
    <div class="choice-grid" id="s-leaders">
      ${LEADERS.map((l, i) => `<div class="choice ${i === leader ? 'selected' : ''}" data-l="${i}">${ui.leaderHTML(l)}</div>`).join('')}
    </div>
    <div class="btns"><button class="primary" id="s-start">Start game</button><button id="s-rules">Rules</button></div>`, true);
  box.querySelectorAll('[data-l]').forEach(el => el.addEventListener('click', () => {
    leader = +el.dataset.l;
    box.querySelectorAll('[data-l]').forEach(x => x.classList.toggle('selected', x === el));
  }));
  box.querySelector('#s-rules').addEventListener('click', () => showRules(setup));
  box.querySelector('#s-start').addEventListener('click', () => {
    const cfg = {
      name: box.querySelector('#s-name').value.trim() || 'Adventurer',
      bots: +box.querySelector('#s-bots').value,
      leaderIndex: leader,
    };
    store.set('leader', leader);
    store.set('bots', cfg.bots);
    store.set('name', cfg.name);
    ui.closeModal();
    const g = new Game({ ui, ...cfg });
    ui.log(`Welcome, ${cfg.name}! You lead ${LEADERS[leader].name}. ${g.players[g.current].name} picked last and goes first.`, 'sys');
    window.game = g; // handy for debugging from the console
    g.run();
  });
}

document.getElementById('btn-rules').addEventListener('click', () => {
  if (document.getElementById('modal').classList.contains('hidden')) showRules();
});
document.getElementById('btn-new').addEventListener('click', () => {
  if (confirm('Abandon this game and start a new one?')) location.reload();
});

setup();
