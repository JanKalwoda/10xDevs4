# Phase 2 timer UI evidence

Bounds are browser getBoundingClientRect() values in CSS pixels. In every row, the same section stayed mounted while the pointer remained over the right target through ACTIVE to PAUSED to RESUMING. Pause, Resume, and pending Resume measured the same 48x48 rectangle.

| Theme | Viewport | ACTIVE | PAUSED | RESUMING | Result |
| --- | --- | --- | --- | --- | --- |
| light | 1280x900 | {"x":902.984375,"y":581,"width":48,"height":48} | {"x":902.984375,"y":581,"width":48,"height":48} | {"x":902.984375,"y":581,"width":48,"height":48} | PASS |
| light | 390x844 | {"x":300.984375,"y":621,"width":48,"height":48} | {"x":300.984375,"y":621,"width":48,"height":48} | {"x":300.984375,"y":621,"width":48,"height":48} | PASS |
| dark | 1280x900 | {"x":902.984375,"y":581,"width":48,"height":48} | {"x":902.984375,"y":581,"width":48,"height":48} | {"x":902.984375,"y":581,"width":48,"height":48} | PASS |
| dark | 390x844 | {"x":300.984375,"y":621,"width":48,"height":48} | {"x":300.984375,"y":621,"width":48,"height":48} | {"x":300.984375,"y":621,"width":48,"height":48} | PASS |

Cancel stayed enabled and accessibly named in all three states. The combined audio and Wake Lock warnings remained visible in each state. Hover changed the control background; keyboard Tab produced focus-visible. Completed is empty/N/A because phase: null routes to Completed and renders no timer control bar.

Screenshots in this folder: default, hover, focus-visible, disabled (pending Resume), error, empty-na, loading, and paused for each theme and viewport.
