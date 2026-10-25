import { CLASSES, CLASS_KEYS, fmtMod } from './cards.js';
import { probAtLeast } from './util.js';

const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const d6 = () => 1 + Math.floor(Math.random() * 6);

const TYPE_COLOR = { item: '#6b6f7a', magic: '#5b3fa0', modifier: '#2a8c8c', challenge: '#a8322a' };
const TYPE_NAME = { hero: 'Hero', item: 'Item', magic: 'Magic', modifier: 'Modifier', challenge: 'Challenge' };
const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
const dieHTML = n => `<div class="die">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `<i class="${PIPS[n].includes(i) ? 'pip' : ''}"></i>`).join('')}</div>`;
const hl = s => esc(s).replace(/\b(DRAW|DISCARD|DESTROY|DESTROYED|SACRIFICE|STEAL|STOLEN|CHALLENGE|CHALLENGED|ATTACK|SLAY)\b/g, '<b>$1</b>');
const isTouch = () => window.matchMedia('(hover: none)').matches;

export class UI {
  constructor() {
    this.speed = 1;
    this.keys = new Map();
    this.g = null;
    this.awaiting = null;
    this.$ = id => document.getElementById(id);
    document.addEventListener('click', e => this.onClick(e));
    document.addEventListener('mouseover', e => this.onHover(e));
  }

  pause(mult = 1) { return sleep(650 * this.speed * mult); }

  // ---------- card components ----------
  cardHTML(c, o = {}) {
    const d = c.def;
    const key = 'c' + c.uid;
    this.keys.set(key, { kind: 'card', c });
    const cls = d.type === 'hero' ? CLASSES[d.cls] : null;
    const color = cls ? cls.color : (d.cursed ? '#3b3b3b' : TYPE_COLOR[d.type]);
    let type = TYPE_NAME[d.type], text = hl(d.text);
    if (cls) { type = `${cls.icon} ${cls.name}`; text = `<span class="req">${d.req}+</span> ${hl(d.text)}`; }
    if (d.type === 'item') type = d.cursed ? 'Cursed Item' : 'Item';
    if (d.type === 'modifier') text = `<div class="mod-big">${d.options.map(fmtMod).join(' / ')}</div>`;
    const item = o.inParty && c.item
      ? `<div class="c-item ${c.item.def.cursed ? 'cursed' : ''}" data-key="c${c.item.uid}">${c.item.def.art} ${esc(c.item.def.name)}</div>`
      : '';
    if (c.item) this.keys.set('c' + c.item.uid, { kind: 'card', c: c.item });
    const used = o.inParty && d.type === 'hero' && this.g && c.usedTurn === this.g.turn ? '<div class="c-used">used</div>' : '';
    const act = o.act ? `data-act="${o.act}" data-uid="${c.uid}"` : '';
    return `<div class="card t-${d.type} ${o.size || ''} ${o.cls || ''}" style="--cc:${color}" data-key="${key}" ${act}>
      <div class="c-name">${esc(d.name)}</div>
      <div class="c-art">${d.art}</div>
      <div class="c-type">${type}</div>
      <div class="c-text">${text}</div>
      ${item}${used}
    </div>`;
  }

  reqIcons(m) {
    return m.req.map(r => r === 'any'
      ? '<span class="req-ic any" title="Any Hero">H</span>'
      : `<span class="req-ic" style="--cc:${CLASSES[r].color}" title="${CLASSES[r].name}">${CLASSES[r].icon}</span>`).join('');
  }

  monsterHTML(m, o = {}) {
    const key = 'm' + m.uid;
    this.keys.set(key, { kind: 'monster', m });
    const act = o.act ? `data-act="${o.act}" data-mid="${m.uid}"` : '';
    return `<div class="card monster ${o.size || ''} ${o.cls || ''}" data-key="${key}" ${act}>
      ${o.odds || ''}
      <div class="c-name">${esc(m.name)}</div>
      <div class="c-art">${m.art}</div>
      <div class="m-req">${this.reqIcons(m)}</div>
      <div class="m-rolls"><span class="good">${m.slay}+ SLAY</span><span class="bad">${m.fail}− ${esc(m.penaltyText)}</span></div>
      <div class="c-text">${hl(m.skillText)}</div>
    </div>`;
  }

