// Monster Smash leaderboard add-on. Plugs the shared leaderboard kit (lb-kit.js)
// into the game WITHOUT touching the game's own code — it only watches the page:
//
//  - First visit: shows the slot-machine name picker on the start screen.
//  - When a Free Play run ends, the game shows its "Time's Up!" modal (the one
//    with #free-replay-btn). We spot that, read the final score from
//    window.__gameCore.score, and send it (offering the picker first if the
//    player skipped naming). Then we add a line to that modal ("Saved as …",
//    with a Change link) and a 🏆 Leaderboard button that opens this game's board.
//
// Master copy lives in C:\Users\Rob\Trend_Engine\leaderboard — edit there and
// copy it into the game's leaderboard/ folder. If Firebase can't load, this
// quietly does nothing and the game plays exactly as before.
(function () {
  'use strict';
  if (typeof LB === 'undefined' || typeof firebase === 'undefined') return;
  try { LB.init('monster'); } catch (e) { console.warn('[leaderboard] init failed', e); return; }

  let picking = false;
  async function openPicker(title) {
    if (picking) return null;
    picking = true;
    try { return await LB.showPicker({ title }); } finally { picking = false; }
  }

  // First visit: greet them with the picker while they're on the start screen.
  // (Runs as soon as the page is parsed — not on 'load', which waits for every
  // image and sound in the game and can take several seconds.)
  (async () => {
    try {
      const me = await LB.getPlayer();
      const start = document.getElementById('start-screen');
      if (!me.name && start && !start.classList.contains('hidden')) {
        setTimeout(() => openPicker('Pick your spooky name!'), 600);
      }
    } catch (e) { console.warn('[leaderboard] player load failed', e); }
  })();

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Adds the leaderboard line + button to the Time's Up modal.
  function decorate(card, text) {
    let line = card.querySelector('.lb-modal-line');
    if (!line) {
      line = document.createElement('p');
      line.className = 'lb-modal-line';
      const score = card.querySelector('.modal-score');
      (score || card).insertAdjacentElement(score ? 'afterend' : 'beforeend', line);
    }
    line.innerHTML = text;
    const change = line.querySelector('.lb-change');
    if (change) change.addEventListener('click', async () => {
      const hadName = card.dataset.lbSent === '1';
      const name = await openPicker(hadName ? 'Pick a new spooky name!' : 'Get on the leaderboard!');
      if (!name) return;
      if (hadName) decorate(card, '🏆 Playing as <b>' + esc(name) + '</b> · <button type="button" class="lb-change">Change</button>');
      else send(card); // skipped earlier — now that they have a name, save this run
    });

    const actions = card.querySelector('.modal-actions');
    if (actions && !actions.querySelector('.lb-board-btn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-ghost lb-board-btn';
      btn.textContent = '🏆 Leaderboard';
      btn.addEventListener('click', () => LB.showBoard());
      actions.appendChild(btn);
    }
  }

  async function onFreePlayOver(card) {
    delete card.dataset.lbSent; // the modal card is reused between runs
    card.dataset.lbScore = Math.floor((window.__gameCore && window.__gameCore.score) || 0);
    decorate(card, '🏆 Saving to the leaderboard…');
    try {
      const me = await LB.getPlayer();
      if (!me.name) {
        decorate(card, '🏆 Pick a name to get on the leaderboard');
        await new Promise((r) => setTimeout(r, 1000));
        const name = await openPicker('Get on the leaderboard!');
        if (!name) {
          decorate(card, 'Not on the leaderboard · <button type="button" class="lb-change">Pick a name</button>');
          return;
        }
      }
      await send(card);
    } catch (e) {
      console.warn('[leaderboard] player load failed', e);
      decorate(card, 'Couldn’t reach the leaderboard this time.');
    }
  }

  // Sends this run's score (read when the modal appeared) under the player's name.
  async function send(card) {
    const score = Number(card.dataset.lbScore) || 0;
    try {
      const me = await LB.getPlayer();
      const res = score > 0 ? await LB.submitScore(score) : { week: false };
      card.dataset.lbSent = '1';
      const best = res.week ? ' · <b>New weekly best!</b>' : '';
      decorate(card, '🏆 Saved as <b>' + esc(me.name) + '</b>' + best + ' · <button type="button" class="lb-change">Change</button>');
    } catch (e) {
      console.warn('[leaderboard] submit failed', e);
      decorate(card, 'Couldn’t reach the leaderboard this time.');
    }
  }

  // Watch the game's modal for a finished Free Play run.
  function watch() {
    const card = document.getElementById('modal-card');
    if (!card) return;
    new MutationObserver(() => {
      if (card.querySelector('#free-replay-btn') && !card.querySelector('.lb-modal-line')) onFreePlayOver(card);
    }).observe(card, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();
})();
