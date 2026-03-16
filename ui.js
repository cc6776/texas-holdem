const game = new TexasHoldem();
let logs = [];

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
        <div class="player-name">${p.name}${i === game.dealerIndex ? ' 🔘' : ''}</div>
        <div class="player-chips">💰 ${p.chips}</div>
        ${p.bet > 0 ? `<div class="player-bet">Bet: ${p.bet}</div>` : ''}
        <div class="player-action-label">${p.folded ? 'FOLD' : (p.allIn ? 'ALL-IN' : '')}</div>
      </div>`;
  });
}

function renderCommunity() {
  const el = document.getElementById('communityCards');
  el.innerHTML = game.communityCards.map(c => createCardHTML(c)).join('');
  document.getElementById('potDisplay').textContent = `Pot: ${game.pot}`;
  document.getElementById('phaseDisplay').textContent = game.phase === 'idle' ? 'Click Deal to Start' : game.phase.toUpperCase();
}

function renderHandInfo() {
  const info = game.getPlayerHandInfo(0);
  const el = document.getElementById('currentHand');
  if (!info) { el.textContent = '-'; return; }
  el.textContent = info.handName;

  // Highlight in reference table
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
    controls.innerHTML = `<div style="color:#aaa;">AI is thinking...</div>`;
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
}

function renderAll() {
  renderPlayers();
  renderCommunity();
  renderHandInfo();
  renderControls();
}

function startNewHand() {
  document.getElementById('overlay').classList.remove('show');
  // Check if any non-human player is broke, reset them
  game.players.forEach(p => { if (p.chips <= 0 && !p.isHuman) p.chips = 500; });
  if (game.players[0].chips <= 0) { game.players[0].chips = 1000; log('You rebuy 1000 chips! / 你重新买入 1000 筹码！'); }

  const result = game.startHand();
  log(`--- Hand #${game.handNumber} ---`);
  renderAll();
  processResult(result);
}

function humanAction(action) {
  let amount = 0;
  if (action === 'raise') {
    const input = document.getElementById('raiseInput');
    amount = parseInt(input.value) || game.currentBet + game.bigBlind;
  }
  log(`You: ${action.toUpperCase()}${amount > 0 ? ' ' + amount : ''}`);
  const result = game.doAction(action, amount);
  renderAll();
  processResult(result);
}

function processResult(result) {
  if (!result) return;

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
  const card = document.getElementById('resultCard');
  card.innerHTML = `
    <h2>🏆 ${winner.name} Wins!</h2>
    <p style="color:#4ecdc4;font-size:1.2em;">+${pot} chips</p>
    <p style="margin-top:12px;color:#aaa;">All other players folded / 其他玩家弃牌</p>
    <button class="btn btn-deal" onclick="startNewHand()" style="margin-top:20px;">Next Hand / 下一手</button>
  `;
  document.getElementById('overlay').classList.add('show');
}

function showShowdown(result) {
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
  card.innerHTML = `
    <h2>Showdown / 摊牌</h2>
    <div class="result-players">${playersHTML}</div>
    <p style="color:#ffd700;font-size:1.1em;margin-top:12px;">🏆 ${winnerNames} wins ${result.pot} chips!</p>
    <button class="btn btn-deal" onclick="startNewHand()" style="margin-top:20px;">Next Hand / 下一手</button>
  `;
  document.getElementById('overlay').classList.add('show');
}

// Initial render
renderAll();
