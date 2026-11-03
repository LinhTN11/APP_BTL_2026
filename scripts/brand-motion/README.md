# Gặp wordmark motion

Authored and exported with EffectCraft CLI 0.10.0. Composition: 300×120, 60 fps, 2.2 seconds. The correctly shaped Baloo 2 ExtraBold word holds, converges to center, and reaches zero scale at frame 66. The coral loop begins at frame 67; the plum loop follows four frames later; the coral diacritic dot lands last. The final mark holds through the end.

The editable project keeps one whole-word text layer. The Lottie JSON is exported with `textAsShapes: true`, so it contains vector outlines and no live-font dependency. Transparent PNGs are EffectCraft `render-frame` outputs: `gap-wordmark-start.png` at frame 0 and `gap-wordmark-poster.png` at 2.1 seconds.

Rebuild from repository root in PowerShell:

```powershell
$env:EFFECTCRAFT_FONT_DIRS = (Resolve-Path 'apps/mobile/assets/fonts').Path
$ec = 'C:\Program Files\EffectCraft\effectcraft-cli.exe'
& $ec --empty --save-as docs/design/gap-wordmark.ecproj script scripts/brand-motion/create_gap_wordmark.jsx
& $ec --project docs/design/gap-wordmark.ecproj render-frame --comp 'Gặp Wordmark' --time 0 --transparent --out apps/mobile/assets/brand/gap-wordmark-start.png
& $ec --project docs/design/gap-wordmark.ecproj render-frame --comp 'Gặp Wordmark' --time 2.1 --transparent --out apps/mobile/assets/brand/gap-wordmark-poster.png
```

The JSX script exports `apps/mobile/assets/brand/gap-wordmark.json` during project creation.