  leaderHTML(l, o = {}) {
    const key = 'l' + l.name;
    this.keys.set(key, { kind: 'leader', l });
    const c = CLASSES[l.cls];
    return `<div class="card leader ${o.size || ''} ${o.cls || ''}" style="--cc:${c.color}" data-key="${key}" ${o.attrs || ''}>
      <div class="c-name">${esc(l.name)}</div>
      <div class="c-art">${l.art}</div>
      <div class="c-type">${c.icon} Party Leader · ${c.name}</div>
      <div class="c-text">${hl(l.text)}</div>
    </div>`;
  }

  keyHTML(key, o) {
    const e = this.keys.get(key);
    if (!e) return '';
    if (e.kind === 'card') return this.cardHTML(e.c, o);
    if (e.kind === 'monster') return this.monsterHTML(e.m, o);
    return this.leaderHTML(e.l, o);
  }

  classPips(g, p) {
    const have = g.classes(p);
    return `<span class="pips" title="${have.size}/6 classes">${CLASS_KEYS.map(k =>
      `<span class="cpip ${have.has(k) ? 'on' : ''}" style="--cc:${CLASSES[k].color}" title="${CLASSES[k].name}">${CLASSES[k].icon}</span>`).join('')}</span>`;
  }

  apPips(p) {
    return `<span class="ap">${Array.from({ length: Math.max(p.ap, 3) }, (_, i) => `<i class="${i < p.ap ? 'on' : ''}"></i>`).join('')}</span>`;
  }

  // ---------- board ----------
  render(g) {
    this.g = g;
    const me = g.human;
    const cur = g.players[g.current];
    const myTurn = !!this.awaiting;

    this.$('opponents').innerHTML = g.players.filter(p => !p.isHuman).map(p => `
      <div class="opp ${p === cur ? 'active' : ''}">
        <div class="opp-head">
          <span class="pname">${esc(p.name)}</span>
          <span class="badge" title="Cards in hand">✋ ${p.hand.length}</span>
          <span class="badge" title="Monsters slain">💀 ${p.slain.length}/3</span>
          ${this.classPips(g, p)}
          ${p === cur ? this.apPips(p) : ''}
        </div>
        <div class="row">
          ${this.leaderHTML(p.leader, { size: 'sm' })}
          ${p.party.map(h => this.cardHTML(h, { size: 'sm', inParty: true })).join('')}
          ${p.slain.map(m => this.monsterHTML(m, { size: 'sm', cls: 'slain' })).join('')}
        </div>
      </div>`).join('');

    this.$('monsters').innerHTML = g.monsters.map(m => {
      if (!m) return '<div class="card empty">No monster left</div>';
      const meets = g.meetsReq(me, m);
      const ok = myTurn && me.ap >= 2 && meets;
      const b = g.attackBonus(me);
      const odds = meets
        ? `<div class="m-odds" title="Your chance to slay / chance it fights back">🎯 ${Math.round(100 * probAtLeast(m.slay - b))}% · ⚠️ ${Math.round(100 * (1 - probAtLeast(m.fail + 1 - b)))}%</div>`
        : '<div class="m-odds locked" title="Your Party doesn\'t meet the requirements">🔒 Need party</div>';
      return this.monsterHTML(m, { act: 'attack', odds, cls: ok ? 'can' : (meets ? '' : 'locked') });
    }).join('');

    const top = g.discard[g.discard.length - 1];
    this.$('piles').innerHTML = `
      <div class="pile"><div class="card back"><span>HERE TO<br>SLAY</span></div><div class="pile-label">Main deck · ${g.deck.length}</div></div>
      <div class="pile" data-act="view-discard" title="View discard pile">
        ${top ? this.cardHTML(top, { cls: 'discard-top' }) : '<div class="card empty">Empty</div>'}
        <div class="pile-label">Discard · ${g.discard.length} 🔍</div>
      </div>
      <div class="pile"><div class="card back monster-back"><span>👾</span></div><div class="pile-label">Monster deck · ${g.monsterDeck.length}</div></div>
      ${g.limbo ? `<div class="pile limbo">${this.cardHTML(g.limbo.card)}<div class="pile-label">Being played…</div></div>` : ''}`;

    const status = g.over
      ? (g.winner ? `${esc(g.winner.name)} won!` : 'Game over')
      : myTurn ? 'Your turn — pick an action' : `${esc(cur.name)} is taking their turn…`;
    this.$('me').innerHTML = `
      <div class="me-head ${cur === me ? 'active' : ''}">
        <span class="pname">${esc(me.name)}</span>
        <span class="badge">💀 ${me.slain.length}/3</span>
        ${this.classPips(g, me)}
        ${cur === me ? this.apPips(me) : ''}
        <span class="status">${status}</span>
        <span class="spacer"></span>
        <button data-act="draw" ${myTurn && me.ap >= 1 ? '' : 'disabled'} title="Draw a card (1 AP)">Draw <small>1</small></button>
        <button data-act="redraw" ${myTurn && me.ap >= 3 ? '' : 'disabled'} title="Discard your hand and draw 5 (3 AP)">New hand <small>3</small></button>
        <button data-act="end" class="primary" ${myTurn ? '' : 'disabled'}>End turn</button>
      </div>
      <div class="me-party">
        <div class="zone-label">Your Party</div>
        <div class="row">
          ${this.leaderHTML(me.leader)}
          ${me.party.map(h => this.cardHTML(h, {
            inParty: true, act: 'roll',
            cls: myTurn && me.ap >= 1 && g.canUseHero(me, h) ? 'can' : '',
          })).join('')}
          ${me.slain.map(m => this.monsterHTML(m, { cls: 'slain', size: 'sm' })).join('')}
        </div>
      </div>
      <div class="me-hand">
        <div class="zone-label">Your hand (${me.hand.length})</div>
        <div class="row hand">
          ${me.hand.map(c => this.cardHTML(c, { act: 'play', cls: myTurn && me.ap >= 1 && g.canPlay(me, c) ? 'can' : '' })).join('') || '<em class="muted">No cards</em>'}
        </div>
      </div>`;
  }

