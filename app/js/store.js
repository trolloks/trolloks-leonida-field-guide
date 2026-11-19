// Progress storage: the earned trophy ids, kept in the browser's localStorage and exported to or imported from a JSON file.
// Pure functions where possible, so the tests can run them without a page. Attaches to window.GTA6.store.
(function (ns) {
  'use strict';

  var KEY = 'gta6-trophy-tracker/v1';
  var FORMAT = 'gta6-trophy-progress';
  var VERSION = 1;

  // Keep only whole-number ids in 1..total, each once, in ascending order.
  function normalizeIds(list, total) {
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      if (typeof v !== 'number' || !isFinite(v) || Math.floor(v) !== v || v < 1 || v > total) continue;
      if (seen[v]) continue;
      seen[v] = true;
      out.push(v);
    }
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  // Read an imported file's text. Accepts our own format ({format, version, earned: [ids]}) or a bare array of ids.
  // Returns {ok: true, ids: [...], dropped: n} or {ok: false, error: '...'}; never throws.
  function parseProgress(text, total) {
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: 'The file is not JSON, so nothing was imported.' };
    }
    var list;
    if (Array.isArray(data)) {
      list = data;
    } else if (data && typeof data === 'object' && Array.isArray(data.earned)) {
      if (data.format !== undefined && data.format !== FORMAT) {
        return { ok: false, error: 'This file is not a GTA VI trophy progress file (format "' + data.format + '").' };
      }
      if (data.version !== undefined && data.version !== VERSION) {
        return { ok: false, error: 'Progress file version ' + data.version + ' is not supported (this app reads version ' + VERSION + ').' };
      }
      list = data.earned;
    } else {
      return { ok: false, error: 'No "earned" list found, so nothing was imported.' };
    }
    var ids = normalizeIds(list, total);
    return { ok: true, ids: ids, dropped: list.length - ids.length };
  }

  // The text of an export file for these ids.
  function buildExport(ids, total, when) {
    return JSON.stringify({
      format: FORMAT,
      version: VERSION,
      game: 'Grand Theft Auto VI',
      platform: 'PlayStation 5',
      total: total,
      exportedAt: when,
      earned: normalizeIds(ids, total),
    }, null, 2) + '\n';
  }

  // Load saved ids from a storage object (localStorage in the page). Missing or broken data gives an empty list.
  function load(storage, total) {
    try {
      var raw = storage.getItem(KEY);
      if (!raw) return { ids: [], persisted: true };
      var parsed = JSON.parse(raw);
      return { ids: normalizeIds(Array.isArray(parsed.earned) ? parsed.earned : [], total), persisted: true };
    } catch (e) {
      return { ids: [], persisted: false };
    }
  }

  // Save ids to a storage object. Returns true when the write succeeded.
  function save(storage, ids, total) {
    try {
      storage.setItem(KEY, JSON.stringify({ version: VERSION, earned: normalizeIds(ids, total) }));
      return true;
    } catch (e) {
      return false;
    }
  }

  ns.store = {
    KEY: KEY,
    FORMAT: FORMAT,
    VERSION: VERSION,
    normalizeIds: normalizeIds,
    parseProgress: parseProgress,
    buildExport: buildExport,
    load: load,
    save: save,
  };
})(window.GTA6 = window.GTA6 || {});
