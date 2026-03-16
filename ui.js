const game = new TexasHoldem();
let logs = [];
let tutorialMode = false;
let tutorialStep = 0;

// ============== Tutorial System ==============
const TUTORIAL_TIPS = {
  'deal': {
    title: '发牌了！',
    text: '你拿到了 2 张底牌（只有你能看到）。其他人的牌是背面朝上的。现在看看你的牌，准备做决定！',
    arrow: 'bottom'
  },
  'preflop_action': {
    title: '轮到你了！',
    text: '现在是"翻牌前"，桌上还没有公共牌。你需要根据手里的 2 张牌做决定。',
    extra: null // will be set dynamically
  },
  'flop': {
    title: '翻牌 (Flop)！',
    text: '桌上翻出了 3 张公共牌！现在用你的 2 张底牌 + 这 3 张公共牌，看看能组成什么牌型。左下角会自动告诉你。',
  },
  'turn': {
    title: '转牌 (Turn)！',
    text: '又多了 1 张公共牌！你的牌型可能变强了，看看左下角的提示。',
  },
  'river': {
    title: '河牌 (River)！',
    text: '最后一张公共牌！这是最后的机会了。之后就要摊牌比大小。',
  },
  'showdown': {
    title: '摊牌！',
    text: '大家亮牌，比谁的 5 张牌组合最大。牌型大的赢走全部筹码（Pot）。',
  }
};

function getActionAdvice() {
  const info = game.getPlayerHandInfo(0);
  if (!info || info.rank < 0) {
    // Preflop - evaluate hole cards
    const hand = game.players[0].hand;
    if (hand.length < 2) return '看看你的牌再决定。';
    const v1 = rankValue(hand[0].rank), v2 = rankValue(hand[1].rank);
    const paired = v1 === v2;
    const high = Math.max(v1, v2);
    if (paired && high >= 10) return '你有大对子，牌很好！建议 Raise 加注。';
    if (paired) return '你有一对，还不错。可以 Call 跟注看看。';
    if (high >= 13 && Math.min(v1, v2) >= 10) return '两张大牌，挺好的。建议 Call 或 Raise。';
    if (high >= 12) return '有一张大牌，可以 Call 看看翻牌。';
    return '牌一般，可以 Call 看看，牌不好就 Fold 弃牌也行。';
  }
  if (info.rank >= 5) return '你的牌型很强！大胆 Raise 加注！';
  if (info.rank >= 3) return '不错的牌型！可以 Raise 或 Call。';
  if (info.rank >= 1) return '有一对/两对，还行。可以 Call 跟注。';
  return '只有高牌，牌不太好。考虑 Fold 弃牌或 Check 过牌。';
}

