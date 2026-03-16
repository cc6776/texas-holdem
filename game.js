// ============== Card & Deck ==============
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const SUIT_COLORS = { hearts: '#e74c3c', diamonds: '#e74c3c', clubs: '#2c3e50', spades: '#2c3e50' };
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

function createDeck() {
  const deck = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank });
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function rankValue(rank) {
  const vals = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
  return vals[rank];
}

// ============== Hand Evaluation ==============
const HAND_NAMES = {
  9: 'Royal Flush / 皇家同花顺',
  8: 'Straight Flush / 同花顺',
  7: 'Four of a Kind / 四条',
  6: 'Full House / 葫芦',
  5: 'Flush / 同花',
  4: 'Straight / 顺子',
  3: 'Three of a Kind / 三条',
  2: 'Two Pair / 两对',
  1: 'One Pair / 一对',
  0: 'High Card / 高牌'
};

function evaluateHand(cards) {
  // Get best 5-card hand from 7 cards
  const combos = getCombinations(cards, 5);
  let best = null;
  for (const combo of combos) {
    const score = scoreHand(combo);
    if (!best || compareScores(score, best) > 0) best = score;
  }
  return best;
}

function getCombinations(arr, k) {
  const results = [];
  function combine(start, combo) {
    if (combo.length === k) { results.push([...combo]); return; }
    for (let i = start; i < arr.length; i++) { combo.push(arr[i]); combine(i + 1, combo); combo.pop(); }
  }
  combine(0, []);
  return results;
}

function scoreHand(five) {
  const vals = five.map(c => rankValue(c.rank)).sort((a, b) => b - a);
  const suits = five.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);

  // Check straight
  let isStraight = false;
  let straightHigh = 0;
  const unique = [...new Set(vals)].sort((a, b) => b - a);
  if (unique.length === 5 && unique[0] - unique[4] === 4) { isStraight = true; straightHigh = unique[0]; }
  // Ace-low straight (A-2-3-4-5)
  if (unique.length === 5 && unique[0] === 14 && unique[1] === 5 && unique[4] === 2) { isStraight = true; straightHigh = 5; }

  // Count ranks
  const counts = {};
  for (const v of vals) counts[v] = (counts[v] || 0) + 1;
  const groups = Object.entries(counts).map(([v, c]) => ({ val: +v, count: c }));
  groups.sort((a, b) => b.count - a.count || b.val - a.val);

  if (isFlush && isStraight && straightHigh === 14) return { rank: 9, kickers: [14], cards: five };
  if (isFlush && isStraight) return { rank: 8, kickers: [straightHigh], cards: five };
  if (groups[0].count === 4) return { rank: 7, kickers: [groups[0].val, groups[1].val], cards: five };
  if (groups[0].count === 3 && groups[1].count === 2) return { rank: 6, kickers: [groups[0].val, groups[1].val], cards: five };
  if (isFlush) return { rank: 5, kickers: vals, cards: five };
  if (isStraight) return { rank: 4, kickers: [straightHigh], cards: five };
  if (groups[0].count === 3) return { rank: 3, kickers: [groups[0].val, ...groups.slice(1).map(g => g.val)], cards: five };
  if (groups[0].count === 2 && groups[1].count === 2) return { rank: 2, kickers: [Math.max(groups[0].val, groups[1].val), Math.min(groups[0].val, groups[1].val), groups[2].val], cards: five };
  if (groups[0].count === 2) return { rank: 1, kickers: [groups[0].val, ...groups.slice(1).map(g => g.val)], cards: five };
  return { rank: 0, kickers: vals, cards: five };
}

function compareScores(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
    if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
  }
  return 0;
}

// ============== AI Strategy ==============
function aiDecision(player, gameState) {
  const { communityCards, currentBet, pot, phase } = gameState;
  const allCards = [...player.hand, ...communityCards];
  const handScore = communityCards.length >= 3 ? evaluateHand(allCards) : quickEval(player.hand);
  const toCall = currentBet - player.bet;
  const potOdds = toCall / (pot + toCall || 1);

  // Personality affects play
  const aggression = player.personality || 0.5;
  const handStrength = getHandStrength(handScore, phase);

  if (toCall === 0) {
    if (handStrength > 0.7 && Math.random() < aggression) {
      const raiseAmt = Math.min(Math.floor(pot * (0.5 + Math.random())), player.chips);
      return { action: 'raise', amount: Math.max(raiseAmt, gameState.bigBlind) };
    }
    return { action: 'check' };
  }

  if (handStrength < 0.2 && toCall > pot * 0.3) return { action: 'fold' };
  if (handStrength < 0.35 && toCall > player.chips * 0.2) return { action: 'fold' };

  if (handStrength > 0.75 && Math.random() < aggression) {
    const raiseAmt = Math.min(Math.floor(pot * (0.5 + Math.random() * 0.5)), player.chips);
    return { action: 'raise', amount: Math.max(raiseAmt, toCall + gameState.bigBlind) };
  }

  if (toCall <= player.chips) return { action: 'call' };
  return { action: 'fold' };
}

