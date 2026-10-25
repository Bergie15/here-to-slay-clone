import { LEADERS, MONSTERS, PENALTIES, buildMainDeck, fmtMod } from './cards.js';
import { EFFECTS } from './effects.js';
import * as AI from './ai.js';
import { d6, shuffle, probAtLeast } from './util.js';

let UID = 1;
const inst = def => ({ uid: UID++, def, item: null, usedTurn: -1 });

export const BOT_NAMES = ['Bramble', 'Pip', 'Mortimer', 'Juniper', 'Fizz'];

export class Game {
  constructor({ ui, name, leaderIndex, bots }) {
    this.ui = ui;
    this.turn = 0;
    this.over = false;
    this.winner = null;
    this.deck = shuffle(buildMainDeck().map(inst));
    this.discard = [];
    this.monsterDeck = shuffle(MONSTERS.map(m => ({ ...m, uid: UID++ })));
    this.monsters = this.monsterDeck.splice(0, 3);
    this.limbo = null;

    const pool = [...LEADERS];
    const mine = pool.splice(leaderIndex, 1)[0];
    shuffle(pool);
    const mk = (id, name, isHuman, leader) => ({ id, name, isHuman, leader, hand: [], party: [], slain: [], ap: 0, turnBonus: 0 });
    this.players = [mk(0, name, true, mine)];
    for (let i = 0; i < bots; i++) this.players.push(mk(i + 1, BOT_NAMES[i], false, pool[i]));
    for (const p of this.players) for (let i = 0; i < 5; i++) p.hand.push(this.deck.pop());
    // Whoever picked their Party Leader last goes first: the bots pick after you.
    this.current = this.players.length - 1;
  }

  // ---------- queries ----------
  get human() { return this.players[0]; }
  others(p) {
    const i = this.players.indexOf(p), n = this.players.length;
    return Array.from({ length: n - 1 }, (_, k) => this.players[(i + 1 + k) % n]);
  }
  skill(p, key) { return (p.leader.skill === key ? 1 : 0) + p.slain.filter(m => m.skill === key).length; }
  effClass(h) {
    const k = h.item?.def.kind;
    if (k === 'hollow') return null;
    if (k === 'mask') return h.item.def.cls;
    return h.def.cls;
  }
  classes(p) {
    const s = new Set([p.leader.cls]);
    for (const h of p.party) { const c = this.effClass(h); if (c) s.add(c); }
    return s;
  }
  heroBonus(p, h) {
    let b = this.skill(p, 'heroRoll1') + p.turnBonus;
    const it = h.item?.def;
    if (it?.kind === 'bonus') b += it.value;
    if (it?.kind === 'shackles') b -= 2;
    return b;
  }
  attackBonus(p) { return this.skill(p, 'attack1') + p.turnBonus; }
  challengeBonus(p) { return 2 * this.skill(p, 'challenge2') + p.turnBonus; }
  canUseHero(p, h) { return h.usedTurn !== this.turn && h.item?.def.kind !== 'seal'; }
  meetsReq(p, m) {
    const heroes = [...p.party];
    let leaderUsed = false, any = 0;
    for (const slot of m.req) {
      if (slot === 'any') { any++; continue; }
      if (!leaderUsed && p.leader.cls === slot) { leaderUsed = true; continue; }
      const i = heroes.findIndex(h => this.effClass(h) === slot);
      if (i < 0) return false;
      heroes.splice(i, 1);
    }
    return heroes.length >= any;
  }
  opponentHeroes(p) { return this.others(p).flatMap(owner => owner.party.map(hero => ({ owner, hero }))); }
  equipTargets(p, item) {
    const owners = item.def.cursed ? [...this.others(p), p] : [p];
    return owners.flatMap(owner => owner.party.filter(h => !h.item).map(hero => ({ owner, hero })));
  }
  canPlay(p, c) {
    const t = c.def.type;
    if (t === 'hero' || t === 'magic') return true;
    if (t === 'item') return this.equipTargets(p, c).length > 0;
    return false;
  }
  ownerOf(h) { return this.players.find(q => q.party.includes(h)); }

  // ---------- plumbing ----------
  log(msg, cls) { this.ui.log(msg, cls); }
  refresh() { this.ui.render(this); }
  pause(mult = 1) { return this.ui.pause(mult); }

