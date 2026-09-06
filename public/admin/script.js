async function renderDashboard() {
  if (!document.getElementById('admin-stats')) return;
  const message = document.getElementById('admin-message');
  try {
    const session = await getAdminSession();
    const books = await loadAllBooks();
    const totals = { units: 0, chapters: 0, sections: 0, words: 0 };
    for (const { book, data } of books) {
      const stats = bookStats(data);
      Object.keys(totals).forEach(key => totals[key] += stats[key]);
      const row = el('div', { class: 'admin-book' }, [el('div', {}, [el('h3', { text: book.label }), el('p', { text: `${stats.units} units · ${stats.sections} sections · ${stats.words} words` })]), el('a', { class: 'button secondary', href: `/admin/editor?book=${book.id}`, text: 'Edit' }, [icon('arrow')])]);
      document.getElementById('admin-books').appendChild(row);
    }
    for (const [key, label] of [['units', 'Units'], ['chapters', 'Chapters'], ['sections', 'Sections'], ['words', 'Vocabulary entries']]) document.getElementById('admin-stats').appendChild(el('div', { class: 'stat' }, [el('strong', { text: totals[key].toLocaleString() }), el('span', { text: label })]));
    document.getElementById('session-note').textContent = `This session locks at ${new Date(session.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. PIN resets are disabled.`;
    message.textContent = '';
  } catch (error) { message.textContent = error.message; }
}
renderDashboard();

document.addEventListener('DOMContentLoaded', mountSiteChrome);
