(() => {
  const storageKey = 'tapmania-friends-v1';
  const modes = ['classic', 'extreme'];
  const medals = [
    { id: 'shield', icon: '🛡️', name: 'A prueba de errores', goal: 'Consigue tu primer escudo' },
    { id: 'boss', icon: '🍳', name: 'Chef exprés', goal: 'Completa un jefe de cocina' },
    { id: 'streak', icon: '🔥', name: 'En llamas', goal: 'Encadena 15 aciertos' },
    { id: 'extreme', icon: '⚡', name: 'Mecha corta', goal: 'Consigue 2.000 puntos en Extremo' },
    { id: 'survivor', icon: '🏆', name: 'Último en pie', goal: 'Sobrevive 30 segundos en Extremo' }
  ];
  const get = id => document.getElementById(id);
  const read = key => {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };
  function valid(row) {
    return row && typeof row.id === 'string' && /^[a-f0-9-]{36}$/i.test(row.id) &&
      typeof row.name === 'string' && row.name.trim().length > 0 && row.name.length <= 24 &&
      Number.isSafeInteger(row.score) && row.score > 0;
  }
  function merge(...lists) {
    const unique = new Map();
    for (const row of lists.flat()) {
      if (!valid(row)) continue;
      const previous = unique.get(row.id);
      if (!previous || row.score >= previous.score) {
        unique.set(row.id, { id: row.id, name: row.name.trim(), score: row.score });
      }
    }
    return [...unique.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 10);
  }
  const saved = read(storageKey);
  const ranks = Object.fromEntries(modes.map(mode => [mode, merge(Array.isArray(saved?.[mode]) ? saved[mode] : [])]));
  const profile = read('tapmania-profile') || {
    id: globalThis.crypto?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const n = Math.floor(Math.random() * 16);
      return (c === 'x' ? n : (n & 3) | 8).toString(16);
    }),
    name: ''
  };
  write('tapmania-profile', profile);
  const collected = new Set(read('tapmania-medals') || []);
  const status = get('rankStatus');
  let activeMode = 'classic';

  function render() {
    const rankList = get('rankList');
    rankList.replaceChildren();
    for (const player of ranks[activeMode]) {
      const row = document.createElement('li');
      const name = document.createElement('span');
      const points = document.createElement('strong');
      name.textContent = player.name + (player.id === profile.id ? ' (tú)' : '');
      points.textContent = player.score.toLocaleString('es');
      row.append(name, points);
      rankList.append(row);
    }
    get('rankEmpty').hidden = rankList.childElementCount > 0;
    get('rankMedals').replaceChildren(...medals.map(medal => {
      const item = document.createElement('li');
      item.textContent = (collected.has(medal.id) ? medal.icon : '🔒') + ' ' + medal.name + ' · ' + medal.goal;
      return item;
    }));
    get('copyRank').disabled = !ranks[activeMode].length;
  }

  function importRanking() {
    const fragment = new URLSearchParams(location.hash.slice(1));
    const incoming = fragment.get('liga');
    if (!incoming || incoming.length > 8000) return;
    try {
      const data = JSON.parse(incoming);
      if (!modes.includes(data.mode) || !Array.isArray(data.rows)) return;
      ranks[data.mode] = merge(ranks[data.mode], data.rows);
      write(storageKey, ranks);
      activeMode = data.mode;
      get('rankMode').value = activeMode;
      status.textContent = 'Ranking de amigos combinado.';
      get('ranking').open = true;
      history.replaceState(null, '', location.pathname + location.search);
      render();
    } catch {}
  }

  function addResult(score) {
    if (score <= 0 || !profile.name) return;
    const previous = ranks[activeMode].find(row => row.id === profile.id);
    ranks[activeMode] = merge(ranks[activeMode], [{ id: profile.id, name: profile.name, score: Math.max(score, previous?.score || 0) }]);
    write(storageKey, ranks);
    render();
  }

  get('playerName').value = profile.name || '';
  get('rankMode').addEventListener('change', event => {
    activeMode = event.target.value;
    status.textContent = '';
    render();
  });
  get('copyRank').addEventListener('click', async () => {
    const url = new URL(location.href);
    url.search = '';
    url.hash = new URLSearchParams({ liga: JSON.stringify({ mode: activeMode, rows: ranks[activeMode] }) });
    try {
      await navigator.clipboard.writeText(url.href);
      status.textContent = 'Enlace copiado. Pide a tus amigos que compartan su ranking actualizado.';
    } catch {
      const field = get('rankLink');
      field.hidden = false;
      field.value = url.href;
      field.select();
      status.textContent = 'Copia este enlace y envíalo a tus amigos.';
    }
  });
  window.addEventListener('hashchange', importRanking);
  render();
  importRanking();

  window.tapmaniaRewards = {
    unlock(id) {
      if (collected.has(id)) return false;
      collected.add(id);
      write('tapmania-medals', [...collected]);
      const medal = medals.find(item => item.id === id);
      get('rewardToast').textContent = medal.icon + ' Medalla: ' + medal.name;
      render();
      return true;
    },
    register(mode, score) {
      activeMode = mode;
      get('rankMode').value = mode;
      addResult(score);
      render();
      get('saveScore').disabled = score <= 0;
      get('saveScore').onclick = () => {
        const field = get('playerName');
        const name = field.value.trim();
        if (!name) { field.focus(); status.textContent = 'Escribe tu apodo para guardar el resultado.'; return; }
        profile.name = name;
        write('tapmania-profile', profile);
        activeMode = mode;
        get('rankMode').value = mode;
        addResult(score);
        status.textContent = score > 0 ? 'Resultado registrado.' : 'Consigue puntos para entrar en el ranking.';
      };
    }
  };
})();