  log(msg, cls = '') {
    const ol = this.$('log');
    const li = document.createElement('li');
    li.className = cls;
    li.textContent = msg;
    ol.appendChild(li);
    while (ol.children.length > 300) ol.firstChild.remove();
    ol.scrollTop = ol.scrollHeight;
  }

  toast(msg) {
    const t = this.$('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
  }

  // ---------- input ----------
  waitForAction(g) {
    return new Promise(res => { this.awaiting = res; this.render(g); });
  }

  act(action) {
    const r = this.awaiting;
    if (!r) return;
    this.awaiting = null;
    this.hidePreview();
    this.render(this.g);
    r(action);
  }

  // Validates a board action for the human; returns the action or shows why not.
  tryAct(act, el) {
    const g = this.g;
    if (!g) return;
    if (act === 'view-discard') return this.viewDiscard();
    if (!['draw', 'redraw', 'end', 'play', 'roll', 'attack'].includes(act)) return;
    if (!this.awaiting) return this.toast(g.over ? 'The game is over.' : 'Wait for your turn.');
    const p = g.human;
    switch (act) {
      case 'end': return this.act({ type: 'end' });
      case 'draw': return p.ap >= 1 ? this.act({ type: 'draw' }) : this.toast('No action points left.');
      case 'redraw': return p.ap >= 3 ? this.act({ type: 'redraw' }) : this.toast('Needs all 3 action points.');
      case 'play': {
        const c = p.hand.find(x => x.uid === +el.dataset.uid);
        if (!c) return;
        if (p.ap < 1) return this.toast('No action points left.');
        if (c.def.type === 'modifier') return this.toast('Modifier cards are played when someone rolls the dice.');
        if (c.def.type === 'challenge') return this.toast('Challenge cards are played when another player plays a card.');
        if (!g.canPlay(p, c)) return this.toast(c.def.cursed ? 'There is no Hero without an Item to curse.' : 'You need a Hero without an Item in your Party.');
        return this.act({ type: 'play', card: c });
      }
      case 'roll': {
        const h = p.party.find(x => x.uid === +el.dataset.uid);
        if (!h) return;
        if (p.ap < 1) return this.toast('No action points left.');
        if (h.item?.def.kind === 'seal') return this.toast("This Hero's effect is sealed.");
        if (!g.canUseHero(p, h)) return this.toast("You've already rolled for this Hero this turn.");
        return this.act({ type: 'roll', hero: h });
      }
      case 'attack': {
        const m = g.monsters.find(x => x && x.uid === +el.dataset.mid);
        if (!m) return;
        if (p.ap < 2) return this.toast('Attacking costs 2 action points.');
        if (!g.meetsReq(p, m)) return this.toast("Your Party doesn't meet this Monster's requirements.");
        return this.act({ type: 'attack', monster: m });
      }
    }
  }

  onClick(e) {
    if (e.target.closest('#modal, #roll')) return;
    if (e.target.closest('#preview')) {
      const b = e.target.closest('[data-pact]');
      const src = this.previewSource;
      this.hidePreview();
      if (b && src) this.tryAct(b.dataset.pact, src);
      return;
    }
    const el = e.target.closest('[data-act]');
    const card = e.target.closest('[data-key]');
    // On touch screens a tap on a card opens a large preview with its action button.
    if (card && isTouch() && el?.dataset.act !== 'view-discard') {
      return this.showPreview(card, el && el.contains(card) ? el : null, true);
    }
    if (el) this.tryAct(el.dataset.act, el);
  }

  onHover(e) {
    if (isTouch() || this.previewSticky) return;
    const el = e.target.closest('[data-key]');
    if (!el || el.closest('#modal') && !el.closest('.choice')) {
      if (!el) this.hidePreview();
      return;
    }
    this.showPreview(el, null, false);
  }

  showPreview(cardEl, actEl, sticky) {
    const key = cardEl.dataset.key;
    if (!this.keys.has(key)) return;
    const pv = this.$('preview');
    const labels = { play: 'Play this card', roll: 'Roll for effect', attack: 'Attack' };
    const btn = sticky && actEl && labels[actEl.dataset.act] && this.awaiting
      ? `<button class="primary" data-pact="${actEl.dataset.act}">${labels[actEl.dataset.act]}</button>` : '';
    pv.innerHTML = `${this.keyHTML(key, { cls: 'big' })}${sticky ? `<div class="pv-btns">${btn}<button>Close</button></div>` : ''}`;
    pv.classList.remove('hidden');
    pv.classList.toggle('sticky', sticky);
    this.previewSticky = sticky;
    this.previewSource = actEl;
  }

  hidePreview() {
    this.$('preview').classList.add('hidden');
    this.previewSticky = false;
    this.previewSource = null;
  }

  // ---------- modals ----------
  modal(html, wide) {
    const m = this.$('modal');
    const box = m.querySelector('.modal-box');
    box.innerHTML = html;
    box.classList.toggle('wide', !!wide);
    m.classList.remove('hidden');
    return box;
  }
  closeModal() { this.$('modal').classList.add('hidden'); this.hidePreview(); }

  choose(req) {
    return new Promise(res => {
      const withCards = req.options.some(o => o.card);
      const extra = req.cards ? `<div class="choice-grid">${req.cards.map(c => this.cardHTML(c)).join('')}</div>` : '';
      const body = withCards
        ? `<div class="choice-grid">${req.options.map((o, i) => `
            <div class="choice" data-i="${i}">${this.cardHTML(o.card, { inParty: !!o.hero })}<div class="choice-label">${esc(o.label)}</div></div>`).join('')}</div>`
        : `<div class="btns">${req.options.map((o, i) => `<button data-i="${i}" class="${o.value === true ? 'primary' : ''}">${esc(o.label)}</button>`).join('')}</div>`;
      const box = this.modal(`<h3>${esc(req.title)}</h3>${req.text ? `<p>${esc(req.text)}</p>` : ''}${extra}${body}
        ${req.optional ? '<div class="btns"><button data-skip>Skip</button></div>' : ''}`, withCards);
      box.querySelectorAll('[data-i]').forEach(el => el.addEventListener('click', () => {
        this.closeModal();
        res(req.options[+el.dataset.i]);
      }));
      box.querySelector('[data-skip]')?.addEventListener('click', () => { this.closeModal(); res(null); });
    });
  }

  askChallenge(g, p, c) {
    return new Promise(res => {
      const n = g.human.hand.filter(x => x.def.type === 'challenge').length;
      const t = g.limbo?.target;
      const box = this.modal(`<h3>${esc(p.name)} is playing a card</h3>
        <div class="choice-grid">${this.cardHTML(c)}</div>
        ${t ? `<p>Target: ${esc(t.owner.name)}'s ${esc(t.hero.def.name)}</p>` : ''}
        <p>You have ${n} Challenge card${n > 1 ? 's' : ''}. Challenge it? You'll both roll — if your roll is equal or higher, the card is discarded.</p>
        <div class="btns"><button data-v="1" class="danger">⚡ Challenge!</button><button data-v="0">Let it pass</button></div>`);
      box.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => { this.closeModal(); res(b.dataset.v === '1'); }));
    });
  }

  viewDiscard() {
    const g = this.g;
    const box = this.modal(`<h3>Discard pile (${g.discard.length})</h3>
      <div class="choice-grid">${[...g.discard].reverse().map(c => this.cardHTML(c, { size: 'sm' })).join('') || '<em>Empty</em>'}</div>
      <div class="btns"><button data-close class="primary">Close</button></div>`, true);
    box.querySelector('[data-close]').addEventListener('click', () => this.closeModal());
  }

  gameOver(g) {
    const won = g.winner?.isHuman;
    const box = this.modal(`<h3>${won ? '🏆 You win!' : g.winner ? `${esc(g.winner.name)} wins` : 'Game over'}</h3>
      <p>${g.winner ? `${esc(g.winner.name)} ${esc(g.winHow)}.` : 'Nobody could finish the job.'}</p>
      ${won ? '<p>You can officially brag that you are the best adventurer and monster slayer in the entire world!</p>' : '<p>Better luck next time, adventurer.</p>'}
      <div class="btns"><button data-again class="primary">Play again</button><button data-close>Look at the board</button></div>`);
    box.querySelector('[data-again]').addEventListener('click', () => location.reload());
    box.querySelector('[data-close]').addEventListener('click', () => this.closeModal());
  }

  // ---------- dice ----------
  rollHTML(state, final) {
    const s = state.spec;
    const totals = state.totals();
    const ok = state.ok();
    const rows = state.rolls.map((r, i) => `
      <div class="roll-row">
        <span class="who">${esc(r.label)}</span>
        ${dieHTML(r.dice[0])}${dieHTML(r.dice[1])}
        <span class="adj">${r.bonus ? `<span title="bonuses">${fmtMod(r.bonus)}</span>` : ''}${r.mod ? `<span class="modv" title="modifiers">${fmtMod(r.mod)}</span>` : ''}</span>
        <span class="total">${totals[i]}</span>
      </div>`).join('');
    let res = ok ? s.okText : s.failText;
    if (final && !ok && s.monster && totals[0] <= s.monster.fail) res = `${s.monster.name} fights back! ${s.monster.penaltyText}`;
    return `<div class="roll-title">${hl(s.title)}</div>${rows}
      <div class="roll-need">${esc(s.needText || '')}</div>
      <div class="roll-result ${ok ? 'good' : 'bad'} ${final ? 'final' : ''}">${final ? '' : 'Currently: '}${esc(res)}</div>
      <div class="roll-mods"></div>`;
  }

  async rollStart(state) {
    const el = this.$('roll');
    el.classList.remove('hidden', 'done');
    const real = state.rolls.map(r => r.dice);
    for (let f = 0; f < 7; f++) {
      state.rolls.forEach(r => { r.dice = [d6(), d6()]; });
      el.innerHTML = this.rollHTML(state, false);
      el.querySelector('.roll-result').style.visibility = 'hidden';
      await sleep(55);
    }
    state.rolls.forEach((r, i) => { r.dice = real[i]; });
    el.innerHTML = this.rollHTML(state, false);
    await this.pause(0.5);
  }

  async rollUpdate(state) {
    const el = this.$('roll');
    el.innerHTML = this.rollHTML(state, false);
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 400);
    await this.pause(0.6);
  }

  async rollEnd(state, ok) {
    const el = this.$('roll');
    el.innerHTML = this.rollHTML(state, true);
    el.classList.add('done');
    const mine = state.rolls.some(r => r.player.isHuman);
    await sleep(Math.max(mine ? 1300 : 700, 1300 * this.speed));
    el.classList.add('hidden');
  }

  promptModifier(state, plays, g) {
    return new Promise(res => {
      const el = this.$('roll');
      el.innerHTML = this.rollHTML(state, false);
      const want = state.spec.wants(g.human);
      const s = state.spec;
      const seen = new Set();
      const uniq = plays.filter(x => {
        if (!x.flips) return false;
        const k = `${x.value}|${x.idx}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      const multi = state.rolls.length > 1;
      const box = el.querySelector('.roll-mods');
      const tone = x => (want === null ? '' : x.result === want ? 'helps' : 'hurts');
      box.innerHTML = `<div class="mods-label">Play a Modifier card to change the outcome?</div>
        <div class="btns">${uniq.map((x, i) => `<button data-i="${i}" class="${tone(x)}">🧪 ${fmtMod(x.value)}${multi ? ` on ${esc(state.rolls[x.idx].player.name)}` : ''}
          <small class="outcome">→ ${esc(x.result ? s.okText : s.failText)}</small></button>`).join('')}
        <button data-pass class="primary">Pass</button></div>`;
      box.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => res(uniq[+b.dataset.i])));
      box.querySelector('[data-pass]').addEventListener('click', () => { box.innerHTML = ''; res(null); });
    });
  }
}
