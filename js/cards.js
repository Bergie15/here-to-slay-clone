import { EFFECTS } from './effects.js';

export const CLASSES = {
  fighter:  { name: 'Fighter',  color: '#b8323f', icon: '⚔️' },
  guardian: { name: 'Guardian', color: '#c9930e', icon: '🛡️' },
  ranger:   { name: 'Ranger',   color: '#2f7a4f', icon: '🏹' },
  thief:    { name: 'Thief',    color: '#2d55a8', icon: '🗝️' },
  wizard:   { name: 'Wizard',   color: '#7e3fb0', icon: '🔮' },
  bard:     { name: 'Bard',     color: '#d9612f', icon: '🎵' },
};
export const CLASS_KEYS = Object.keys(CLASSES);

// [name, class, roll requirement, effect key, art]
const HERO_LIST = [
  ['Bonebreaker Bear', 'fighter', 8, 'destroyHero', '🐻'],
  ['Tusk the Brawler', 'fighter', 7, 'playerDiscard2', '🐘'],
  ['Rampaging Rhino', 'fighter', 9, 'destroyDraw', '🦏'],
  ['Iron Hoof', 'fighter', 6, 'discardDestroy', '🐴'],
  ['Battle Badger', 'fighter', 7, 'returnHero', '🦡'],
  ['Wolfgang Warpaw', 'fighter', 6, 'drawPlayHero', '🐺'],
  ['Crimson Crusher', 'fighter', 10, 'destroy2', '🦍'],
  ['Shieldsplitter Shrew', 'fighter', 6, 'removeItemDraw', '🐭'],

  ['Steadfast Tortoise', 'guardian', 6, 'searchItem', '🐢'],
  ['Gallant Rooster', 'guardian', 7, 'searchHero', '🐓'],
  ['Paladin Pug', 'guardian', 8, 'draw2', '🐶'],
  ['Bastion Bison', 'guardian', 5, 'searchChallenge', '🦬'],
  ['Holy Hedgehog', 'guardian', 7, 'drawPlayItem', '🦔'],
  ['Warden Walrus', 'guardian', 9, 'searchAny', '🦭'],
  ['Golden Gazelle', 'guardian', 6, 'draw1ap', '🦌'],
  ['Lionheart Lamb', 'guardian', 8, 'giveCard', '🐑'],

  ['Hawkeye Hare', 'ranger', 9, 'stealHero', '🐇'],
  ['Fletcher Fox', 'ranger', 6, 'pull1', '🦊'],
  ['Quickshot Quail', 'ranger', 8, 'lookTake', '🐦'],
  ['Pathfinder Puma', 'ranger', 5, 'draw1', '🐆'],
  ['Trapper Toad', 'ranger', 7, 'eachDiscard1', '🐸'],
  ['Longbow Lynx', 'ranger', 10, 'stealDraw', '🐈'],
  ['Mossy Ox', 'ranger', 6, 'searchModifier', '🐂'],
  ['Acorn Archer', 'ranger', 7, 'returnHero', '🐿️'],

  ['Sly Raccoon', 'thief', 6, 'pull1', '🦝'],
  ['Pickpocket Possum', 'thief', 8, 'pull2', '🐀'],
  ['Shadow Otter', 'thief', 8, 'stealHero', '🦦'],
  ['Masked Mink', 'thief', 7, 'pullPlayHero', '🐾'],
  ['Cutpurse Cat', 'thief', 9, 'lookTake', '🐱'],
  ['Burglar Bat', 'thief', 6, 'lookDiscard', '🦇'],
  ['Silent Skunk', 'thief', 10, 'stealPull', '🦨'],
  ['Nimble Newt', 'thief', 7, 'draw2', '🦎'],

  ['Arcane Owl', 'wizard', 7, 'drawPlayMagic', '🦉'],
  ['Hex Hamster', 'wizard', 6, 'searchMagic', '🐹'],
  ['Mystic Moth', 'wizard', 8, 'drawDiscard3', '🦋'],
  ['Sparkle Snail', 'wizard', 5, 'draw1', '🐌'],
  ['Pyro Penguin', 'wizard', 9, 'destroyHero', '🐧'],
  ['Glimmer Goat', 'wizard', 7, 'eachDiscard1', '🐐'],
  ['Stormcaller Parrot', 'wizard', 10, 'destroyEachDiscard', '🦜'],
  ['Moonlit Mouse', 'wizard', 8, 'drawPlayAny', '🐁'],

  ['Melody Monkey', 'bard', 6, 'giveCard', '🐒'],
  ['Ballad Beaver', 'bard', 7, 'eachDiscard1', '🦫'],
  ['Harmony Hound', 'bard', 5, 'draw1ap', '🐕'],
  ['Jester Jay', 'bard', 8, 'pull2', '🐤'],
  ['Serenade Swan', 'bard', 8, 'lookTake', '🦢'],
  ['Troubadour Turkey', 'bard', 6, 'drawPlayHero', '🦃'],
  ['Rhapsody Koala', 'bard', 9, 'stealHero', '🐨'],
  ['Encore Panda', 'bard', 9, 'draw2ap', '🐼'],
];