function showTutorialTip(key) {
  if (!tutorialMode) return;
  const tip = TUTORIAL_TIPS[key];
  if (!tip) return;

  let extraHTML = '';
  if (key === 'preflop_action' || key === 'flop' || key === 'turn' || key === 'river') {
    const advice = getActionAdvice();
    extraHTML = `<div style="background:rgba(78,205,196,0.15);border:1px solid rgba(78,205,196,0.3);border-radius:6px;padding:8px;margin-top:8px;">
      <span style="color:#4ecdc4;font-weight:bold;">AI 建议：</span> ${advice}
    </div>`;
  }

  const el = document.getElementById('tutorialTip');
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <span style="color:#ffd700;font-weight:bold;font-size:1em;">${tip.title}</span>
      <span style="color:#666;font-size:0.75em;">Tutorial ${tutorialStep}/5</span>
    </div>
    <p style="font-size:0.88em;color:#ddd;line-height:1.6;">${tip.text}</p>
    ${extraHTML}
  `;
  el.classList.remove('hidden');
}

function hideTutorialTip() {
  document.getElementById('tutorialTip').classList.add('hidden');
}

function toggleTutorial() {
  tutorialMode = !tutorialMode;
  const btn = document.getElementById('btnTutorial');
  btn.textContent = tutorialMode ? 'Tutorial ON' : 'Tutorial OFF';
  btn.style.background = tutorialMode ? 'rgba(78,205,196,0.2)' : 'rgba(255,255,255,0.1)';
  btn.style.borderColor = tutorialMode ? '#4ecdc4' : '#888';
  if (!tutorialMode) hideTutorialTip();
}

// ============== Core UI ==============
function log(msg) {
  logs.unshift(msg);
  if (logs.length > 30) logs.pop();
  document.getElementById('logContent').innerHTML = logs.map(l => `<div class="log-entry">${l}</div>`).join('');
}

function createCardHTML(card, facedown = false, mini = false) {
  if (facedown) return `<div class="card ${mini ? 'card-mini' : ''} facedown"></div>`;
  const color = (card.suit === 'hearts' || card.suit === 'diamonds') ? 'red' : 'black';
  return `<div class="card ${mini ? 'card-mini' : ''} ${color}">
    <span class="rank">${card.rank}</span>
    <span class="suit">${SUIT_SYMBOLS[card.suit]}</span>
  </div>`;
}

function renderPlayers() {
  game.players.forEach((p, i) => {
    const el = document.getElementById(`player${i}`);
    const isActive = i === game.activePlayerIndex && game.phase !== 'idle' && game.phase !== 'showdown' && game.phase !== 'ended';
    const showCards = p.isHuman || game.phase === 'showdown';

    let handHTML = '';
    if (p.hand.length > 0) {
      handHTML = `<div class="player-hand">
        ${showCards ? p.hand.map(c => createCardHTML(c, false, true)).join('') : p.hand.map(() => createCardHTML(null, true, true)).join('')}
      </div>`;
    }

    el.className = `player player-${i}${isActive ? ' active' : ''}${p.folded ? ' folded' : ''}`;
    el.innerHTML = `
      ${handHTML}
      <div class="player-info">
        <div class="player-name">${p.name}${i === game.dealerIndex ? ' D' : ''}</div>
        <div class="player-chips">筹码: ${p.chips}</div>
        ${p.bet > 0 ? `<div class="player-bet">下注: ${p.bet}</div>` : ''}
        <div class="player-action-label">${p.folded ? '已弃牌' : (p.allIn ? '全押!' : '')}</div>
      </div>`;
  });
}

function renderCommunity() {
  const el = document.getElementById('communityCards');
  el.innerHTML = game.communityCards.map(c => createCardHTML(c)).join('');
  document.getElementById('potDisplay').textContent = `奖池: ${game.pot}`;
  const phaseNames = { idle: '点击下方按钮开始', preflop: '翻牌前 (还没翻公共牌)', flop: '翻牌 (公共牌 3 张)', turn: '转牌 (公共牌 4 张)', river: '河牌 (公共牌 5 张)', showdown: '摊牌比大小', ended: '本局结束' };
  document.getElementById('phaseDisplay').textContent = phaseNames[game.phase] || game.phase.toUpperCase();
}

const HAND_EXPLANATIONS = {
  9: '你的 5 张牌是同花色的 A K Q J 10，最无敌的牌！',
  8: '你的 5 张牌是同花色且连续的，比如 ♥5 ♥6 ♥7 ♥8 ♥9',
  7: '你有 4 张一样大的牌！比如 4 个 K',
  6: '3 张一样 + 2 张一样，比如 3 个 J + 2 个 5',
  5: '你有 5 张同花色的牌（不需要连续）',
  4: '你有 5 张连续的牌（不需要同花色），比如 3 4 5 6 7',
  3: '你有 3 张一样大的牌，比如 3 个 Q',
  2: '你有 2 组对子，比如 2 个 A + 2 个 8',
  1: '你有 2 张一样大的牌，比如 2 个 K',
  0: '什么组合都没有，只能比最大的那张单牌',
  [-1]: '还没翻公共牌，先看看你的 2 张底牌'
};

function renderHandInfo() {
  const info = game.getPlayerHandInfo(0);
  const el = document.getElementById('currentHand');
  if (!info) { el.textContent = '-'; document.getElementById('handExplain').innerHTML = ''; return; }
  el.textContent = info.handName;

  // Show explanation
  const explainEl = document.getElementById('handExplain');
  const explanation = HAND_EXPLANATIONS[info.rank] || '';

  // Show which cards form the hand
  let cardsHTML = '';
  if (info.bestCards && info.rank >= 0) {
    cardsHTML = '<div style="display:flex;gap:3px;margin-top:6px;flex-wrap:wrap;">' +
      info.bestCards.map(c => {
        const color = (c.suit === 'hearts' || c.suit === 'diamonds') ? '#e74c3c' : '#2c3e50';
        return `<span style="background:#fff;color:${color};padding:2px 5px;border-radius:3px;font-weight:bold;font-size:0.8em;">${c.rank}${SUIT_SYMBOLS[c.suit]}</span>`;
      }).join('') + '</div>';
  }

  explainEl.innerHTML = `<div style="font-size:0.75em;color:#aaa;margin-top:4px;">${explanation}</div>${cardsHTML}`;

  document.querySelectorAll('.ref-row').forEach(row => {
    row.classList.toggle('highlight', parseInt(row.dataset.rank) === info.rank);
  });
}

function renderControls() {
  const controls = document.getElementById('controls');

  if (game.phase === 'idle' || game.phase === 'ended' || game.phase === 'showdown') {
    controls.innerHTML = `<button class="btn btn-deal" onclick="startNewHand()">Deal / 发牌</button>`;
    return;
  }

  const p = game.players[game.activePlayerIndex];
  if (!p.isHuman) {
    controls.innerHTML = `<div style="color:#aaa;">AI 思考中...</div>`;
    return;
  }

  const { actions, toCall, minRaise } = game.getValidActions();
  let html = '';

  if (actions.includes('fold')) html += `<button class="btn btn-fold" onclick="humanAction('fold')">Fold 弃牌</button>`;
  if (actions.includes('check')) html += `<button class="btn btn-check" onclick="humanAction('check')">Check 过牌</button>`;
  if (actions.includes('call')) html += `<button class="btn btn-call" onclick="humanAction('call')">Call 跟注 (${toCall})</button>`;
  if (actions.includes('raise')) html += `<input type="number" class="raise-input" id="raiseInput" value="${minRaise}" min="${minRaise}" max="${p.chips + p.bet}" step="${game.bigBlind}">
    <button class="btn btn-raise" onclick="humanAction('raise')">Raise 加注</button>`;
  if (actions.includes('allin')) html += `<button class="btn btn-allin" onclick="humanAction('allin')">All-In (${p.chips})</button>`;

  controls.innerHTML = html;

  // Show tutorial tip for action
  if (tutorialMode && game.phase === 'preflop') showTutorialTip('preflop_action');
  else if (tutorialMode) showTutorialTip(game.phase);
}

function renderAll() {
  renderPlayers();
  renderCommunity();
  renderHandInfo();
  renderControls();
}

let lastPhase = 'idle';

function startNewHand() {
  document.getElementById('overlay').classList.remove('show');
  game.players.forEach(p => { if (p.chips <= 0 && !p.isHuman) p.chips = 500; });
  if (game.players[0].chips <= 0) { game.players[0].chips = 1000; log('You rebuy 1000 chips! / 你重新买入 1000 筹码！'); }

  const result = game.startHand();
  log(`--- Hand #${game.handNumber} ---`);
  lastPhase = 'preflop';
  tutorialStep = 1;
  renderAll();

  if (tutorialMode) showTutorialTip('deal');

  // Delay a bit before processing if tutorial mode
  if (tutorialMode) {
    setTimeout(() => processResult(result), 1500);
  } else {
    processResult(result);
  }
}

