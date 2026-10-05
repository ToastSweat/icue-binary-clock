(function (root) {
  'use strict';
  function buildClock(date, settings = {}) {
    const utc = settings.timeZone === 'utc';
    const rawHour = utc ? date.getUTCHours() : date.getHours();
    const hour = settings.hourFormat === '12' ? rawHour % 12 || 12 : rawHour;
    const values = [hour, utc ? date.getUTCMinutes() : date.getMinutes()];
    if (settings.showSeconds !== false) values.push(utc ? date.getUTCSeconds() : date.getSeconds());
    const period = settings.hourFormat === '12' ? (rawHour < 12 ? 'AM' : 'PM') : '';
    const weights = settings.clockMode === 'binary' ? [32, 16, 8, 4, 2, 1] : [8, 4, 2, 1];
    const labels = ['HOURS', 'MINUTES', 'SECONDS'];
    const padded = values.map(value => String(value).padStart(2, '0'));
    return {
      text: padded.join(':'), period, weights,
      groups: values.map((value, index) => ({
        label: labels[index], value,
        columns: (settings.clockMode === 'binary' ? [value] : [...padded[index]].map(Number)).map(number => ({
          value: number, bits: weights.map(weight => Number(Boolean(number & weight)))
        }))
      }))
    };
  }
  const defaults = Object.freeze({
    clockMode: 'bcd', hourFormat: '24', timeZone: 'local', showSeconds: true,
    textEnabled: true, showNumbers: true, showLabels: true, showWeights: false,
    textColor: '#F0E8FF', accentColor: '#B784FF', backgroundColor: '#100D16', offColor: '#292132',
    transparency: 80, blockSize: 100, blockGap: 14, groupGap: 45, brightness: 100
  });
  function normalizeSettings(input = {}) {
    const settings = { ...defaults };
    const selections = { clockMode: ['bcd', 'binary'], hourFormat: ['12', '24'], timeZone: ['local', 'utc'] };
    const ranges = { transparency: [0, 100], blockSize: [50, 125], blockGap: [0, 30], groupGap: [0, 80], brightness: [20, 100] };
    for (const key of Object.keys(defaults)) {
      const value = input[key];
      if (value === undefined || value === null || value === '') continue;
      if (selections[key]) {
        if (selections[key].includes(String(value))) settings[key] = String(value);
      } else if (ranges[key]) {
        const number = Number(value);
        if (Number.isFinite(number)) settings[key] = Math.min(ranges[key][1], Math.max(ranges[key][0], number));
      } else if (typeof defaults[key] === 'boolean') {
        if ([true, 1, 'true', '1'].includes(value)) settings[key] = true;
        if ([false, 0, 'false', '0'].includes(value)) settings[key] = false;
      } else if (typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) {
        settings[key] = value;
      }
    }
    return settings;
  }
  const api = { buildClock, normalizeSettings, defaults };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BinaryClockCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
