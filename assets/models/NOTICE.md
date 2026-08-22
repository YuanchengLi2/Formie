# Z-Anatomy model attribution

`z-anatomy-muscles-mobile.glb` is an optimized derivative of the Z-Anatomy
human anatomy model by Kervyn and Zielinski, distributed under CC BY-SA 4.0:

- https://github.com/Z-Anatomy/Models-of-human-anatomy
- https://creativecommons.org/licenses/by-sa/4.0/

The source model includes BodyParts3D data from DBCLS, distributed under
CC BY-SA 2.1 Japan:

- https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html

The mobile-ready intermediate was published by hpfrei under CC BY-SA 4.0:

- https://github.com/hpfrei/body-anatomy-3d-viewer

For Formie, the intermediate GLB was decoded from Draco and quantized to reduce
mobile size while retaining named mesh metadata. This model file remains
licensed under CC BY-SA 4.0. No license change is applied to the surrounding
application code.

# Formie athlete body model

`formie-athlete-body.glb` is a mobile-optimized derivative of Blender Studio's
realistic male Human Base Mesh, published by Dan Ulrich under CC0 1.0:

- https://commons.wikimedia.org/wiki/File:Body_male_realistic_by_Dan_Ulrich_(CC0).stl
- https://creativecommons.org/publicdomain/zero/1.0/

For Formie, the source STL was converted to a Y-up GLB, centered, scaled, and
reduced to 100,000 triangles for real-time rendering on mobile devices. The
application applies Formie's target, supporting, and issue colors directly to
the mesh at runtime.
