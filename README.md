# Atomic Binary Clock

A native CORSAIR iCUE widget for the XENEON EDGE. Square lit blocks, outlined unlit blocks, no rounded corners, no animation, and a purple default palette intended to complement the Atomic Purple display.

## Install

1. Use **iCUE 5.47 or later**, with the XENEON EDGE connected.
2. In the XENEON EDGE Widgets panel, click **+** and select `atomic-binary-clock-v1.1.2.icuewidget` from this project folder.
3. Add **Atomic Binary Clock** to a widget slot.
4. Select the widget and adjust **Clock Settings** and **Widget Personalization** in iCUE. Enable the XENEON EDGE **Custom Style** switch to use the widget's purple defaults or your own colors instead of the device-wide theme.

These are native iCUE widget controls, not controls in the monitor's physical OSD. Nothing modifies your current iCUE profiles or display layout automatically.

## Controls

| Control | Default | Options |
| --- | --- | --- |
| Binary mode | Digit by digit (BCD) | BCD / whole values (binary) |
| Time format | 24 hour | 12 / 24 hour |
| Time zone | System local time | Local / UTC |
| Show seconds | On | On / off |
| Show text (master toggle) | On | On / off |
| Show numeric time | On | On / off |
| Show labels | On | On / off |
| Show bit weights | Off | On / off |
| Text color | `#F0E8FF` | Color picker |
| Lit block color | `#B784FF` | Color picker |
| Background color | `#100D16` | Color picker |
| Widget Transparency | 80% | Standard iCUE page/widget property; background only |
| Unlit block color | `#292132` | Color picker (outline color) |
| Block size | 100% | 50–125% |
| Block spacing | 14% | 0–30% of block size |
| Group spacing | 45% | 0–80% of block size |
| Lit block brightness | 100% | 20–100% opacity, not monitor hardware brightness |

Changes apply immediately; iCUE owns settings persistence. Turn **Show text** off to hide the title, group labels, numeric time, AM/PM and bit weights together. The squares automatically enlarge into the freed space, with smaller outer margins and no portrait text-size cap. Turn it back on to restore the individual text switches; their values are preserved. The individual labels and numeric-time switches also release their reserved layout space when disabled. Blocks remain square and fit the slot at every size/spacing setting.

## Page background transparency

Version 1.1.2 declares and consumes the standard **transparency** property used by CORSAIR's bundled clocks, so it can receive the resolved **Pages → Personalization → Widget Transparency** value through iCUE. Changes apply on `onDataUpdated`. The document canvas is transparent; only a separate background layer fades. Squares, text, outlines and the independent lit-block brightness setting are not faded by this control.

The underlying property follows CORSAIR's existing mapping: background opacity is the supplied percentage divided by 100. Do not invert it based on the slider label. Browser preview defaults to 80%. If widget-level Custom Style is overriding page styling, try disabling that override when testing the page-wide slider.

A checkerboard wallpaper fixture in `tests/fixtures/transparency-preview.html` verifies fully transparent, partial and opaque backgrounds. Screenshot pixel checks confirm the wallpaper shows through at zero, the background blends at halfway, and lit-square pixels stay identical. The fixture is not part of the installable widget.

## Reading the clock

**BCD:** hours, minutes and seconds each have a pair of four-bit digit columns. Add the weights of lit blocks: 8, 4, 2, 1 from top to bottom. `23:59:47` appears as the six separate digits 2, 3, 5, 9, 4 and 7.

**Whole values:** each time component has one six-bit column. Add lit weights 32, 16, 8, 4, 2, 1 to recover the entire hour, minute or second value.

Tall portrait slots stack the groups and turn each column into a horizontal row. Read highest-to-lowest weights from **left to right** there. Turn on **Show bit weights** while learning. All leading zero bits are retained for a consistent block matrix.

## Compatibility

Only `dashboard_lcd` is declared. Browser layout coverage:

- Landscape: 840×344, 840×696, 1688×696, 2536×696.
- Portrait: 696×416, 696×840, 696×1688, 696×2536.

The clock uses your PC's actual local time and daylight-saving rules, or UTC. It samples wall time each second, so PC sleep and clock corrections do not accumulate drift. It works offline and makes no network requests. No account, API key, plugin, additional background app, or local web server is required.

**Verification:** automated clock/settings and metadata tests, including the document-prefix XML import regression; 48 general browser layout checks plus 192 text-on/off layout checks across both modes, all eight slots, with and without seconds, and minimum/default/maximum layout settings; 96 comparisons verify text off produces larger, still-square blocks without changing binary values. Master off/on and individual text switches update immediately. Live settings simulation includes window and lexical globals; midnight rollover, no browser errors/network requests, and official CLI validation/packaging are checked.

**Hardware status:** previous clock versions work on the physical device. Version 1.1.2 adds the standard iCUE transparency property and background-only composition while preserving the Show text toggle and automatic enlargement. Its window/lexical property updates, rendering and screenshot pixels are verified in the browser simulator, using the same value mapping as the installed first-party clocks. The actual page-personalization slider still needs user confirmation after import.

## Files

- `atomic-binary-clock-v1.1.2.icuewidget`: updated installable widget; import this version.
- `atomic-binary-clock.icuewidget`: identical current package under the CLI output name.
- `atomic-binary-clock-v1.0.1.icuewidget`: previous working package, preserved as a fallback.
- `widget/`: complete runtime source.
- `widget/index.html`: browser preview (open directly; uses live system time and defaults).
- `verification/`: browser screenshots and test summary. Screenshot times are controlled test fixtures, not claims about current time.
- `tests/`: repeatable unit, metadata, and browser tests.

## Development

Node.js is needed only for development, not for using the widget.

```sh
npm ci --include=dev
npm test
npm run test:browser
npm run validate
npm run package:widget
```

If Playwright's Chromium is not already installed, run `npx playwright install chromium`. The CLI and browser dependencies are pinned by `package-lock.json`.

Official API documentation: https://docs.elgato.com/icue/widgets/
