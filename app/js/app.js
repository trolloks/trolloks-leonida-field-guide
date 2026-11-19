// The page: wires the tabs, filters, checklist, detail panel, roadmap, missables, save/load and sources to the data.
// Text is always set with textContent, never innerHTML, so trophy text can never inject markup.
(function () {
  'use strict';

  var GTA6 = window.GTA6;
  var DATA = window.GTA6_TROPHY_DATA;
  var store = GTA6.store;
  var rules = GTA6.rules;
  var TOTAL = DATA.trophies.length;
  var SETTINGS_KEY = 'gta6-trophy-tracker/settings';

  var state = {
    earned: new Set(),
    selectedId: null,
    filters: { kind: 'all', grade: 'all', status: 'all' },
    spoiler: true,
    view: 'checklist',
    persisted: true,
  };

  var byId = {};
  DATA.trophies.forEach(function (t) { byId[t.id] = t; });

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function gradeLabel(grade) {
    return grade.charAt(0).toUpperCase() + grade.slice(1);
  }

  function kindLabel(kind) {
    return rules.KIND_LABELS[kind] || kind;
  }

  function stageTitle(id) {
    var s = DATA.stages.filter(function (x) { return x.id === id; })[0];
    return s ? s.title : '';
  }

  // Persist progress. The page keeps working in memory if localStorage refuses the write, and says so.
  function persist() {
    var storage = window.localStorage;
    var ok = false;
    try {
      ok = store.save(storage, Array.from(state.earned), TOTAL);
    } catch (e) {
      ok = false;
    }
    state.persisted = ok;
    $('status').textContent = ok ? '' : 'Progress could not be saved in this browser. Export the file to keep it.';
  }

  function loadSettings() {
    try {
      var raw = window.localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (typeof s.spoiler === 'boolean') state.spoiler = s.spoiler;
      }
    } catch (e) {
      // Settings are optional: keep the defaults.
    }
  }

  function saveSettings() {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ spoiler: state.spoiler }));
    } catch (e) {
      // Ignored: the setting still applies for this visit.
    }
  }

  function toggleEarned(id, on) {
    if (on) state.earned.add(id);
    else state.earned.delete(id);
    persist();
    renderAll();
  }

  // ---- progress line ----
  function renderProgress() {
    var s = rules.summary(DATA.trophies, state.earned);
    $('progress-line').textContent = s.earned + ' of ' + s.total + ' earned (' + s.percent + '%)';
    $('progress-bar').style.width = s.percent + '%';
    var parts = rules.GRADE_ORDER.map(function (g) {
      var b = s.byGrade[g];
      return gradeLabel(g) + ' ' + b.earned + '/' + b.total;
    });
    $('grade-line').textContent = parts.join(' · ') + ' · Story ' + s.storyEarned + '/' + s.storyTotal;
  }

  // ---- checklist ----
  function renderRows() {
    var rows = $('rows');
    rows.replaceChildren();
    var shown = 0;
    DATA.trophies.forEach(function (t) {
      if (!rules.visible(t, state.filters, state.earned)) return;
      shown += 1;
      var hidden = rules.isHidden(t, state.earned, state.spoiler);
      var tr = el('tr', t.id === state.selectedId ? 'selected' : '');
      tr.dataset.id = String(t.id);
      tr.tabIndex = 0;

      var tdBox = el('td', 'box');
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = state.earned.has(t.id);
      box.setAttribute('aria-label', 'Earned: ' + (hidden ? 'hidden story trophy ' + t.id : t.name));
      box.addEventListener('click', function (e) { e.stopPropagation(); });
      box.addEventListener('change', function () { toggleEarned(t.id, box.checked); });
      tdBox.append(box);

      var tdName = el('td', 'name');
      if (hidden) {
        tdName.append(el('span', 'hidden-name', 'Hidden story trophy'));
        tdName.append(el('span', 'small', 'Earn it, or turn off the spoiler guard, to see its name.'));
      } else {
        tdName.append(el('span', 'trophy-name', t.name));
        tdName.append(el('span', 'small', t.description));
      }

      var tdGrade = el('td', 'grade grade-' + t.grade, gradeLabel(t.grade));
      var tdKind = el('td', 'kind');
      tdKind.append(el('span', 'kind-' + t.kind, kindLabel(t.kind)));
      if (t.missable) tdKind.append(el('span', 'flag', 'Missable'));

      tr.append(tdBox, tdName, tdGrade, tdKind);
      tr.addEventListener('click', function () { select(t.id); });
      tr.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(t.id); }
      });
      rows.append(tr);
    });
    $('visible-count').textContent = 'Showing ' + shown + ' of ' + TOTAL + ' trophies.';
  }

  function select(id) {
    state.selectedId = id;
    renderRows();
    renderDetail();
  }

  function renderDetail() {
    var box = $('detail');
    box.replaceChildren();
    var t = byId[state.selectedId];
    if (!t) {
      box.append(el('p', 'small', 'Choose a trophy to open its guide.'));
      return;
    }
    var got = state.earned.has(t.id);
    var hidden = rules.isHidden(t, state.earned, state.spoiler);

    var head = el('div', 'detail-head');
    head.append(el('span', 'grade grade-' + t.grade, gradeLabel(t.grade)));
    head.append(el('span', 'kind-' + t.kind, kindLabel(t.kind)));
    if (t.missable) head.append(el('span', 'flag', 'Missable'));
    box.append(head);

    if (hidden) {
      box.append(el('h2', 'hidden-name', 'Hidden story trophy'));
      box.append(el('p', 'lead', 'Its name, description and guide stay hidden until you earn it or turn off the spoiler guard.'));
    } else {
      box.append(el('h2', '', t.name));
      box.append(el('p', 'official', t.description));
      box.append(el('h3', '', 'Guide'));
      box.append(el('p', 'guide', t.guide));
    }

    var facts = el('dl', 'facts');
    facts.append(el('dt', '', 'Roadmap'), el('dd', '', 'Stage ' + t.stage + ': ' + stageTitle(t.stage)));
    if (t.count) facts.append(el('dt', '', 'Count'), el('dd', '', 'Target ' + t.count.target + ' (source ' + t.count.source + ')'));
    if (t.missable) {
      facts.append(el('dt', '', 'Missable'), el('dd', '', 'Yes'));
      if (!hidden) facts.append(el('dt', '', 'Why it can be missed'), el('dd', '', t.missableBasis));
    } else {
      facts.append(el('dt', '', 'Missable'), el('dd', '', 'No (not tied to a one-time event in the description)'));
    }
    box.append(facts);

    box.append(el('h3', '', 'Sources'));
    var list = el('ul', 'sources');
    t.sources.forEach(function (key) {
      var src = DATA.sources[key];
      list.append(el('li', '', key + ': ' + (src ? src.label : key)));
    });
    box.append(list);

    var btn = el('button', 'primary', got ? 'Mark as not earned' : 'Mark as earned');
    btn.type = 'button';
    btn.addEventListener('click', function () { toggleEarned(t.id, !got); });
    box.append(btn);
  }

  // ---- roadmap ----
  function renderRoadmap() {
    var stages = rules.roadmap(DATA, state.earned);
    var next = rules.nextUp(DATA, state.earned);
    var nu = $('next-up');
    nu.replaceChildren();
    if (next) {
      nu.append(el('p', 'small', 'Next up on the roadmap'));
      var stageNow = stages.filter(function (s) { return s.id === next.stage; })[0];
      var hiddenNext = rules.isHidden(next, state.earned, state.spoiler);
      nu.append(el('h2', '', hiddenNext ? 'Stage ' + next.stage + ': a hidden story trophy' : next.name));
      nu.append(el('p', 'small', 'Stage ' + next.stage + ' of ' + stages.length + ': ' + stageNow.title + '.'));
    } else {
      nu.append(el('h2', '', 'Everything earned. Platinum done.'));
    }

    var root = $('stages');
    root.replaceChildren();
    stages.forEach(function (s) {
      var card = el('section', 'stage' + (s.complete ? ' complete' : ''));
      var h = el('h2', '', s.id + '. ' + s.title + ' (' + s.done + '/' + s.total + ')');
      card.append(h);
      var meta = DATA.stages.filter(function (x) { return x.id === s.id; })[0];
      card.append(el('p', 'small', meta.summary));
      var ol = el('ol', 'stage-list');
      s.items.forEach(function (t) {
        var done = state.earned.has(t.id);
        var hidden = rules.isHidden(t, state.earned, state.spoiler);
        var li = el('li', done ? 'done' : '');
        li.append(el('span', 'tick', done ? 'Earned' : 'Open'));
        li.append(el('span', 'grade grade-' + t.grade, gradeLabel(t.grade)));
        li.append(el('span', '', hidden ? 'Hidden story trophy' : t.name));
        if (t.missable) li.append(el('span', 'flag', 'Missable'));
        ol.append(li);
      });
      card.append(ol);
      root.append(card);
    });
  }

  // ---- missables ----
  function renderMissables() {
    var root = $('missables');
    root.replaceChildren();
    var list = DATA.trophies.filter(function (t) { return t.missable; });
    root.append(el('p', 'small', list.length + ' missable trophies in this list.'));
    var ul = el('ul', 'missable-list');
    list.forEach(function (t) {
      var li = el('li', state.earned.has(t.id) ? 'done' : '');
      var hidden = rules.isHidden(t, state.earned, state.spoiler);
      var top = el('div', 'missable-top');
      top.append(el('span', 'grade grade-' + t.grade, gradeLabel(t.grade)));
      top.append(el('strong', '', hidden ? 'Hidden story trophy' : t.name));
      top.append(el('span', 'small', state.earned.has(t.id) ? 'Earned' : 'Open'));
      li.append(top);
      li.append(el('p', 'small', hidden ? 'Basis hidden by the spoiler guard.' : 'Why it can be missed: ' + t.missableBasis));
      ul.append(li);
    });
    root.append(ul);
  }

  // ---- sources ----
  function renderSources() {
    var root = $('sources');
    root.replaceChildren();
    root.append(el('p', 'lead', 'Every guide cites the keys below. No external guide, wiki or video was consulted for this build: this workspace had no network access, so the guide text is built only from the official descriptions and the kit\'s hint lines.'));
    var dl = el('dl', 'sources-list');
    Object.keys(DATA.sources).forEach(function (key) {
      dl.append(el('dt', '', key + ': ' + DATA.sources[key].label));
      dl.append(el('dd', '', DATA.sources[key].detail));
    });
    root.append(dl);
    root.append(el('p', 'small', 'Data: ' + DATA.list + '. Game: ' + DATA.game + ', ' + DATA.platform + '.'));
    root.append(el('p', 'small', DATA.notice));
  }

  // ---- save and load ----
  function exportProgress() {
    var text = store.buildExport(Array.from(state.earned), TOTAL, new Date().toISOString());
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'gta6-trophy-progress.json';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    $('status').textContent = 'Exported ' + state.earned.size + ' earned trophies to gta6-trophy-progress.json.';
  }

  function importProgress(file) {
    var mode = document.querySelector('input[name="import-mode"]:checked').value;
    var reader = new FileReader();
    reader.onload = function () {
      var result = store.parseProgress(String(reader.result), TOTAL);
      if (!result.ok) {
        $('status').textContent = 'Import failed. ' + result.error + ' Your progress is unchanged.';
        return;
      }
      var before = state.earned.size;
      if (mode === 'merge') {
        result.ids.forEach(function (id) { state.earned.add(id); });
      } else {
        state.earned = new Set(result.ids);
      }
      persist();
      renderAll();
      var note = result.dropped > 0 ? ' ' + result.dropped + ' entries were ignored (not trophy numbers 1 to ' + TOTAL + ', or repeated).' : '';
      $('status').textContent = 'Imported ' + result.ids.length + ' earned trophies (' + mode + '). You now have ' + state.earned.size + ' earned (was ' + before + ').' + note;
    };
    reader.onerror = function () {
      $('status').textContent = 'Import failed: the file could not be read. Your progress is unchanged.';
    };
    reader.readAsText(file);
  }

  // ---- views and filters ----
  function showView(name) {
    state.view = name;
    document.querySelectorAll('.tab').forEach(function (b) {
      var on = b.dataset.view === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.view').forEach(function (v) {
      v.hidden = v.id !== 'view-' + name;
    });
    renderAll();
  }

  function renderAll() {
    renderProgress();
    renderRows();
    renderDetail();
    renderRoadmap();
    renderMissables();
    renderSources();
  }

  function wire() {
    document.querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () { showView(b.dataset.view); });
    });
    $('filter-kind').addEventListener('change', function (e) { state.filters.kind = e.target.value; renderRows(); });
    $('filter-grade').addEventListener('change', function (e) { state.filters.grade = e.target.value; renderRows(); });
    $('filter-status').addEventListener('change', function (e) { state.filters.status = e.target.value; renderRows(); });
    $('spoiler').checked = state.spoiler;
    $('spoiler').addEventListener('change', function (e) {
      state.spoiler = e.target.checked;
      saveSettings();
      renderAll();
    });
    $('export').addEventListener('click', exportProgress);
    $('import').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (file) importProgress(file);
      e.target.value = '';
    });
    $('reset').addEventListener('click', function () {
      state.earned = new Set();
      persist();
      renderAll();
      $('status').textContent = 'All progress cleared in this browser.';
    });
  }

  function start() {
    var loaded = store.load(window.localStorage, TOTAL);
    state.earned = new Set(loaded.ids);
    state.persisted = loaded.persisted;
    loadSettings();
    var first = DATA.trophies.filter(function (t) { return t.kind === 'story'; })[0];
    state.selectedId = first ? first.id : DATA.trophies[0].id;
    wire();
    renderAll();
    if (!loaded.persisted) $('status').textContent = 'Saved progress could not be read; starting empty.';
  }

  start();
})();
