'use strict';
// Minimal robots.txt parser (RFC 9309): groups by user-agent, longest match wins,
// Allow wins ties, supports * and $ wildcards, reads Crawl-delay.

function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) { current = { agents: [], rules: [], crawlDelay: null }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') {
      if (value === '' ) continue; // empty Disallow = allow everything
      current.rules.push({ allow: key === 'allow', path: value });
    } else if (key === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }
  return { groups };
}

function groupFor(robots, userAgent) {
  const token = String(userAgent).split('/')[0].trim().toLowerCase();
  const specific = robots.groups.filter(g => g.agents.some(a => a !== '*' && token.startsWith(a)));
  if (specific.length) return merge(specific);
  const star = robots.groups.filter(g => g.agents.includes('*'));
  return star.length ? merge(star) : { rules: [], crawlDelay: null };
}

function merge(groups) {
  return {
    rules: groups.flatMap(g => g.rules),
    crawlDelay: groups.map(g => g.crawlDelay).find(d => d != null) ?? null,
  };
}

function patternToRegex(path) {
  const anchored = path.endsWith('$');
  const body = (anchored ? path.slice(0, -1) : path)
    .split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp('^' + body + (anchored ? '$' : ''));
}

function isAllowed(robots, userAgent, pathWithQuery) {
  const { rules } = groupFor(robots, userAgent);
  let best = null;
  for (const rule of rules) {
    if (!patternToRegex(rule.path).test(pathWithQuery)) continue;
    const len = rule.path.length;
    if (!best || len > best.len || (len === best.len && rule.allow)) best = { len, allow: rule.allow };
  }
  return best ? best.allow : true;
}

function crawlDelay(robots, userAgent) {
  return groupFor(robots, userAgent).crawlDelay;
}

const DENY_ALL = { groups: [{ agents: ['*'], rules: [{ allow: false, path: '/' }], crawlDelay: null }] };
const ALLOW_ALL = { groups: [] };

module.exports = { parseRobots, isAllowed, crawlDelay, DENY_ALL, ALLOW_ALL };
