// Token Radar's dashboard, radar-2. Reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, filters, a per-protocol detail view with the model's own inputs
// and the protocol's farm plan, and the live-token view. No network: every byte it shows is in
// data.js. The page recomputes each row from the snapshot figures and checks the number
// board.json carries, so the page's code and the board's data are visibly the same arithmetic.
(function () {
  'use strict';

  var DATA = window.RADAR;
  var app = document.getElementById('board');
  if (!DATA || !app) return;

  var state = { q: '', category: 'all', chain: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return (Math.round(n * 100) / 100).toFixed(2) + 'x'; }

  // radar-2, the same function main.ts runs: base x growth x maturity x breadth.
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var extra = Math.min(Math.max((row.chains || []).length - 1, 0), model.breadth_cap);
    var breadth = 1 + extra * model.breadth_step;
    return Math.max(1, Math.round(row.tvl_usd * model.base_multiple * growthMult * maturity * breadth));
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and
  // age decide the action, the capital, the hold and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('liquid staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('yield') >= 0) return 'Deposit $' + capital + " into " + name + "'s highest-TVL vault on " + chain + ' and keep the shares.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function weeklyFor(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0) return 'Make one qualifying action each week, such as a deposit, a borrow or a repayment.';
    if (c.indexOf('dex') >= 0) return 'Make one qualifying action each week, such as a swap, adding liquidity or a vote.';
    if (c.indexOf('bridge') >= 0) return 'Make one qualifying action each week, such as a bridge, a swap or a deposit on the destination chain.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Make one qualifying action each week, such as a stake, a restake or a claim of rewards.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Make one qualifying action each week, such as a trade, a deposit or a close.';
    if (c.indexOf('prediction') >= 0) return 'Make one qualifying action each week, such as a market position or a claim of winnings.';
    return 'Make one qualifying action each week, such as a deposit, a swap or a vote.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var spread = p.chains && p.chains.length > 1
      ? { text: 'Repeat the same position on ' + p.chains[1] + ' so the farm is counted on two chains, not one.', cost: 'another $' + capital + ' of capital and about $4 of gas', time: '15 minutes' }
      : { text: 'Open a second, smaller position of a different kind on the same protocol, so the address shows two behaviours.', cost: 'about $' + Math.round(capital / 2) + ' of capital and about $4 of gas', time: '15 minutes' };
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      spread,
      { text: weeklyFor(p), cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes, then write the wallet, the dates and every transaction in a farm log.", cost: 'no fee to check, and never pay to claim', time: '15 minutes' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'multiple') { av = a.implied_value_usd / a.tvl_usd; bv = b.implied_value_usd / b.tvl_usd; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function option(value, label, selected) {
    return '<option value="' + esc(value) + '"' + (selected ? ' selected' : '') + '>' + esc(label) + '</option>';
  }

  function render() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var list = state.tab === 'pre-token' ? sortedRows(filteredRows()) : DATA.live;
    var max = state.tab === 'pre-token' ? (DATA.rows[0] ? DATA.rows[0].implied_value_usd : 1) : 1;

    var rowsHtml = '';
    if (state.tab === 'pre-token') {
      if (list.length === 0) {
        rowsHtml = '<div class="empty"><h2>No protocol matches that filter</h2><p>Clear the search or pick another category to see the board again.</p><button class="button" type="button" data-clear="1">Clear filters</button></div>';
      } else {
        rowsHtml = '<div class="table-wrap"><table><caption>Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.</caption><thead><tr>'
          + '<th><button type="button" data-sort="implied">Rank</button></th>'
          + '<th><button type="button" data-sort="name">Protocol</button></th>'
          + '<th class="num"><button type="button" data-sort="tvl">TVL</button></th>'
          + '<th class="num"><button type="button" data-sort="growth">7d</button></th>'
          + '<th class="num"><button type="button" data-sort="age">Age</button></th>'
          + '<th class="num"><button type="button" data-sort="implied">Implied value</button></th>'
          + '<th class="num"><button type="button" data-sort="multiple">Multiple</button></th>'
          + '<th>Token</th></tr></thead><tbody>'
          + list.map(function (r) {
            var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
            var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
            var mult = r.implied_value_usd / r.tvl_usd;
            return '<tr data-slug="' + esc(r.slug) + '" data-selected="' + (state.selected === r.slug) + '" tabindex="0">'
              + '<td class="num">' + r.rank + '</td>'
              + '<td><div class="name"><b>' + esc(r.name) + '</b><span class="sub">' + esc(r.category || 'Other') + ' on ' + esc(r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') + '</span></div></td>'
              + '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>'
              + '<td class="num ' + growthClass + '">' + growth + '</td>'
              + '<td class="num">' + fmtAge(r.age_days) + '</td>'
              + '<td><div class="implied"><div class="bar" aria-hidden="true"><i style="width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%"></i></div><span class="num">' + fmtUsd(r.implied_value_usd) + '</span></div></td>'
              + '<td class="num">' + fmtMult(mult) + '</td>'
              + '<td><span class="status">no token</span></td></tr>';
          }).join('')
          + '</tbody></table></div>';
      }
    } else {
      rowsHtml = '<div class="table-wrap"><table><caption>Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.</caption><thead><tr><th>Status</th><th>Protocol</th><th class="num">TVL</th><th class="num">7d</th><th class="num">Market cap</th><th>Token</th></tr></thead><tbody>'
        + DATA.live.map(function (r) {
          return '<tr><td class="num">live</td>'
            + '<td><div class="name"><b>' + esc(r.name) + '</b><span class="sub">' + esc(r.category || 'Other') + ' on ' + esc(r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') + '</span></div></td>'
            + '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>'
            + '<td class="num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg') + '">' + fmtPct(r.change_7d) + '</td>'
            + '<td class="num">' + fmtUsd(r.mcap_usd) + '</td>'
            + '<td><span class="status live">already trades</span></td></tr>';
        }).join('')
        + '</tbody></table></div>';
    }

    var m = DATA.model;
    app.innerHTML = '<div class="shell">'
      + '<header class="top"><div class="brand"><span class="mark"></span><span class="brand-name">Token Radar</span><span class="brand-tag">pre-token protocols, ranked by implied value</span></div>'
      + '<div class="top-meta"><span>Snapshot ' + esc(DATA.as_of) + '</span><span>DefiLlama protocol index</span><span>' + esc(DATA.model_version) + ' model</span></div></header>'
      + '<section class="lede"><h1><em>' + DATA.watchlist_size + ' watchlist</em> protocols, plus every early one below the floor</h1>'
      + '<p>The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor — the whole field, not a top slice. Implied value is a model, not a promise.</p>'
      + '<div class="facts">'
      + '<div class="fact"><span>Watchlist covered</span><b>' + DATA.watchlist_size + ' / ' + DATA.watchlist_size + '</b></div>'
      + '<div class="fact"><span>Pre-token rows scored</span><b>' + DATA.board_size + '</b></div>'
      + '<div class="fact"><span>Early rows below the floor</span><b>' + DATA.early_size + '</b></div>'
      + '<div class="fact"><span>Live-token protocols set aside</span><b>' + DATA.live_size + '</b><small> shown at market cap</small></div>'
      + '</div></section>'
      + '<div class="controls">'
      + '<div class="field"><label for="q">Search</label><input type="search" id="q" placeholder="Search name, category or chain" value="' + esc(state.q) + '" aria-label="Search the board"></div>'
      + '<div class="field"><label for="category">Category</label><select id="category" aria-label="Filter by category"><option value="all">All categories</option>' + categories.map(function (c) { return option(c, c, c === state.category); }).join('') + '</select></div>'
      + '<div class="field"><label for="chain">Chain</label><select id="chain" aria-label="Filter by chain"><option value="all">All chains</option>' + chains.map(function (c) { return option(c, c, c === state.chain); }).join('') + '</select></div>'
      + '<div class="field"><span class="sub">Token status</span><div class="tabs"><button type="button" data-tab="pre-token" aria-pressed="' + (state.tab === 'pre-token') + '">Pre-token</button><button type="button" data-tab="live" aria-pressed="' + (state.tab === 'live') + '">Live token</button></div></div>'
      + '<span class="count">' + (state.tab === 'pre-token' ? list.length + ' rows shown' : DATA.live.length + ' live-token protocols') + '</span>'
      + '</div>'
      + '<div class="panel">' + rowsHtml + '</div>'
      + (state.tab === 'pre-token'
        ? '<section class="panel model"><h2>How implied value is computed</h2><p class="sub">Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.</p>'
        + '<div class="formula">implied = round( tvl_usd x ' + m.base_multiple + ' x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x (1 + min(chains - 1, ' + m.breadth_cap + ') x ' + m.breadth_step + ') )</div>'
        + '<p class="sub">TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. Breadth counts the chains a protocol runs on: more chains reach more farmers. The early radar is every pre-token protocol below the watchlist floor, and the live-token protocols are set aside with their market caps shown.</p>'
        + '<dl><dt>Base multiple</dt><dd>' + m.base_multiple + 'x TVL</dd><dt>Growth weight</dt><dd>' + m.growth_weight + '</dd><dt>Maturity window</dt><dd>' + m.maturity_days + ' days</dd><dt>Breadth step</dt><dd>+' + m.breadth_step + ' per chain</dd></dl></section>'
        : '')
      + '<p class="foot">Snapshot ' + esc(DATA.as_of) + ' from DefiLlama. A protocol is shown as having no token when its record carries none; that is the record, not a proof it has none. Implied values are this radar\u2019s own estimates, never a price and never a prediction that a token is issued.</p>'
      + '</div>'
      + '<dialog class="detail" id="detail" aria-labelledby="detail-title"></dialog>';

    app.setAttribute('aria-busy', 'false');
    bind();
    if (state.selected) openDetail(state.selected);
  }

  function bind() {
    var q = document.getElementById('q');
    if (q) q.addEventListener('input', function () { state.q = q.value; writeHash(); render(); });
    var cat = document.getElementById('category');
    if (cat) cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var ch = document.getElementById('chain');
    if (ch) ch.addEventListener('change', function () { state.chain = ch.value; writeHash(); render(); });
    Array.prototype.forEach.call(app.querySelectorAll('[data-tab]'), function (b) {
      b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); render(); });
    });
    Array.prototype.forEach.call(app.querySelectorAll('[data-sort]'), function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-sort');
        if (state.sort === key) state.dir = -state.dir;
        else { state.sort = key; state.dir = -1; }
        render();
      });
    });
    Array.prototype.forEach.call(app.querySelectorAll('[data-clear]'), function (b) {
      b.addEventListener('click', function () { state.q = ''; state.category = 'all'; state.chain = 'all'; writeHash(); render(); });
    });
    Array.prototype.forEach.call(app.querySelectorAll('tbody tr[data-slug]'), function (tr) {
      tr.addEventListener('click', function () { openDetail(tr.getAttribute('data-slug')); });
      tr.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(tr.getAttribute('data-slug')); }
      });
    });
  }

  var dialog = null;
  function openDetail(slug) {
    var row = null;
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) { row = DATA.rows[i]; break; }
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog = document.getElementById('detail');
    if (!dialog) return;
    var recomputed = impliedOf(row, DATA.model);
    var match = recomputed === row.implied_value_usd;
    var steps = farmSteps(row);
    dialog.innerHTML = '<div class="detail-head"><div><span class="brand-name">Rank ' + row.rank + ' of ' + DATA.board_size + '</span>'
      + '<h2 id="detail-title">' + esc(row.name) + '</h2>'
      + '<p class="sub">' + esc(row.category || 'Other') + ' on ' + esc((row.chains || []).join(', ') || 'an unnamed chain') + '</p></div>'
      + '<button class="close" type="button" aria-label="Close details">Close</button></div>'
      + '<section class="detail-section"><h3>Implied value</h3><div class="equation">'
      + '<div><span>TVL</span><b class="num">' + fmtUsd(row.tvl_usd) + '</b></div>'
      + '<div><span>Seven-day growth</span><b class="num">' + fmtPct(row.change_7d) + '</b></div>'
      + '<div><span>Age with no token</span><b class="num">' + fmtAge(row.age_days) + '</b></div>'
      + '<div><span>Chains</span><b class="num">' + (row.chains || []).length + '</b></div>'
      + '<div><span>Growth multiplier</span><b class="num">' + fmtMult(row.growth_multiplier) + '</b></div>'
      + '<div><span>Maturity multiplier</span><b class="num">' + fmtMult(row.maturity_multiplier) + '</b></div>'
      + '<div><span>Breadth multiplier</span><b class="num">' + fmtMult(row.breadth_multiplier) + '</b></div>'
      + '<div><span>Implied value</span><b class="num">' + fmtUsd(row.implied_value_usd) + '</b></div>'
      + '</div><p class="sub">Model ' + esc(DATA.model_version) + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(recomputed) + (match ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.</p>'
      + (match ? '<p class="sub"><span class="check">Recomputed value matches board.json.</span></p>' : '')
      + '</section>'
      + '<section class="detail-section"><h3>Farm plan</h3><ol class="steps">'
      + steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return '<li><b>' + esc(action) + '</b><span class="cost">' + esc(tail) + '</span></li>';
      }).join('')
      + '</ol></section>';
    dialog.querySelector('.close').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('close', function () { state.selected = null; writeHash(); }, { once: true });
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog && dialog.open) dialog.close();
  });
})();
