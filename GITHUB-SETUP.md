# RaceMarket GitHub Pages — animated GLB option

This package is based on the RaceMarket Studio 5 ZIP you uploaded. It includes the generated `assets/horses/thoroughbred-jockey.glb`, an opt-in Three.js renderer, and the original application.

## Deploy
Upload the contents of this folder to the root of `nijaul/RMGPT6` (not the enclosing folder), then let GitHub Pages publish. The relative `./assets/horses/thoroughbred-jockey.glb` URL works under `/RMGPT6/`.

Open the website and press **3D MODEL · GLB** near the race window. Press **RETURN TO ORIGINAL 3D** to switch back.

## Dependencies
Three.js 0.180.0 and GLTFLoader are imported from jsDelivr using an import map. Internet access is required for this optional mode. The original renderer remains available.

## Limitations
The GLB is a small procedurally modeled, stylized horse/jockey with 13 joints and Idle, Canter, Gallop and Finish clips. It is not photorealistic or motion captured. The optional GLB camera approximates standard camera presets; Free camera orbit, labels and some environmental effects are not integrated in this mode. The main application and trading logic are unchanged.

The standalone `START-HERE.html` is the prior portable edition and does not include the new module. Use `index.html` on GitHub Pages for the GLB mode.