export const HEROES = HERO_LIST.map(([name, cls, req, effect, art]) => ({
  type: 'hero', name, cls, req, effect, art, text: EFFECTS[effect].text,
}));

// [count, def]
const ITEM_LIST = [
  [2, { name: 'Lucky Clover', art: '🍀', kind: 'bonus', value: 1, text: "+1 to this Hero's effect rolls." }],
  [1, { name: 'Enchanted Ring', art: '💍', kind: 'bonus', value: 2, text: "+2 to this Hero's effect rolls." }],
  [2, { name: 'Decoy Doll', art: '🧸', kind: 'decoy', text: 'If this Hero would be DESTROYED, move this Item to the discard pile instead.' }],
  ...Object.entries(CLASSES).map(([cls, c]) => [1, {
    name: `${c.name} Mask`, art: '🎭', kind: 'mask', cls, text: `This Hero counts as a ${c.name} instead of its original class.`,
  }]),
  [2, { name: 'Rusty Shackles', art: '⛓️', kind: 'shackles', cursed: true, text: "Cursed. −2 to this Hero's effect rolls." }],
  [1, { name: 'Hollow Crown', art: '👑', kind: 'hollow', cursed: true, text: "Cursed. This Hero has no class: it doesn't count toward a full Party or class requirements." }],
  [1, { name: 'Sealing Rune', art: '🔒', kind: 'seal', cursed: true, text: "Cursed. This Hero's effect cannot be used." }],
];

const MAGIC_LIST = [
  [2, 'Fireball', '🔥', 'destroyHero'],
  [2, 'Entangling Vines', '🌿', 'discard2steal'],
  [2, 'Treasure Trove', '💰', 'draw2'],
  [1, 'Critical Insight', '📜', 'drawDiscard3'],
  [2, 'Winds of Change', '🌪️', 'returnItemDraw'],
  [1, 'Gale Force', '💨', 'returnAllItems'],
  [1, 'Call the Fallen', '⚰️', 'searchHero'],
  [1, 'Destructive Spell', '💥', 'discardDestroy'],
  [1, 'Battle Hymn', '📯', 'battleHymn'],
  [1, 'Beast Call', '📣', 'pullEach'],
  [1, 'Mass Panic', '😱', 'eachDiscard1'],
  [1, 'Second Wind', '🌬️', 'draw1ap'],
];

const MODIFIER_LIST = [
  [2, [4]], [2, [-4]], [4, [3, -1]], [4, [1, -3]], [8, [2, -2]],
];

export function buildMainDeck() {
  const deck = [];
  for (const h of HEROES) deck.push(h);
  for (const [n, d] of ITEM_LIST) for (let i = 0; i < n; i++) deck.push({ type: 'item', ...d });
  for (const [n, name, art, effect] of MAGIC_LIST) {
    for (let i = 0; i < n; i++) deck.push({ type: 'magic', name, art, effect, text: EFFECTS[effect].text });
  }
  for (const [n, options] of MODIFIER_LIST) {
    for (let i = 0; i < n; i++) {
      deck.push({
        type: 'modifier', name: 'Modifier', art: '🧪', options,
        text: 'Play on any roll: ' + options.map(fmtMod).join(' or ') + '.',
      });
    }
  }
  for (let i = 0; i < 12; i++) {
    deck.push({ type: 'challenge', name: 'Challenge', art: '⚡', text: 'Play when another player plays a Hero, Item, or Magic card to CHALLENGE it.' });
  }
  return deck;
}

export const fmtMod = v => (v > 0 ? '+' : '−') + Math.abs(v);

export const SKILLS = {
  heroRoll1: '+1 to all your rolls to use a Hero effect.',
  attack1: '+1 to all your rolls to ATTACK a Monster.',
  challenge2: '+2 to your rolls whenever you CHALLENGE or are CHALLENGED.',
  startDraw: 'At the start of your turn, DRAW a card.',
  magicDraw: 'Each time you play a Magic card, DRAW a card.',
  modifierDraw: 'Each time you play a Modifier card, DRAW a card.',
  challengeDraw: 'Each time you play a Challenge card, DRAW a card.',
  itemDraw: 'Each time you play an Item card, DRAW a card.',
  heroPlayDraw: 'Each time you play a Hero card, DRAW a card.',
  extraAP: 'You get 1 extra action point on each of your turns.',
  destroyProof: 'Hero cards in your Party cannot be DESTROYED.',
  lossDraw: 'Each time a Hero in your Party is DESTROYED or STOLEN, DRAW a card.',
  lossDraw2: 'Each time a Hero in your Party is DESTROYED or STOLEN, DRAW 2 cards.',
  failDraw: 'Each time you fail a roll to use a Hero effect, DRAW a card.',
};