  async choose(p, req) {
    if (!req.options.length) return null;
    if (p.isHuman) return this.ui.choose(req, this);
    return AI.choose(this, p, req);
  }
  async confirm(p, text, card) {
    const o = await this.choose(p, {
      kind: 'confirm', title: text, cards: card ? [card] : null,
      options: [{ label: 'Yes', value: true }, { label: 'No', value: false }],
    });
    return o.value;
  }
  async pickOpponentHero(p, kind, title) {
    return this.choose(p, {
      kind, title,
      options: this.opponentHeroes(p).map(o => ({ ...o, card: o.hero, label: `${o.owner.name}'s ${o.hero.def.name}` })),
    });
  }
  async pickEquipped(p, kind, title) {
    const opts = this.players.flatMap(owner => owner.party.filter(h => h.item)
      .map(hero => ({ owner, hero, card: hero.item, label: `${hero.item.def.name} on ${owner.name}'s ${hero.def.name}` })));
    return this.choose(p, { kind, title, options: opts });
  }
  async pickPlayer(p, kind, title, filter = () => true) {
    const o = await this.choose(p, {
      kind, title,
      options: this.others(p).filter(filter).map(player => ({
        player, label: `${player.name} (${player.hand.length} in hand, ${player.party.length} heroes)`,
      })),
    });
    return o?.player ?? null;
  }

  // ---------- card movement ----------
  drawCard() {
    if (!this.deck.length) {
      if (!this.discard.length) return null;
      this.deck = shuffle(this.discard);
      this.discard = [];
      this.log('The discard pile is shuffled to form a new main deck.', 'sys');
    }
    return this.deck.pop();
  }
  draw(p, n = 1) {
    const got = [];
    for (let i = 0; i < n; i++) { const c = this.drawCard(); if (c) { p.hand.push(c); got.push(c); } }
    if (got.length) {
      const what = p.isHuman ? `: ${got.map(c => c.def.name).join(', ')}` : '';
      this.log(`${p.name} draws ${got.length > 1 ? got.length + ' cards' : 'a card'}${what}.`);
    }
    this.refresh();
    return got;
  }
  gainAP(p, n) { p.ap += n; this.log(`${p.name} gains ${n} action point.`); }
  removeFromHand(p, c) { const i = p.hand.indexOf(c); if (i >= 0) p.hand.splice(i, 1); }
  toDiscard(c) { c.item = null; this.discard.push(c); }
  detach(owner, h) { const i = owner.party.indexOf(h); if (i >= 0) owner.party.splice(i, 1); }

