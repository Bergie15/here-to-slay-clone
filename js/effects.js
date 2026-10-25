// Hero and Magic card effects. `canUse` tells bots whether an effect has anything to do;
// `ai` is how much a bot wants to play a Magic card with this effect.

const anyOppHero = (g, p) => g.opponentHeroes(p).length > 0;
const anyOppHand = (g, p) => g.others(p).some(q => q.hand.length > 0);

const search = (type, label) => ({
  text: `Search the discard pile for ${label} and add it to your hand.`,
  canUse: g => g.discard.some(c => type === 'any' || c.def.type === type),
  run: (g, p) => g.searchDiscard(p, type),
  ai: 18,
});

const drawPlay = (type, label) => ({
  text: type === 'any'
    ? 'DRAW a card. You may play it immediately.'
    : `DRAW a card. If it is ${label}, you may play it immediately.`,
  run: (g, p) => g.drawAndMaybePlay(p, type),
  ai: 17,
});

async function pullFrom(g, p, n, playHero) {
  const q = await g.pickPlayer(p, 'player', `Pull ${n > 1 ? n + ' cards' : 'a card'} from whose hand?`, q => q.hand.length > 0);
  if (!q) return;
  const got = g.pull(p, q, n);
  if (playHero) {
    for (const c of got) {
      if (c.def.type === 'hero' && await g.confirm(p, `You pulled ${c.def.name}. Play it immediately?`, c)) {
        await g.playCard(p, c, { free: true });
      }
    }
  }
}

async function lookAt(g, p, take) {
  const q = await g.pickPlayer(p, 'player', "Look at whose hand?", q => q.hand.length > 0);
  if (!q) return;
  const o = await g.choose(p, {
    kind: take ? 'take' : 'lookDiscard',
    title: `${q.name}'s hand`,
    text: take ? 'Take one card.' : 'Choose a card for them to DISCARD.',
    options: q.hand.map(card => ({ card, label: card.def.name })),
  });
  if (!o) return;
  g.removeFromHand(q, o.card);
  if (take) {
    p.hand.push(o.card);
    g.log(`${p.name} looks at ${q.name}'s hand and takes ${p.isHuman || q.isHuman ? o.card.def.name : 'a card'}.`);
  } else {
    g.toDiscard(o.card);
    g.log(`${p.name} looks at ${q.name}'s hand and discards ${o.card.def.name}.`);
  }
}

async function eachOtherDiscards(g, p, n) {
  for (const q of g.others(p)) await g.forceDiscard(q, n, `${p.name}'s effect: DISCARD ${n > 1 ? n + ' cards' : 'a card'}`);
}

