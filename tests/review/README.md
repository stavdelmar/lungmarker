# Review screen tests (no engine)

    node --import ./tests/export/register.mjs tests/review/maskEdit.test.mjs    # erase brush + draw outline geometry
    node --import ./tests/export/register.mjs tests/review/slicePatch.test.mjs  # what is saved: outline per slice, axes, volume, trail

They run the app's own code from `src/lib` (the Review page calls the same functions).
Not covered: the mouse handling in the browser (needs scan images from the engine's demo folder).
