# RaceMarket RMGPT6 — repaired GLB integration

This release is based on the Studio 5 ZIP supplied previously, with the optional animated GLB model integrated directly into `index.html`.

## What changed
- The renderer control is static HTML and always visible, even if JavaScript imports fail.
- GLB rendering is attempted automatically at startup.
- When active, the old WebGL horse canvas/overlay is hidden (not drawn over the new model).
- The button toggles between the GLB and the original renderer.
- Failed loading preserves the original view and shows an error message.
- Relative `./assets/horses/thoroughbred-jockey.glb` path works under GitHub Pages project subpaths.

## GitHub Pages installation
Upload the CONTENTS of this ZIP to the repository root, replacing existing files. Verify that `index.html`, `rigged-race.js`, and `assets/horses/thoroughbred-jockey.glb` are committed in the same branch/folder served by Pages. Do not upload the ZIP as a single file.

The optional Three.js imports use jsDelivr CDN, so this mode needs internet access. The original WebGL renderer remains the fallback.

## Realism / known limitations
The included GLB is a small stylized procedural horse with 13 bones and four animation clips. It is not photorealistic. Existing Free camera interaction and the original renderer's label overlay do not automatically transfer to the GLB scene. This release fixes activation and visual switching, not the asset's fundamental fidelity.

## Testing
`node --check rigged-race.js` passed. Browser/GPU testing and GitHub deployment were not performed here.
