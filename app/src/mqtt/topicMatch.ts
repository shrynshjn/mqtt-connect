// Standard MQTT topic-filter matching (`+` = single level, `#` = trailing multi-level,
// leading `$` topics excluded from `#`/`+` at the first level per the spec).
export function topicMatchesFilter(topic: string, filter: string): boolean {
  if (topic.startsWith('$') && !filter.startsWith('$')) return false;

  const topicSegs = topic.split('/');
  const filterSegs = filter.split('/');

  for (let i = 0; i < filterSegs.length; i++) {
    const f = filterSegs[i];
    if (f === '#') return i === filterSegs.length - 1;
    if (i >= topicSegs.length) return false;
    if (f !== '+' && f !== topicSegs[i]) return false;
  }
  return topicSegs.length === filterSegs.length;
}

export function matchingFilters(topic: string, filters: string[]): string[] {
  return filters.filter(f => topicMatchesFilter(topic, f));
}

export function isValidPublishTopic(topic: string): boolean {
  return topic.length > 0 && !topic.includes('+') && !topic.includes('#');
}

export function isValidSubscriptionFilter(filter: string): boolean {
  if (filter.length === 0) return false;
  const segs = filter.split('/');
  return segs.every((s, i) => {
    if (s === '+') return true;
    if (s === '#') return i === segs.length - 1;
    return !s.includes('+') && !s.includes('#');
  });
}
