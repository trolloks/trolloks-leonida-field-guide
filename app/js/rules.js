// Filters, the spoiler rule, progress counts and the roadmap's next step. Pure functions over the trophy data.
// Attaches to window.GTA6.rules.
(function (ns) {
  'use strict';

  var KIND_LABELS = {
    all: 'All kinds',
    story: 'Story',
    missable: 'Missable',
    collectibles: 'Collectibles',
    activities: 'Activities',
  };

  var GRADE_ORDER = ['platinum', 'gold', 'silver', 'bronze'];

  // A trophy passes the kind filter: 'missable' is a flag that cuts across kinds, the others match the kind.
  function matchesKind(trophy, kind) {
    if (kind === 'all') return true;
    if (kind === 'missable') return trophy.missable === true;
    return trophy.kind === kind;
  }

  function matchesStatus(earned, status) {
    if (status === 'earned') return earned;
    if (status === 'open') return !earned;
    return true;
  }

  // filters: {kind, grade, status}. earned: a Set of ids.
  function visible(trophy, filters, earned) {
    if (!matchesKind(trophy, filters.kind)) return false;
    if (filters.grade !== 'all' && trophy.grade !== filters.grade) return false;
    return matchesStatus(earned.has(trophy.id), filters.status);
  }

  // Story trophies hide their name, description and guide until earned, while the spoiler setting is on.
  function isHidden(trophy, earned, spoilerOn) {
    return spoilerOn === true && trophy.kind === 'story' && !earned.has(trophy.id);
  }

  // Counts for the progress line and the grade breakdown.
  function summary(trophies, earned) {
    var out = { total: trophies.length, earned: 0, byGrade: {}, storyEarned: 0, storyTotal: 0 };
    GRADE_ORDER.forEach(function (g) { out.byGrade[g] = { total: 0, earned: 0 }; });
    trophies.forEach(function (t) {
      var got = earned.has(t.id);
      if (got) out.earned += 1;
      var g = out.byGrade[t.grade];
      if (g) {
        g.total += 1;
        if (got) g.earned += 1;
      }
      if (t.kind === 'story') {
        out.storyTotal += 1;
        if (got) out.storyEarned += 1;
      }
    });
    out.percent = out.total === 0 ? 0 : Math.round((out.earned / out.total) * 100);
    return out;
  }

  // Roadmap: stages in order, each with its trophies in the stage's listed order.
  function roadmap(data, earned) {
    var byId = {};
    data.trophies.forEach(function (t) { byId[t.id] = t; });
    return data.stages.map(function (s) {
      var items = s.ids.map(function (id) { return byId[id]; });
      var done = items.filter(function (t) { return earned.has(t.id); }).length;
      return { id: s.id, title: s.title, summary: s.summary, items: items, done: done, total: items.length, complete: done === items.length };
    });
  }

  // The first trophy in roadmap order that is not yet earned, or null when the list is complete.
  function nextUp(data, earned) {
    var stages = roadmap(data, earned);
    for (var i = 0; i < stages.length; i++) {
      for (var j = 0; j < stages[i].items.length; j++) {
        if (!earned.has(stages[i].items[j].id)) return stages[i].items[j];
      }
    }
    return null;
  }

  ns.rules = {
    KIND_LABELS: KIND_LABELS,
    GRADE_ORDER: GRADE_ORDER,
    matchesKind: matchesKind,
    visible: visible,
    isHidden: isHidden,
    summary: summary,
    roadmap: roadmap,
    nextUp: nextUp,
  };
})(window.GTA6 = window.GTA6 || {});
