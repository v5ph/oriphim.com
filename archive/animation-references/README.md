# Shape animation references

Source animations supplied on 2026-08-25 and retained as the design references for the homepage voxel morph.

- `voxel-tesseract`: sampled edges of a rotating 4D hypercube, projected into 3D with `D4 = 2.6`, `W_RATE = 0.155`, and `XY_RATE = 0.063`.
- `tetrahedron-solid`: 64 tetrahedra arranged as eight star-tetrahedron units, rendered with backface culling, z-buffering, and deterministic fluid shading.

The integrated homepage animation uses their defining geometry in the existing shared voxel renderer so the sphere, tesseract, and tetrahedron transition continuously without canvas crossfades.
