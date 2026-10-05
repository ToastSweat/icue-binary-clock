/* Uses only local assets and the system clock. No network, sensor plugins or storage. */
(function () {
  const core = window.BinaryClockCore;
  const board = document.getElementById('board');
  const root = document.documentElement;
  const time = document.getElementById('time');
  const period = document.getElementById('period');
  const encoding = document.getElementById('encoding');
  let settings = core.normalizeSettings();
  let signature = '';
  let bits = [];
  let lastText = '';
  let timer = null;
  let disposed = false;

  function readProperty(name) {
    // Names come exclusively from the hard-coded defaults, never user input.
    if (!Object.prototype.hasOwnProperty.call(core.defaults, name)) return undefined;
    if (Object.prototype.hasOwnProperty.call(window, name)) {
      const value = window[name];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    try {
      // Compatibility with iCUE-injected lexical globals (not always window properties).
      return Function('return typeof ' + name + ' !== "undefined" ? ' + name + ' : undefined')();
    } catch (_) { return undefined; }
  }

  function setToken(name, value) { root.style.setProperty(name, String(value)); }

  function applySettings() {
    const input = {};
    Object.keys(core.defaults).forEach(name => { input[name] = readProperty(name); });
    settings = core.normalizeSettings(input);
    setToken('--text-color', settings.textColor);
    setToken('--accent-color', settings.accentColor);
    setToken('--background-color', settings.backgroundColor);
    // Standard iCUE page/widget personalization value, matching bundled Corsair clocks.
    setToken('--widget-opacity', settings.transparency / 100);
    setToken('--off-color', settings.offColor);
    setToken('--brightness', settings.brightness / 100);
    const cell = 9 * settings.blockSize / 100;
    const gap = cell * settings.blockGap / 100;
    const groupGap = cell * settings.groupGap / 100;
    const groups = settings.showSeconds ? 3 : 2;
    const columns = settings.clockMode === 'bcd' ? 2 : 1;
    const rows = settings.clockMode === 'bcd' ? 4 : 6;
    const textOn = settings.textEnabled;
    const labels = textOn && settings.showLabels;
    const numbers = textOn && settings.showNumbers;
    const weights = textOn && settings.showWeights;
    const padding = labels || numbers ? 5 : 2;
    const groupWidth = Math.max(labels ? 12 : 0, columns * cell + (columns - 1) * gap);
    const matrixHeight = rows * cell + (rows - 1) * gap;
    const minimumWidth = labels ? 48 : numbers ? 44 : 0;
    const headerHeight = labels ? 7 : 0;
    const readoutHeight = numbers ? 12 : 0;
    const groupLabelHeight = labels ? 5 : 0;
    setToken('--cell-factor', cell);
    setToken('--gap-factor', gap);
    setToken('--group-gap-factor', groupGap);
    setToken('--padding-factor', padding);
    setToken('--group-min-width-factor', labels ? 12 : 0);
    // Reserve space only for visible text. No-text portrait layouts can grow beyond the text baseline.
    setToken('--portrait-limit', labels || numbers ? '6.96px' : '100000px');
    // CSS owns orientation; both layout budgets fit all slider settings without clipping.
    setToken('--landscape-width', Math.max(minimumWidth, groups * groupWidth + (groups - 1) * groupGap + padding * 2));
    setToken('--landscape-height', matrixHeight + groupLabelHeight + headerHeight + readoutHeight + padding * 2);
    setToken('--portrait-width', Math.max(minimumWidth, matrixHeight + padding * 2));
    setToken('--portrait-height', groups * (columns * cell + (columns - 1) * gap + groupLabelHeight) + (groups - 1) * groupGap + headerHeight + readoutHeight + padding * 2);
    document.body.dataset.mode = settings.clockMode;
    document.body.dataset.numbers = String(numbers);
    document.body.dataset.labels = String(labels);
    document.body.dataset.weights = String(weights);
    encoding.textContent = settings.clockMode === 'bcd' ? '/ BCD' : '/ BINARY';
    draw();
  }

  function buildBoard(model) {
    const fragment = document.createDocumentFragment();
    bits = [];
    model.groups.forEach(group => {
      const section = document.createElement('section');
      section.className = 'group';
      const label = document.createElement('div');
      label.className = 'group-label';
      label.textContent = group.label;
      const columns = document.createElement('div');
      columns.className = 'columns';
      group.columns.forEach(column => {
        const digit = document.createElement('div');
        digit.className = 'digit';
        column.bits.forEach((value, index) => {
          const block = document.createElement('div');
          block.className = 'bit';
          block.dataset.weight = String(model.weights[index]);
          const weight = document.createElement('span');
          weight.className = 'weight';
          weight.textContent = String(model.weights[index]);
          block.appendChild(weight);
          digit.appendChild(block);
          bits.push(block);
        });
        columns.appendChild(digit);
      });
      section.append(label, columns);
      fragment.appendChild(section);
    });
    board.replaceChildren(fragment);
  }

  function draw() {
    const model = core.buildClock(new Date(), settings);
    const nextSignature = settings.clockMode + ':' + model.groups.length;
    if (signature !== nextSignature) {
      buildBoard(model);
      signature = nextSignature;
    }
    let index = 0;
    model.groups.forEach(group => group.columns.forEach(column => column.bits.forEach(value => {
      const block = bits[index++];
      block.classList.toggle('on', value === 1);
      block.dataset.value = String(value);
    })));
    const nextText = model.text + (model.period ? ' ' + model.period : '');
    if (nextText !== lastText) {
      time.textContent = model.text;
      period.textContent = model.period;
      lastText = nextText;
    }
    board.setAttribute('aria-label', nextText + ', ' + (settings.clockMode === 'bcd' ? 'digit-by-digit binary' : 'whole-value binary'));
  }

  function tick() {
    timer = null;
    if (disposed || document.hidden) return;
    draw();
    // Re-sample the wall clock every second: no accumulated drift after sleep or time changes.
    timer = setTimeout(tick, 1000 - Date.now() % 1000 + 15);
  }

  function start() {
    disposed = false;
    applySettings();
    if (timer === null && !document.hidden) tick();
  }

  function stop() {
    disposed = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  window.AtomicBinaryClockRuntime = { start, applySettings };
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else start();
  });
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', start);
  // Browser preview also uses the real system time. Late iCUE initialization updates settings.
  start();
})();