function quickEval(hand) {
  const v1 = rankValue(hand[0].rank), v2 = rankValue(hand[1].rank);
  const paired = v1 === v2;
  const suited = hand[0].suit === hand[1].suit;
  const high = Math.max(v1, v2);
  let strength = (v1 + v2) / 28;
  if (paired) strength += 0.3;
  if (suited) strength += 0.05;
  if (high >= 12) strength += 0.1;
  return { rank: Math.min(Math.floor(strength * 4), 5), kickers: [high] };
}

function getHandStrength(score, phase) {
  const base = score.rank / 9;
  if (phase === 'preflop') return Math.min(base + 0.3, 1);
  return base + (score.kickers[0] || 0) / 140;
}

// ============== Game State ==============
class TexasHoldem {
  constructor() {
    this.players = [];
    this.deck = [];
    this.communityCards = [];
    this.pot = 0;
    this.sidePots = [];
    this.currentBet = 0;
    this.phase = 'idle';
    this.dealerIndex = 0;
    this.activePlayerIndex = 0;
    this.smallBlind = 10;
    this.bigBlind = 20;
    this.handNumber = 0;
    this.lastAction = '';
    this.roundComplete = false;
    this.initPlayers();
  }

  initPlayers() {
    this.players = [
      { name: 'You / 你', chips: 1000, hand: [], bet: 0, folded: false, isHuman: true, allIn: false },
      { name: 'Alice (AI)', chips: 1000, hand: [], bet: 0, folded: false, isHuman: false, allIn: false, personality: 0.6 },
      { name: 'Bob (AI)', chips: 1000, hand: [], bet: 0, folded: false, isHuman: false, allIn: false, personality: 0.4 },
      { name: 'Charlie (AI)', chips: 1000, hand: [], bet: 0, folded: false, isHuman: false, allIn: false, personality: 0.7 },
    ];
  }

  startHand() {
    this.handNumber++;
    this.deck = shuffle(createDeck());
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.phase = 'preflop';
    this.lastAction = '';
    this.roundComplete = false;

    // Reset players
    for (const p of this.players) {
      p.hand = [];
      p.bet = 0;
      p.folded = false;
      p.allIn = false;
      p.hasActed = false;
      if (p.chips <= 0) { p.folded = true; p.chips = 0; }
    }

    // Move dealer
    do { this.dealerIndex = (this.dealerIndex + 1) % this.players.length; }
    while (this.players[this.dealerIndex].folded);

    // Deal cards
    for (let round = 0; round < 2; round++) {
      for (const p of this.players) {
        if (!p.folded) p.hand.push(this.deck.pop());
      }
    }

    // Post blinds
    this.sbIndex = this.nextActive(this.dealerIndex);
    this.bbIndex = this.nextActive(this.sbIndex);
    this.postBlind(this.sbIndex, this.smallBlind);
    this.postBlind(this.bbIndex, this.bigBlind);
    this.currentBet = this.bigBlind;
    this.activePlayerIndex = this.nextActive(this.bbIndex);

    return this.checkForHumanTurn();
  }

  postBlind(idx, amount) {
    const p = this.players[idx];
    const actual = Math.min(amount, p.chips);
    p.chips -= actual;
    p.bet = actual;
    this.pot += actual;
    if (p.chips === 0) p.allIn = true;
  }

  nextActive(from) {
    let idx = (from + 1) % this.players.length;
    while (this.players[idx].folded || this.players[idx].allIn) {
      idx = (idx + 1) % this.players.length;
      if (idx === from) return from;
    }
    return idx;
  }

  activePlayers() { return this.players.filter(p => !p.folded); }
  actingPlayers() { return this.players.filter(p => !p.folded && !p.allIn); }