export const LEADERS = [
  { name: 'The Iron Paw', cls: 'fighter', skill: 'challenge2', art: '🐯' },
  { name: 'The Stalwart Shell', cls: 'guardian', skill: 'lossDraw2', art: '🐢' },
  { name: 'The Keen Eye', cls: 'ranger', skill: 'attack1', art: '🦅' },
  { name: 'The Shadow Tail', cls: 'thief', skill: 'failDraw', art: '🦝' },
  { name: 'The Hooded Sage', cls: 'wizard', skill: 'magicDraw', art: '🐰' },
  { name: 'The Charming Muse', cls: 'bard', skill: 'heroRoll1', art: '🦊' },
].map(l => ({ ...l, text: SKILLS[l.skill] }));

export const PENALTIES = {
  discard1: { text: 'DISCARD a card', kind: 'discard', n: 1 },
  discard2: { text: 'DISCARD 2 cards', kind: 'discard', n: 2 },
  sacrifice1: { text: 'SACRIFICE a Hero card', kind: 'sacrifice', n: 1 },
  sacrifice2: { text: 'SACRIFICE 2 Hero cards', kind: 'sacrifice', n: 2 },
};

// req: class keys or 'any'. slay: roll needed. fail: roll at or below this triggers the penalty.
export const MONSTERS = [
  { name: 'Shadowmaw', art: '🐺', req: ['any', 'any', 'any'], slay: 8, fail: 4, penalty: 'discard2', skill: 'heroRoll1' },
  { name: 'Bog Troll', art: '👹', req: ['fighter', 'any'], slay: 8, fail: 5, penalty: 'sacrifice1', skill: 'attack1' },
  { name: 'Frost Wyrm', art: '🐉', req: ['wizard', 'any'], slay: 9, fail: 6, penalty: 'sacrifice1', skill: 'magicDraw' },
  { name: 'Thornback Boar', art: '🐗', req: ['ranger', 'any'], slay: 8, fail: 4, penalty: 'discard2', skill: 'attack1' },
  { name: 'Many-Headed Hydra', art: '🐍', req: ['any', 'any', 'any', 'any'], slay: 9, fail: 5, penalty: 'sacrifice1', skill: 'extraAP' },
  { name: 'Rumbling Golem', art: '🗿', req: ['guardian', 'any'], slay: 8, fail: 5, penalty: 'discard2', skill: 'challenge2' },
  { name: 'Night Terror', art: '🦇', req: ['thief', 'any'], slay: 8, fail: 4, penalty: 'sacrifice1', skill: 'startDraw' },
  { name: 'Wailing Siren', art: '🧜', req: ['bard', 'any'], slay: 8, fail: 5, penalty: 'discard2', skill: 'modifierDraw' },
  { name: 'Treasure Mimic', art: '📦', req: ['any', 'any'], slay: 10, fail: 6, penalty: 'discard1', skill: 'itemDraw' },
  { name: 'Dread Lich', art: '💀', req: ['wizard', 'any', 'any'], slay: 10, fail: 6, penalty: 'sacrifice2', skill: 'heroPlayDraw' },
  { name: 'Manticore', art: '🦁', req: ['fighter', 'ranger'], slay: 9, fail: 5, penalty: 'sacrifice1', skill: 'startDraw' },
  { name: 'Titan Crab', art: '🦀', req: ['guardian', 'any', 'any'], slay: 9, fail: 6, penalty: 'discard2', skill: 'heroRoll1' },
  { name: 'Hollow Wraith', art: '👻', req: ['thief', 'bard'], slay: 9, fail: 5, penalty: 'discard2', skill: 'challengeDraw' },
  { name: 'Stone Basilisk', art: '🦎', req: ['any', 'any', 'any'], slay: 10, fail: 6, penalty: 'sacrifice1', skill: 'destroyProof' },
  { name: 'Storm Gryphon', art: '🦅', req: ['any', 'any'], slay: 9, fail: 5, penalty: 'sacrifice1', skill: 'lossDraw' },
].map(m => ({ ...m, skillText: SKILLS[m.skill], penaltyText: PENALTIES[m.penalty].text }));
