// Heuristic bot opponents.
import { EFFECTS } from './effects.js';
import { probAtLeast } from './util.js';

const jitter = () => Math.random() * 4;

export function threat(g, q) {
  return q.slain.length * 6 + g.classes(q).size * 1.8 + q.party.length * 0.6;
}

// How much a Hero in `owner`'s Party is worth to them.
function heroValue(g, owner, h) {
  const c = g.effClass(h);
  const shared = c && (owner.leader.cls === c || owner.party.some(x => x !== h && g.effClass(x) === c));
  let v = 5 + (c && !shared ? 4 : 0);
  if (h.item && !h.item.def.cursed) v += 1.5;
  if (h.item?.def.cursed) v -= 2;
  return v;
}

export function cardValue(g, p, c) {
  const d = c.def;
  switch (d.type) {
    case 'hero': return 6 + (g.classes(p).has(d.cls) ? 0 : 3);
    case 'magic': return 4 + (EFFECTS[d.effect].ai ?? 15) / 10;
    case 'item': return d.cursed ? 3.5 : 4;
    case 'modifier': return 2.5 + Math.max(...d.options.map(Math.abs)) * 0.3;
    case 'challenge': return 4;
  }
  return 1;
}

// Change in number of classes if `h` were to count as class `cls`.
function classGain(g, p, h, cls) {
  const before = g.classes(p).size;
  const s = new Set([p.leader.cls]);
  for (const x of p.party) { const c = x === h ? cls : g.effClass(x); if (c) s.add(c); }
  return s.size - before;
}

export function choose(g, p, req) {
  const score = o => {
    switch (req.kind) {
      case 'destroy':
      case 'return':
        return threat(g, o.owner) + heroValue(g, o.owner, o.hero) - (o.hero.item?.def.kind === 'decoy' ? 8 : 0);
      case 'steal':
        return threat(g, o.owner) + heroValue(g, o.owner, o.hero) + (g.classes(p).has(g.effClass(o.hero)) ? 0 : 6);
      case 'discard':
      case 'give':
        return -cardValue(g, p, o.card);
      case 'sacrifice':
        return -heroValue(g, p, o.hero);
      case 'take':
        return cardValue(g, p, o.card);
      case 'lookDiscard':
        return cardValue(g, p, o.card);
      case 'player':
        return threat(g, o.player) + o.player.hand.length * 0.5;
      case 'equip': {
        const it = req.item.def;
        if (it.cursed) {
          if (o.owner === p) return -100;
          let s = threat(g, o.owner) + heroValue(g, o.owner, o.hero);
          if (it.kind === 'hollow') s += classGain(g, o.owner, o.hero, null) < 0 ? 10 : -5;
          return s;
        }
        if (it.kind === 'mask') return classGain(g, p, o.hero, it.cls) * 10 + heroValue(g, p, o.hero) * 0.1;
        return heroValue(g, p, o.hero) + (g.canUseHero(p, o.hero) ? 1 : 0);
      }
      case 'removeItem': {
        const cursed = !!o.hero.item.def.cursed;
        if (o.owner === p) return cursed ? 20 : -20;
        return cursed ? -10 : 5 + threat(g, o.owner);
      }
      case 'confirm':
        return o.value ? 1 : 0;
    }
    return 0;
  };
  let best = null, bestS = -Infinity;
  for (const o of req.options) {
    const s = score(o) + Math.random() * 0.5;
    if (s > bestS) { best = o; bestS = s; }
  }
  return best;
}

function effectUsable(g, p, key) {
  const e = EFFECTS[key];
  return !e.canUse || e.canUse(g, p);
}

export function chooseAction(g, p) {
  const acts = [];
  const add = (score, a) => acts.push({ score: score + jitter(), a });
  const mine = g.classes(p);
  const mods = p.hand.filter(c => c.def.type === 'modifier');
  const bestMod = Math.max(0, ...mods.map(c => Math.max(...c.def.options)));

  if (p.ap >= 2) {
    for (const m of g.monsters) {
      if (!m || !g.meetsReq(p, m)) continue;
      const b = g.attackBonus(p);
      const pr = Math.max(probAtLeast(m.slay - b), probAtLeast(m.slay - b - bestMod) * 0.85);
      const risk = 1 - probAtLeast(m.fail + 1 - b);
      const s = 100 * pr - 30 * risk + p.slain.length * 12;
      if (s >= 22) add(s + 20, { type: 'attack', monster: m });
    }
  }
  for (const c of p.hand) {
    const d = c.def;
    if (d.type === 'hero') {
      add(mine.has(d.cls) ? 24 : 46 + (mine.size >= 5 ? 50 : 0), { type: 'play', card: c });
    } else if (d.type === 'magic') {
      if (effectUsable(g, p, d.effect)) add(EFFECTS[d.effect].ai ?? 18, { type: 'play', card: c });
    } else if (d.type === 'item') {
      const t = g.equipTargets(p, c);
      if (d.cursed) {
        if (t.some(o => o.owner !== p)) add(22, { type: 'play', card: c });
      } else if (d.kind === 'mask') {
        if (t.some(o => classGain(g, p, o.hero, d.cls) > 0)) add(40 + (mine.size >= 5 ? 50 : 0), { type: 'play', card: c });
      } else if (t.length) {
        add(19, { type: 'play', card: c });
      }
    }
  }
  for (const h of p.party) {
    if (!g.canUseHero(p, h) || !effectUsable(g, p, h.def.effect)) continue;
    const pr = probAtLeast(h.def.req - g.heroBonus(p, h));
    add(8 + 40 * pr, { type: 'roll', hero: h });
  }
  if (p.ap >= 3 && p.hand.length <= 1) add(30, { type: 'redraw' });
  add(17, { type: 'draw' });

  acts.sort((x, y) => y.score - x.score);
  return acts[0].a;
}

export function wantsChallenge(g, q, p, c) {
  const d = c.def;
  let pr = 0.15;
  if (d.type === 'hero') {
    const pc = g.classes(p);
    if (!pc.has(d.cls)) pr = pc.size >= 5 ? 1 : pc.size >= 4 ? 0.6 : 0.25;
    else pr = 0.08;
  } else if (d.type === 'magic') {
    const e = d.effect;
    if (/destroy|steal/i.test(e)) pr = q.party.length ? 0.55 : 0.2;
    else pr = 0.15;
  } else if (d.type === 'item') {
    const t = g.limbo?.target;
    if (d.cursed && t?.owner === q) pr = 0.6;
    else if (d.kind === 'mask') pr = 0.35;
  }
  if (threat(g, p) > threat(g, q) + 4) pr += 0.15;
  if (q.hand.filter(x => x.def.type === 'challenge').length > 1) pr += 0.1;
  return Math.random() < pr;
}

export function chooseModifier(g, q, state, plays) {
  const want = state.spec.wants(q);
  if (want === null || state.ok() === want) return null;
  const good = plays.filter(x => x.result === want);
  if (!good.length) return null;
  const involved = state.rolls.some(r => r.player === q);
  if (!involved) {
    const roller = state.rolls[0].player;
    let pr = state.spec.kind === 'attack' ? 0.55 + (roller.slain.length >= 2 ? 0.45 : 0) : 0.25;
    if (threat(g, roller) > threat(g, q) + 6) pr += 0.2;
    if (Math.random() >= pr) return null;
  }
  good.sort((a, b) => Math.abs(a.value) - Math.abs(b.value));
  return good[0];
}