  doAction(action, amount = 0) {
    const p = this.players[this.activePlayerIndex];
    const toCall = this.currentBet - p.bet;
    p.hasActed = true;

    switch (action) {
      case 'fold':
        p.folded = true;
        this.lastAction = `${p.name} Fold`;
        break;
      case 'check':
        this.lastAction = `${p.name} Check`;
        break;
      case 'call':
        const callAmt = Math.min(toCall, p.chips);
        p.chips -= callAmt;
        p.bet += callAmt;
        this.pot += callAmt;
        if (p.chips === 0) p.allIn = true;
        this.lastAction = `${p.name} Call ${callAmt}`;
        break;
      case 'raise':
        const raiseTotal = Math.min(amount, p.chips + p.bet);
        const raiseCost = raiseTotal - p.bet;
        p.chips -= raiseCost;
        this.pot += raiseCost;
        p.bet = raiseTotal;
        this.currentBet = raiseTotal;
        if (p.chips === 0) p.allIn = true;
        this.lastAction = `${p.name} Raise to ${raiseTotal}`;
        // Others need to respond to the raise
        for (const other of this.players) { if (other !== p) other.hasActed = false; }
        p.hasActed = true;
        break;
      case 'allin':
        const allAmt = p.chips;
        p.bet += allAmt;
        this.pot += allAmt;
        p.chips = 0;
        p.allIn = true;
        if (p.bet > this.currentBet) {
          this.currentBet = p.bet;
          for (const other of this.players) { if (other !== p) other.hasActed = false; }
          p.hasActed = true;
        }
        this.lastAction = `${p.name} All-In! (${allAmt})`;
        break;
    }

    // Check if hand is over (only 1 player left)
    if (this.activePlayers().length === 1) {
      return this.endHand();
    }

    // Check if betting round is over
    if (this.isBettingRoundOver()) {
      return this.nextPhase();
    }

    this.activePlayerIndex = this.nextActive(this.activePlayerIndex);
    return this.checkForHumanTurn();
  }

  isBettingRoundOver() {
    const acting = this.actingPlayers();
    if (acting.length <= 1) return true;

    // Round is over only when ALL acting players have acted AND all bets match
    const allActed = acting.every(p => p.hasActed);
    const allMatched = acting.every(p => p.bet === this.currentBet);

    return allActed && allMatched;
  }

  nextPhase() {
    // Reset bets and action flags for new round
    for (const p of this.players) { p.bet = 0; p.hasActed = false; }
    this.currentBet = 0;

    switch (this.phase) {
      case 'preflop':
        this.phase = 'flop';
        this.communityCards.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
        break;
      case 'flop':
        this.phase = 'turn';
        this.communityCards.push(this.deck.pop());
        break;
      case 'turn':
        this.phase = 'river';
        this.communityCards.push(this.deck.pop());
        break;
      case 'river':
        return this.showdown();
    }

    // If only 1 or fewer players can act, no betting needed
    if (this.actingPlayers().length <= 1) {
      if (this.phase === 'river' || this.communityCards.length === 5) {
        return { status: 'auto_deal_done' };
      }
      return { status: 'auto_deal_next' };
    }

    this.activePlayerIndex = this.nextActive(this.dealerIndex);
    return this.checkForHumanTurn();
  }

  checkForHumanTurn() {
    const p = this.players[this.activePlayerIndex];
    if (p.isHuman) return { status: 'human_turn', player: p };
    return { status: 'ai_turn', player: p };
  }

  runAI() {
    const p = this.players[this.activePlayerIndex];
    const decision = aiDecision(p, {
      communityCards: this.communityCards,
      currentBet: this.currentBet,
      pot: this.pot,
      phase: this.phase,
      bigBlind: this.bigBlind
    });
    return this.doAction(decision.action, decision.amount);
  }

  showdown() {
    this.phase = 'showdown';
    // Deal remaining community cards if needed
    while (this.communityCards.length < 5) this.communityCards.push(this.deck.pop());

    const active = this.activePlayers();
    const results = [];
    for (const p of active) {
      const allCards = [...p.hand, ...this.communityCards];
      const best = evaluateHand(allCards);
      results.push({ player: p, score: best });
    }
    results.sort((a, b) => compareScores(b.score, a.score));

    // Find winners (could be ties)
    const winners = [results[0]];
    for (let i = 1; i < results.length; i++) {
      if (compareScores(results[i].score, results[0].score) === 0) winners.push(results[i]);
      else break;
    }

    const share = Math.floor(this.pot / winners.length);
    for (const w of winners) w.player.chips += share;
    // Remainder to first winner
    winners[0].player.chips += this.pot - share * winners.length;

    return { status: 'showdown', results, winners, pot: this.pot };
  }

  endHand() {
    this.phase = 'ended';
    const winner = this.activePlayers()[0];
    winner.chips += this.pot;
    return { status: 'hand_over', winner, pot: this.pot };
  }

  getPlayerHandInfo(playerIndex) {
    const p = this.players[playerIndex];
    if (p.hand.length === 0) return null;
    if (this.communityCards.length >= 3) {
      const all = [...p.hand, ...this.communityCards];
      const best = evaluateHand(all);
      return { handName: HAND_NAMES[best.rank], rank: best.rank, bestCards: best.cards };
    }
    return { handName: 'Preflop / 翻牌前', rank: -1, bestCards: p.hand };
  }

  getValidActions() {
    const p = this.players[this.activePlayerIndex];
    const toCall = this.currentBet - p.bet;
    const actions = ['fold'];
    if (toCall === 0) actions.push('check');
    if (toCall > 0 && toCall <= p.chips) actions.push('call');
    if (p.chips > toCall) actions.push('raise');
    actions.push('allin');
    return { actions, toCall, minRaise: this.currentBet + this.bigBlind };
  }
}
