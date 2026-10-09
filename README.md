# Take Audition — Canvas v0.0

A first browser-based touch prototype for independent audio Takes. This is an experiment, not yet a dependable audio-editing application.

## How to try
Open `index.html` in a modern browser or host these three files on a static HTTPS website. In iPad landscape Safari, tap **+ Add WAVs**, choose a few short WAVs, tap a waveform, and press Play.

## Implemented
- Browser-local audio decoding, waveform drawing, and single-Take playback
- Tap to cue, pending cue while playing (Stop switches to pending Take)
- Drag ⇆ on each Take to adjust its visual horizontal alignment
- Pin one Take while vertically scrolling others; Focus current/pinned Take
- Basic Fit/zoom buttons and numbered point markers

## Not implemented yet
Persistent projects, BWF timestamps, folder/cloud watching, waveform caching, true pinch/two-finger gestures, vertical reorder, selection handles, I/O markers, Edit/EDL, Pro Tools export.

## Important limitations
Files are decoded fully into memory. Begin with a handful of short audio files, not hour-long recordings. Nothing is uploaded or saved; refreshing the page clears the project. Pinning only fixes vertical scroll position. The canvas has no shared time ruler: horizontal Take offsets never change source audio time.

## GitHub upload
Unzip the provided archive in iPad Files, then upload **index.html**, **app.js**, and **README.md** individually into the root of the `take-audition` repository through **Add file → Upload files**. GitHub does not automatically unpack ZIP files. Do not commit your audio files.