function humanAction(action) {
  let amount = 0;
  if (action === 'raise') {
    const input = document.getElementById('raiseInput');
    amount = parseInt(input.value) || game.currentBet + game.bigBlind;
  }
  log(`You: ${action.toUpperCase()}${amount > 0 ? ' ' + amount : ''}`);
  hideTutorialTip();
  const result = game.doAction(action, amount);
  renderAll();
  processResult(result);
}

function processResult(result) {
  if (!result) return;

  // Check for phase change and show tutorial tip
  if (tutorialMode && game.phase !== lastPhase) {
    lastPhase = game.phase;
    tutorialStep++;
    if (TUTORIAL_TIPS[game.phase]) {
      showTutorialTip(game.phase);
    }
  }

  if (result.status === 'ai_turn') {
    setTimeout(() => {
      const aiResult = game.runAI();
      log(game.lastAction);
      renderAll();
      processResult(aiResult);
    }, 600 + Math.random() * 600);
  } else if (result.status === 'hand_over') {
    log(`${result.winner.name} wins ${result.pot}! (others folded)`);
    renderAll();
    showResult(null, result.winner, result.pot);
  } else if (result.status === 'showdown') {
    log(`Showdown! Pot: ${result.pot}`);
    renderAll();
    showShowdown(result);
  }
}

