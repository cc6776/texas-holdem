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
        <div class="player-chips">$ ${p.chips}</div>
        ${p.bet > 0 ? `<div class="player-bet">Bet: ${p.bet}</div>` : ''}
        <div class="player-action-label">${p.folded ? 'FOLD' : (p.allIn ? 'ALL-IN' : '')}</div>
      </div>`;
  });
}

function renderCommunity() {
  const el = document.getElementById('communityCards');
  el.innerHTML = game.communityCards.map(c => createCardHTML(c)).join('');
  document.getElementById('potDisplay').textContent = `Pot: ${game.pot}`;
  const phaseNames = { idle: 'Click Deal to Start', preflop: 'PREFLOP / Fa Pai Qian', flop: 'FLOP / Fan Pai', turn: 'TURN / Zhuan Pai', river: 'RIVER / He Pai', showdown: 'SHOWDOWN', ended: 'ENDED' };
  document.getElementById('phaseDisplay').textContent = phaseNames[game.phase] || game.phase.toUpperCase();
}

function renderHandInfo() {
  const info = game.getPlayerHandInfo(0);
  const el = document.getElementById('currentHand');
  if (!info) { el.textContent = '-'; return; }
  el.textContent = info.handName;

  document.querySelectorAll('.ref-row').forEach(row => {
    row.classList.toggle('highlight', parseInt(row.dataset.rank) === info.rank);
  });
}

function renderControls() {
  const controls = document.getElementById('controls');

  if (game.phase === 'idle' || game.phase === 'ended' || game.phase === 'showdown') {
    controls.innerHTML = `<button class="btn btn-deal" onclick="startNewHand()">Deal / Fa Pai</button>`;
    return;
  }

  const p = game.players[game.activePlayerIndex];
  if (!p.isHuman) {
    controls.innerHTML = `<div style="color:#aaa;">AI is thinking... / AI Si Kao Zhong...</div>`;
    return;
  }

  const { actions, toCall, minRaise } = game.getValidActions();
  let html = '';

  if (actions.includes('fold')) html += `<button class="btn btn-fold" onclick="humanAction('fold')">Fold Qi Pai</button>`;
  if (actions.includes('check')) html += `<button class="btn btn-check" onclick="humanAction('check')">Check Guo Pai</button>`;
  if (actions.includes('call')) html += `<button class="btn btn-call" onclick="humanAction('call')">Call Gen Zhu (${toCall})</button>`;
  if (actions.includes('raise')) html += `<input type="number" class="raise-input" id="raiseInput" value="${minRaise}" min="${minRaise}" max="${p.chips + p.bet}" step="${game.bigBlind}">
    <button class="btn btn-raise" onclick="humanAction('raise')">Raise Jia Zhu</button>`;
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
  if (game.players[0].chips <= 0) { game.players[0].chips = 1000; log('You rebuy 1000 chips! / Ni Chong Xin Mai Ru 1000 Chou Ma!'); }

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
    <h2>${isYou ? '🎉 You Win! / Ni Ying Le!' : '😅 ' + winner.name + ' Wins'}</h2>
    <p style="color:#4ecdc4;font-size:1.2em;">+${pot} chips</p>
    <p style="margin-top:12px;color:#aaa;">${isYou ? 'All other players folded! / Qi Ta Wan Jia Dou Qi Pai Le!' : 'All other players folded / Qi Ta Wan Jia Qi Pai'}</p>
    ${tutorialMode ? '<p style="margin-top:8px;color:#ffd700;font-size:0.85em;">TIP: You won! If everyone else folds, last one standing wins. / Qi Ta Ren Dou Qi Pai Le, Sheng Xia De Ren Ying!</p>' : ''}
    <button class="btn btn-deal" onclick="startNewHand()" style="margin-top:20px;">Next Hand / Xia Yi Shou</button>
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
    <h2>Showdown / Tan Pai</h2>
    <div class="result-players">${playersHTML}</div>
    <p style="color:#ffd700;font-size:1.1em;margin-top:12px;">🏆 ${winnerNames} wins ${result.pot} chips!</p>
    ${youWon ? '<p style="color:#4ecdc4;margin-top:6px;">🎉 Congratulations! / Gong Xi!</p>' : '<p style="color:#aaa;margin-top:6px;">Better luck next time! / Xia Ci Jia You!</p>'}
    ${tutorialMode ? '<p style="margin-top:8px;color:#ffd700;font-size:0.85em;">TIP: The player with the strongest 5-card combo wins. / Pai Xing Zui Da De Ren Ying Zou Chou Ma!</p>' : ''}
    <button class="btn btn-deal" onclick="startNewHand()" style="margin-top:20px;">Next Hand / Xia Yi Shou</button>
  `;
  document.getElementById('overlay').classList.add('show');
}

// Initial render
renderAll();
