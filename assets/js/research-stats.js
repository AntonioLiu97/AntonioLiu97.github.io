/* Manually maintained publication totals and dated Google Scholar citations. */
(() => {
  const root = document.querySelector('#research-stats');
  if (!root) return;
  function render(data) {
    const valid = n => Number.isSafeInteger(n) && n >= 0;
    const fields = [
      ['publications', data.publications],
      ['first-author', data.first_author_publications],
      ['citations', data.citations]
    ];
    for (const [name, value] of fields) {
      const item = root.querySelector(`[data-stat="${name}"]`);
      item.hidden = !valid(value);
      if (valid(value)) item.querySelector('strong').textContent = value.toLocaleString('en-US') + (name === 'citations' && data.citations_lower_bound ? '+' : '');
    }
    const count = fields.filter(([, value]) => valid(value)).length;
    root.hidden = count === 0;
    root.querySelector('.stats-values').style.gridTemplateColumns = `repeat(${Math.max(1, count)}, minmax(0, 1fr))`;
    const note = root.querySelector('.stats-source');
    note.hidden = !valid(data.citations);
    const stamp = data.citations_updated;
    note.querySelector('time').textContent = /^\d{4}-\d{2}-\d{2}$/.test(stamp || '')
      ? new Date(stamp + 'T12:00:00Z').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', timeZone:'UTC' }) : '';
    if (stamp) note.querySelector('time').dateTime = stamp;
  }
  async function load(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Stats unavailable');
    render(await response.json());
  }
  load('assets/data/research-stats.json').catch(() => {
    // Leave the profile links available if statistics cannot load.
  });
})();