function showResult(results, winner, pot) {
  hideTutorialTip();
  const card = document.getElementById('resultCard');
  const isYou = winner.isHuman;
  card.innerHTML = `
    <h2>${isYou ? '🎉 你赢了！' : '😅 ' + winner.name + ' Wins'}</h2>
    <p style="color:#4ecdc4;font-size:1.2em;">+${pot} chips</p>
    <p style="margin-top:12px;color:#aaa;">${isYou ? '其他玩家都弃牌了！' : '其他玩家弃牌'}</p>
    ${tutorialMode ? '<p style="margin-top:8px;color:#ffd700;font-size:0.85em;">TIP: 所有人弃牌，剩下的人赢走筹码！</p>' : ''}
    <button class="btn btn-deal" onclick="startNewHand()" style="margin-top:20px;">下一手 / Next</button>
  `;
  document.getElementById('overlay').classList.add('show');
}

function showShowdown(result) {
  hideTutorialTip();
  if (tutorialMode) { tutorialStep = 5; showTutorialTip('showdown'); }

  const card = document.getElementById('resultCard');
  let playersHTML = '';
  for (const r of result.results) {
    const isWinner = result.winners.some(w => w.player === r.player);
    playersHTML += `<div class="result-player ${isWinner ? 'winner' : ''}">
      <span>${isWinner ? '🏆 ' : ''}${r.player.name}</span>
      <span>
        ${r.player.hand.map(c => `${c.rank}${SUIT_SYMBOLS[c.suit]}`).join(' ')}
        <span class="result-hand-name">${HAND_NAMES[r.score.rank]}</span>
      </span>
    </div>`;
  }

  const winnerNames = result.winners.map(w => w.player.name).join(', ');
  const youWon = result.winners.some(w => w.player.isHuman);
  card.innerHTML = `
    <h2>摊牌 Showdown</h2>
    <div class="result-players">${playersHTML}</div>
    <p style="color:#ffd700;font-size:1.1em;margin-top:12px;">🏆 ${winnerNames} 赢了 ${result.pot} 筹码！</p>
    ${youWon ? '<p style="color:#4ecdc4;margin-top:6px;">🎉 恭喜你！</p>' : '<p style="color:#aaa;margin-top:6px;">下次加油！</p>'}
    ${tutorialMode ? '<p style="margin-top:8px;color:#ffd700;font-size:0.85em;">TIP: 牌型最大的人赢走全部筹码！</p>' : ''}
    <button class="btn btn-deal" onclick="startNewHand()" style="margin-top:20px;">下一手 / Next</button>
  `;
  document.getElementById('overlay').classList.add('show');
}

// Initial render
renderAll();