  async forceDiscard(q, n, title) {
    for (let i = 0; i < n && q.hand.length; i++) {
      const o = await this.choose(q, { kind: 'discard', title, options: q.hand.map(card => ({ card, label: card.def.name })) });
      this.removeFromHand(q, o.card);
      this.toDiscard(o.card);
      this.log(`${q.name} discards ${o.card.def.name}.`);
    }
    this.refresh();
  }
  lossTrigger(owner) {
    const n = 2 * this.skill(owner, 'lossDraw2') + this.skill(owner, 'lossDraw');
    if (n) this.draw(owner, n);
  }
  async destroyHero(by, owner, h) {
    if (this.skill(owner, 'destroyProof')) {
      this.log(`${owner.name}'s Heroes cannot be destroyed — ${h.def.name} is safe.`);
      return false;
    }
    if (h.item?.def.kind === 'decoy') {
      this.log(`${h.item.def.name} takes the hit — ${owner.name}'s ${h.def.name} survives!`);
      this.toDiscard(h.item);
      h.item = null;
      return false;
    }
    this.detach(owner, h);
    if (h.item) this.toDiscard(h.item);
    this.toDiscard(h);
    this.log(`${by.name} DESTROYS ${owner.name}'s ${h.def.name}!`, 'bad');
    this.refresh();
    this.lossTrigger(owner);
    return true;
  }
  async doDestroy(p) {
    const o = await this.pickOpponentHero(p, 'destroy', 'Choose a Hero to DESTROY');
    if (!o) { this.log('There is no Hero to destroy.'); return null; }
    await this.destroyHero(p, o.owner, o.hero);
    return o;
  }
  async doSteal(p) {
    const o = await this.pickOpponentHero(p, 'steal', 'Choose a Hero to STEAL');
    if (!o) { this.log('There is no Hero to steal.'); return null; }
    this.detach(o.owner, o.hero);
    p.party.push(o.hero);
    this.log(`${p.name} STEALS ${o.owner.name}'s ${o.hero.def.name}!`, 'bad');
    this.refresh();
    this.lossTrigger(o.owner);
    return o;
  }
  sacrifice(p, h) {
    this.detach(p, h);
    if (h.item) this.toDiscard(h.item);
    this.toDiscard(h);
    this.log(`${p.name} sacrifices ${h.def.name}.`, 'bad');
  }
  returnToHand(owner, h) {
    this.detach(owner, h);
    owner.hand.push(h);
    if (h.item) owner.hand.push(h.item);
    h.item = null;
    this.log(`${owner.name}'s ${h.def.name} is returned to their hand.`);
    this.refresh();
  }
  discardItem(owner, h) {
    this.log(`${h.item.def.name} on ${owner.name}'s ${h.def.name} is discarded.`);
    this.toDiscard(h.item);
    h.item = null;
    this.refresh();
  }
  returnItem(owner, h) {
    this.log(`${h.item.def.name} returns to ${owner.name}'s hand.`);
    owner.hand.push(h.item);
    h.item = null;
    this.refresh();
  }
  pull(p, q, n) {
    const got = [];
    for (let i = 0; i < n && q.hand.length; i++) {
      const c = q.hand.splice(Math.floor(Math.random() * q.hand.length), 1)[0];
      p.hand.push(c);
      got.push(c);
    }
    if (got.length) {
      const what = p.isHuman || q.isHuman ? ` (${got.map(c => c.def.name).join(', ')})` : '';
      this.log(`${p.name} pulls ${got.length > 1 ? got.length + ' cards' : 'a card'} from ${q.name}'s hand${what}.`);
    }
    this.refresh();
    return got;
  }
  async searchDiscard(p, type) {
    const opts = this.discard.filter(c => type === 'any' || c.def.type === type).map(card => ({ card, label: card.def.name }));
    if (!opts.length) { this.log('Nothing suitable in the discard pile.'); return; }
    const o = await this.choose(p, { kind: 'take', title: 'Take a card from the discard pile', options: opts });
    this.discard.splice(this.discard.indexOf(o.card), 1);
    p.hand.push(o.card);
    this.log(`${p.name} takes ${o.card.def.name} from the discard pile.`);
    this.refresh();
  }
  async drawAndMaybePlay(p, type) {
    const [c] = this.draw(p, 1);
    if (!c) return;
    if ((type === 'any' || c.def.type === type) && this.canPlay(p, c)) {
      if (await this.confirm(p, `You drew ${c.def.name}. Play it immediately?`, c)) await this.playCard(p, c, { free: true });
    }
  }

  // ---------- rolls ----------
  // spec: { title, kind, rolls: [{player, bonus, label}], need, success(totals), wants(player) -> true|false|null }
  async roll(spec) {
    const state = {
      spec,
      rolls: spec.rolls.map(r => ({ ...r, dice: [d6(), d6()], mod: 0 })),
    };
    state.totals = () => state.rolls.map(r => r.dice[0] + r.dice[1] + r.bonus + r.mod);
    state.ok = () => spec.success(state.totals());
    await this.ui.rollStart(state, this);

    const order = [spec.rolls[0].player, ...this.others(spec.rolls[0].player)];
    let passes = 0, i = 0;
    while (passes < order.length && i < 60) {
      const q = order[i++ % order.length];
      const play = await this.offerModifier(q, state);
      if (!play) { passes++; continue; }
      passes = 0;
      this.removeFromHand(q, play.card);
      this.toDiscard(play.card);
      state.rolls[play.idx].mod += play.value;
      this.log(`${q.name} plays a ${fmtMod(play.value)} Modifier on ${state.rolls[play.idx].player.name}'s roll.`);
      if (this.skill(q, 'modifierDraw')) this.draw(q, this.skill(q, 'modifierDraw'));
      await this.ui.rollUpdate(state, this);
    }
    const success = state.ok();
    await this.ui.rollEnd(state, success, this);
    return { success, totals: state.totals() };
  }
  modifierPlays(q, state) {
    const cur = state.ok();
    const out = [];
    for (const card of q.hand.filter(c => c.def.type === 'modifier')) {
      for (const value of card.def.options) {
        state.rolls.forEach((r, idx) => {
          r.mod += value;
          const result = state.ok();
          r.mod -= value;
          out.push({ card, value, idx, flips: result !== cur, result });
        });
      }
    }
    return out;
  }
  async offerModifier(q, state) {
    const plays = this.modifierPlays(q, state);
    if (!plays.length) return null;
    if (q.isHuman) {
      if (!plays.some(x => x.flips)) return null;
      return this.ui.promptModifier(state, plays, this);
    }
    return AI.chooseModifier(this, q, state, plays);
  }

