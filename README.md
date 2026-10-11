# RaceMarket Studio 5 — Motion Foundation

## Open
Open `START-HERE.html` or `index.html`. Both contain the same standalone, offline-capable application. No external assets are needed.

## Changes applied
- Preserves the latest **New random race** and **Race setup** buttons.
- Per-runner eased transition into and out of the racing gait (`gaitBlend`).
- The horse rig's torso suspension, compression, extension, pitch and roll are attenuated during gait transitions rather than snapping immediately to full effort.
- Jockey crouch intensity follows the transition envelope.
- Retains existing skinned meshes, IK limbs, hoof-contact particles, camera modes, trading and independently finishing horses.
- Source files `horse3d-rig.js` and `race3d.js` are provided for continued development.

## Important scope note
This is a tested incremental animation-system upgrade using the project's existing **procedural skinned mesh**.
It is NOT an artist-authored `.glb` Thoroughbred, motion-captured gait, PBR texture pack, or Three.js conversion.
Producing a genuinely photorealistic rig requires professionally authored and licensed meshes,
skin weights, textures and animation clips. Do not misrepresent this release as that asset replacement.

## Future asset contract
Use a glTF 2.0 horse with consistent named bones, horse idle/canter/gallop/finish clips,
a separate rigged jockey, hoof contact markers and KTX2-compressed textures. Retarget the
existing animation state to the imported rig and preserve the current fallback renderer.