export const EFFECTS = {
  draw1: { text: 'DRAW a card.', run: async (g, p) => g.draw(p, 1), ai: 14 },
  draw2: { text: 'DRAW 2 cards.', run: async (g, p) => g.draw(p, 2), ai: 22 },
  draw1ap: {
    text: 'DRAW a card and gain 1 action point.',
    run: async (g, p) => { g.draw(p, 1); g.gainAP(p, 1); },
    ai: 24,
  },
  draw2ap: {
    text: 'DRAW 2 cards and gain 1 action point.',
    run: async (g, p) => { g.draw(p, 2); g.gainAP(p, 1); },
    ai: 28,
  },
  drawDiscard3: {
    text: 'DRAW 3 cards, then DISCARD a card.',
    run: async (g, p) => { g.draw(p, 3); await g.forceDiscard(p, 1, 'DISCARD a card'); },
    ai: 24,
  },

  destroyHero: { text: 'DESTROY a Hero card.', canUse: anyOppHero, run: (g, p) => g.doDestroy(p), ai: 32 },
  destroyDraw: {
    text: 'DESTROY a Hero card, then DRAW a card.',
    canUse: anyOppHero,
    run: async (g, p) => { await g.doDestroy(p); g.draw(p, 1); },
  },
  destroy2: {
    text: 'DESTROY up to 2 Hero cards.',
    canUse: anyOppHero,
    run: async (g, p) => { await g.doDestroy(p); await g.doDestroy(p); },
  },
  discardDestroy: {
    text: 'DISCARD a card, then DESTROY a Hero card.',
    canUse: (g, p) => anyOppHero(g, p) && p.hand.length > 0,
    run: async (g, p) => { await g.forceDiscard(p, 1, 'DISCARD a card'); await g.doDestroy(p); },
    ai: 26,
  },
  destroyEachDiscard: {
    text: 'DESTROY a Hero card. Each other player must DISCARD a card.',
    run: async (g, p) => { await g.doDestroy(p); await eachOtherDiscards(g, p, 1); },
  },
  removeItemDraw: {
    text: 'Move an equipped Item card to the discard pile, then DRAW a card.',
    run: async (g, p) => {
      const o = await g.pickEquipped(p, 'removeItem', 'Choose an equipped Item to discard');
      if (o) g.discardItem(o.owner, o.hero);
      g.draw(p, 1);
    },
  },

  stealHero: { text: 'STEAL a Hero card.', canUse: anyOppHero, run: (g, p) => g.doSteal(p), ai: 34 },
  stealDraw: {
    text: 'STEAL a Hero card, then DRAW a card.',
    canUse: anyOppHero,
    run: async (g, p) => { await g.doSteal(p); g.draw(p, 1); },
  },
  stealPull: {
    text: "STEAL a Hero card, then pull a card from that player's hand.",
    canUse: anyOppHero,
    run: async (g, p) => {
      const o = await g.doSteal(p);
      if (o) g.pull(p, o.owner, 1);
    },
  },
  discard2steal: {
    text: 'DISCARD 2 cards, then STEAL a Hero card.',
    canUse: (g, p) => anyOppHero(g, p) && p.hand.length >= 3,
    run: async (g, p) => { await g.forceDiscard(p, 2, 'DISCARD a card'); await g.doSteal(p); },
    ai: 26,
  },

  pull1: { text: "Pull a card from another player's hand.", canUse: anyOppHand, run: (g, p) => pullFrom(g, p, 1) },
  pull2: { text: "Pull 2 cards from another player's hand.", canUse: anyOppHand, run: (g, p) => pullFrom(g, p, 2) },
  pullPlayHero: {
    text: "Pull a card from another player's hand. If it is a Hero card, you may play it immediately.",
    canUse: anyOppHand,
    run: (g, p) => pullFrom(g, p, 1, true),
  },
  pullEach: {
    text: "Pull a card from each other player's hand.",
    canUse: anyOppHand,
    run: async (g, p) => { for (const q of g.others(p)) g.pull(p, q, 1); },
    ai: 24,
  },
  lookTake: { text: "Look at another player's hand and take a card from it.", canUse: anyOppHand, run: (g, p) => lookAt(g, p, true) },
  lookDiscard: {
    text: "Look at another player's hand and DISCARD a card of your choice from it.",
    canUse: anyOppHand,
    run: (g, p) => lookAt(g, p, false),
  },
  eachDiscard1: { text: 'Each other player must DISCARD a card.', canUse: anyOppHand, run: (g, p) => eachOtherDiscards(g, p, 1), ai: 16 },
  playerDiscard2: {
    text: 'Choose a player. That player must DISCARD 2 cards.',
    canUse: anyOppHand,
    run: async (g, p) => {
      const q = await g.pickPlayer(p, 'player', 'Who must DISCARD 2 cards?', q => q.hand.length > 0);
      if (q) await g.forceDiscard(q, 2, `${p.name}'s effect: DISCARD a card`);
    },
  },
  giveCard: {
    text: 'Each other player must give you a card from their hand.',
    canUse: anyOppHand,
    run: async (g, p) => {
      for (const q of g.others(p)) {
        if (!q.hand.length) continue;
        const o = await g.choose(q, {
          kind: 'give', title: `Give a card to ${p.name}`,
          options: q.hand.map(card => ({ card, label: card.def.name })),
        });
        g.removeFromHand(q, o.card);
        p.hand.push(o.card);
        g.log(`${q.name} gives ${p.isHuman || q.isHuman ? o.card.def.name : 'a card'} to ${p.name}.`);
      }
    },
  },
  returnHero: {
    text: "Return a Hero card in another player's Party to their hand.",
    canUse: anyOppHero,
    run: async (g, p) => {
      const o = await g.pickOpponentHero(p, 'return', "Choose a Hero to return to its owner's hand");
      if (o) g.returnToHand(o.owner, o.hero);
    },
  },

  returnItemDraw: {
    text: "Return an equipped Item card to the hand of the player whose Party it's in, then DRAW a card.",
    run: async (g, p) => {
      const o = await g.pickEquipped(p, 'removeItem', 'Choose an equipped Item to return');
      if (o) g.returnItem(o.owner, o.hero);
      g.draw(p, 1);
    },
    ai: 15,
  },
  returnAllItems: {
    text: "Return every equipped Item card to the hand of the player whose Party it's in.",
    canUse: (g, p) => g.players.some(q => q.party.some(h => h.item && (q === p) === !!h.item.def.cursed)),
    run: async g => {
      for (const q of g.players) for (const h of q.party) if (h.item) g.returnItem(q, h);
    },
    ai: 12,
  },
  battleHymn: {
    text: '+2 to all of your rolls until the end of your turn.',
    run: async (g, p) => { p.turnBonus += 2; g.log(`${p.name} gets +2 to all rolls this turn.`); },
    ai: 6,
  },

  searchHero: search('hero', 'a Hero card'),
  searchItem: search('item', 'an Item card'),
  searchMagic: search('magic', 'a Magic card'),
  searchModifier: search('modifier', 'a Modifier card'),
  searchChallenge: search('challenge', 'a Challenge card'),
  searchAny: search('any', 'any card'),

  drawPlayHero: drawPlay('hero', 'a Hero card'),
  drawPlayMagic: drawPlay('magic', 'a Magic card'),
  drawPlayItem: drawPlay('item', 'an Item card'),
  drawPlayAny: drawPlay('any'),
};