  // ---------- actions ----------
  async playCard(p, c, { free = false } = {}) {
    if (!free) p.ap -= 1;
    this.removeFromHand(p, c);
    this.limbo = { card: c, target: null };
    let target = null;
    if (c.def.type === 'item') {
      this.refresh();
      target = await this.choose(p, {
        kind: 'equip', item: c, title: `Equip ${c.def.name} to which Hero?`,
        options: this.equipTargets(p, c).map(o => ({ ...o, card: o.hero, label: `${o.owner.name}'s ${o.hero.def.name}` })),
      });
    }
    this.limbo = { card: c, target };
    this.log(`${p.name} plays ${c.def.name}${target ? ` on ${target.owner.name}'s ${target.hero.def.name}` : ''}.`, 'play');
    this.refresh();
    await this.pause(0.6);
    const blocked = await this.challengeWindow(p, c);
    if (blocked) { this.limbo = null; this.toDiscard(c); this.refresh(); return false; }

    if (c.def.type === 'hero') {
      this.limbo = null;
      p.party.push(c);
      c.item = null;
      this.refresh();
      if (this.skill(p, 'heroPlayDraw')) this.draw(p, this.skill(p, 'heroPlayDraw'));
      if (this.canUseHero(p, c) && await this.confirm(p, `Roll to use ${c.def.name}'s effect now? Free — needs ${c.def.req}+, about ${Math.round(100 * probAtLeast(c.def.req - this.heroBonus(p, c)))}% chance.`, c)) {
        await this.useHero(p, c, { free: true });
      }
    } else if (c.def.type === 'item') {
      const h = target.hero;
      this.limbo = null;
      if (this.ownerOf(h) && !h.item) {
        h.item = c;
      } else {
        this.log(`${c.def.name} has nothing to equip to and is discarded.`);
        this.toDiscard(c);
      }
      if (this.skill(p, 'itemDraw')) this.draw(p, this.skill(p, 'itemDraw'));
    } else if (c.def.type === 'magic') {
      await EFFECTS[c.def.effect].run(this, p, c);
      this.limbo = null;
      this.toDiscard(c);
      if (this.skill(p, 'magicDraw')) this.draw(p, this.skill(p, 'magicDraw'));
    }
    this.refresh();
    this.checkWin();
    return true;
  }

  async challengeWindow(p, c) {
    for (const q of this.others(p)) {
      const ch = q.hand.find(x => x.def.type === 'challenge');
      if (!ch) continue;
      const want = q.isHuman ? await this.ui.askChallenge(this, p, c) : AI.wantsChallenge(this, q, p, c);
      if (!want) continue;
      this.removeFromHand(q, ch);
      this.toDiscard(ch);
      this.log(`${q.name} CHALLENGES ${p.name}'s ${c.def.name}!`, 'bad');
      if (this.skill(q, 'challengeDraw')) this.draw(q, this.skill(q, 'challengeDraw'));
      this.refresh();
      const r = await this.roll({
        kind: 'challenge',
        title: `${q.name} challenges ${c.def.name}`,
        rolls: [
          { player: q, bonus: this.challengeBonus(q), label: `${q.name} (challenger)` },
          { player: p, bonus: this.challengeBonus(p), label: `${p.name} (defender)` },
        ],
        needText: 'Challenger wins ties',
        success: t => t[0] >= t[1],
        wants: x => (x === q ? true : x === p ? false : null),
        okText: `Challenge succeeds — ${c.def.name} is discarded`,
        failText: `Challenge fails — ${c.def.name} is played`,
      });
      const score = `${r.totals[0]} vs ${r.totals[1]}`;
      this.log(r.success ? `The challenge succeeds (${score})! ${c.def.name} is discarded.` : `The challenge fails (${score}). ${c.def.name} goes through.`);
      return r.success;
    }
    return false;
  }

  async useHero(p, h, { free = false } = {}) {
    if (!free) p.ap -= 1;
    h.usedTurn = this.turn;
    const eff = EFFECTS[h.def.effect];
    this.log(`${p.name} rolls for ${h.def.name} (needs ${h.def.req}+).`);
    const r = await this.roll({
      kind: 'hero',
      title: `${h.def.name}: ${eff.text}`,
      rolls: [{ player: p, bonus: this.heroBonus(p, h), label: p.name }],
      needText: `Needs ${h.def.req}+`,
      success: t => t[0] >= h.def.req,
      wants: x => x === p,
      okText: 'Success!', failText: 'Failed',
    });
    if (r.success) {
      this.log(`Success (rolled ${r.totals[0]})! ${h.def.name}: ${eff.text}`, 'good');
      await eff.run(this, p, h);
    } else {
      this.log(`${p.name} fails to use ${h.def.name} (rolled ${r.totals[0]}).`);
      if (this.skill(p, 'failDraw')) this.draw(p, this.skill(p, 'failDraw'));
    }
    this.refresh();
    this.checkWin();
  }

  async attack(p, m) {
    p.ap -= 2;
    this.log(`${p.name} ATTACKS ${m.name}! (slay on ${m.slay}+, penalty on ${m.fail}-)`, 'play');
    const r = await this.roll({
      kind: 'attack',
      title: `${p.name} attacks ${m.name}`,
      rolls: [{ player: p, bonus: this.attackBonus(p), label: p.name }],
      needText: `Slay on ${m.slay}+ · ${m.penaltyText} on ${m.fail}-`,
      success: t => t[0] >= m.slay,
      wants: x => x === p,
      monster: m,
      okText: `${m.name} is slain!`,
      failText: 'The monster survives',
    });
    const total = r.totals[0];
    if (r.success) {
      const i = this.monsters.indexOf(m);
      p.slain.push(m);
      this.monsters[i] = this.monsterDeck.shift() || null;
      this.log(`${p.name} SLAYS ${m.name} (rolled ${total})! New skill: ${m.skillText}`, 'good');
      if (this.monsters[i]) this.log(`${this.monsters[i].name} appears!`, 'sys');
      this.refresh();
      this.checkWin();
    } else if (total <= m.fail) {
      this.log(`${m.name} fights back (rolled ${total})! ${p.name} must ${m.penaltyText}.`, 'bad');
      const pen = PENALTIES[m.penalty];
      if (pen.kind === 'discard') await this.forceDiscard(p, pen.n, `${m.name}: DISCARD a card`);
      else {
        for (let i = 0; i < pen.n && p.party.length; i++) {
          const o = await this.choose(p, {
            kind: 'sacrifice', title: `${m.name}: SACRIFICE a Hero`,
            options: p.party.map(hero => ({ hero, owner: p, card: hero, label: hero.def.name })),
          });
          this.sacrifice(p, o.hero);
        }
      }
    } else {
      this.log(`${m.name} survives (rolled ${total}). Nothing else happens.`);
    }
    this.refresh();
  }

  redraw(p) {
    p.ap -= 3;
    const n = p.hand.length;
    for (const c of p.hand.splice(0)) this.toDiscard(c);
    this.log(`${p.name} discards ${n} card${n === 1 ? '' : 's'} and draws 5 new cards.`);
    this.draw(p, 5);
  }

  checkWin() {
    if (this.over) return;
    for (const p of this.players) {
      if (p.slain.length >= 3) return this.win(p, 'slayed three Monsters');
    }
  }
  win(p, how) {
    if (this.over) return;
    this.over = true;
    this.winner = p;
    this.log(`🏆 ${p.name} wins — ${how}!`, 'good');
    this.winHow = how;
    this.refresh();
  }

  // ---------- turn loop ----------
  async run() {
    this.refresh();
    while (!this.over) {
      const p = this.players[this.current];
      await this.playTurn(p);
      if (this.over) break;
      if (this.turn > 1000) { this.over = true; break; } // stalemate guard
      this.current = (this.current + 1) % this.players.length;
    }
    this.ui.gameOver(this);
  }

  async playTurn(p) {
    this.turn++;
    p.ap = 3 + this.skill(p, 'extraAP');
    p.turnBonus = 0;
    this.log(`${p.name}'s turn`, 'turn');
    if (this.skill(p, 'startDraw')) this.draw(p, this.skill(p, 'startDraw'));
    this.refresh();
    while (p.ap > 0 && !this.over) {
      let a;
      if (p.isHuman) a = await this.ui.waitForAction(this, p);
      else { await this.pause(); a = AI.chooseAction(this, p); }
      if (!a || a.type === 'end') break;
      await this.perform(p, a);
      this.refresh();
    }
    if (!this.over && this.classes(p).size >= 6) this.win(p, 'ended their turn with a full Party of six classes');
    p.turnBonus = 0;
    this.refresh();
  }

  async perform(p, a) {
    switch (a.type) {
      case 'draw': p.ap -= 1; this.draw(p, 1); break;
      case 'play': await this.playCard(p, a.card); break;
      case 'roll': await this.useHero(p, a.hero); break;
      case 'attack': await this.attack(p, a.monster); break;
      case 'redraw': this.redraw(p); break;
    }
  }
}
