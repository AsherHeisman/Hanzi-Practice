export function validateBook(data) {
  const fail = message => { throw new Error(message); };
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  function list(value, name, max) { if (!Array.isArray(value) || value.length > max) fail(`${name} must be an array of at most ${max} items.`); }
  function text(value, name, max, required = true) {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`${name} must be ${required ? 'non-empty ' : ''}text, at most ${max} characters.`);
    return value;
  }
  const ids = new Set();
  function base(value, name) {
    if (!object(value)) fail(`${name} must be an object.`);
    const id = text(value.id, `${name} ID`, 100);
    if (!/^[\w-]+$/.test(id) || ids.has(id)) fail('IDs must be unique and contain only letters, numbers, underscores or hyphens.');
    ids.add(id);
    return { id, title: text(value.title, `${name} title`, 250) };
  }
  if (!object(data)) fail('The textbook must be a JSON object.');
  list(data.units, 'Units', 100);
  return { units: data.units.map(unit => {
    const u = base(unit, 'Unit');
    list(unit.chapters, 'Chapters', 100);
    u.chapters = unit.chapters.map(chapter => {
      const c = base(chapter, 'Chapter');
      list(chapter.sections, 'Sections', 100);
      c.sections = chapter.sections.map(section => {
        const s = base(section, 'Section');
        for (const key of ['sentence', 'translation']) if (section[key] !== undefined) s[key] = text(section[key], key, 2000, false);
        list(section.characters, 'Vocabulary', 500);
        s.characters = section.characters.map(word => {
          if (!object(word)) fail('Every vocabulary entry must be an object.');
          const w = { char: text(word.char, 'Character / word', 20), pinyin: text(word.pinyin, 'Pinyin', 150, false), meaning: text(word.meaning, 'Meaning', 1000, false) };
          if (!/\p{Script=Han}/u.test(w.char) || !/^[\p{Script=Han}A-Za-z\s]+$/u.test(w.char)) fail('Vocabulary must contain Chinese characters; Latin letters and spaces are also allowed for words such as T 恤衫.');
          for (const key of ['sentence', 'translation']) if (word[key] !== undefined) w[key] = text(word[key], key, 2000, false);
          return w;
        });
        return s;
      });
      return c;
    });
    return u;
  }) };
}
