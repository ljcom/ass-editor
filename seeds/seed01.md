# PROJECT SEED: Mini ASS Editor

## 1. Objective

Build a lightweight desktop subtitle editor for macOS.

Application name: Mini ASS Editor

Primary purpose:
Edit, synchronize, preview, and export ASS subtitles
while watching the corresponding video.

This is NOT intended to replace Aegisub.

Focus on:
- Simplicity
- Fast subtitle correction
- Accurate synchronization
- Minimal UI
- Offline operation

The application must run directly from VS Code
using npm run dev.

## 2. Technology Stack

Use:

- Electron
- React
- TypeScript
- Vite
- Tailwind CSS
- HTML5 Video Player
- Zustand for state management

Do not use:
- Backend server
- Database
- Cloud services
- Authentication
- External APIs

All files are processed locally.

Target platform:
- macOS Apple Silicon
- macOS Intel (if possible)

## 3. Application Layout

Use a single-window desktop application.

Layout:

+-------------------------------------------------------+
| Mini ASS Editor                Open Video  Open ASS    |
+-------------------------------------------------------+
|                                                       |
|                                                       |
|                    VIDEO PLAYER                       |
|                                                       |
|                                                       |
|                 Subtitle Overlay                      |
|                                                       |
+-------------------------------------------------------+
| ▶ 00:01:23.450  ========●============  00:30:00       |
+-------------------------------------------------------+
| Start       End         Style      Subtitle           |
+-------------------------------------------------------+
| 00:01.200   00:03.500   Default    Selamat pagi       |
| 00:03.800   00:05.600   Default    Halo Thomas        |
| 00:06.000   00:08.200   Default    Mau ke mana?       |
+-------------------------------------------------------+
| Add  Delete  Split  Merge  Offset  Save  Export       |
+-------------------------------------------------------+

Video area:
- Approximately 55% of window height.

Subtitle table:
- Approximately 35%.

Controls:
- Remaining space.

Use resizable panels.

## 4. Video Player

Support:
- MP4
- MOV
- WebM when supported by Chromium

Features:
- Play
- Pause
- Seek
- Volume
- Playback speed:
  0.5x
  0.75x
  1x
  1.25x
  1.5x
  2x

Keyboard shortcuts:

Space:
Play / Pause

Left Arrow:
Seek backward 1 second

Right Arrow:
Seek forward 1 second

Shift + Left:
Seek backward 100 milliseconds

Shift + Right:
Seek forward 100 milliseconds

Home:
Go to beginning

The video player must expose currentTime
with millisecond precision.

Use requestVideoFrameCallback where available
for synchronized subtitle preview.

## 5. Subtitle File Support

Import:

- .ass
- .ssa
- .srt
- .json (ASR transcription)

Export:

- .ass
- .srt

Use an internal normalized subtitle model.

Example:

{
  "id": "uuid",
  "start": 1.2,
  "end": 3.5,
  "text": "Selamat pagi, Thomas.",
  "style": "Default",
  "speaker": ""
}

Start and end are stored in seconds.

Use floating-point precision sufficient
for millisecond editing.

ASS export must use centisecond precision,
as required by the ASS format.

SRT export must use millisecond precision.

For ASR JSON:
- Detect common segment structures.
- Support start/end/text fields.
- Support segments nested inside an object.
- Show an informative error for unsupported formats.
- Do not silently discard unknown fields.

## 6. ASS Parser

Implement a dedicated ASS parser.

Parse:

[Script Info]

[V4+ Styles]

[Events]

Preserve:
- Script metadata
- Style definitions
- Event format definitions
- Dialogue timing
- Dialogue text
- Speaker/name
- Margins
- Effect fields
- Non-dialogue events where possible

Do not assume every ASS file uses
the same column order.

Read the Format line to determine field mapping.

ASS Dialogue text may contain commas.
Parse according to the declared field count.

Support ASS text escapes:
- \N
- \n
- \h

Support inline override tags such as:
- {\i1}
- {\b1}
- {\pos(x,y)}

Do not remove override tags during save.

For preview:
- Render basic formatting.
- Preserve unsupported formatting in the file.

Do not claim full libass compatibility.

## 7. Subtitle Table

Display columns:

Start
End
Duration
Style
Text

Features:

- Inline text editing
- Editable start time
- Editable end time
- Row selection
- Multi-row selection
- Sort by start time
- Add subtitle
- Delete subtitle
- Duplicate subtitle
- Split subtitle
- Merge adjacent subtitles

Clicking a row:
- Select subtitle.
- Seek video to subtitle start.

Double-clicking text:
- Enter edit mode.

Press Enter:
- Save edit.

Press Escape:
- Cancel edit.

Use virtualized rendering if necessary
for large subtitle files.

## 8. Auto Follow

Implement optional Auto Follow mode.

When enabled:

- Detect subtitle active at current video time.
- Highlight corresponding row.
- Scroll selected row into view.

Do not continuously steal keyboard focus
while the user is editing text.

Allow Auto Follow to be disabled.

## 9. Subtitle Timing Tools

Provide:

Set Start = Current Video Time

Set End = Current Video Time

Shift Selected:
-1000 ms
-100 ms
-10 ms
+10 ms
+100 ms
+1000 ms

Global Offset:
Shift all subtitles by specified milliseconds.

Validate:
- End must be greater than Start.
- Start cannot be negative.
- Prevent invalid timestamps.

Allow overlapping subtitles because
ASS supports simultaneous dialogue.

Do not automatically remove overlaps.

## 10. Subtitle Preview

Render subtitles over the video.

Default appearance:

- White text
- Black outline
- Bottom center
- Font size approximately 32px
- Maximum two lines preferred

Read ASS style definitions when possible.

Support basic:
- Font family
- Font size
- Primary color
- Bold
- Italic
- Alignment
- Outline
- Shadow

Use CSS for the MVP.

ASS colors use BGR notation and inverted alpha.
Convert them correctly for CSS preview.

Important:
CSS preview is an approximation.

Complex ASS effects are not required
for the first version.

## 11. Editing Workflow

Typical workflow:

1. Open video.
2. Import ASR JSON or ASS.
3. Video displays first frame.
4. Subtitle table loads.
5. Play video.
6. Current subtitle appears over video.
7. Click subtitle row to seek.
8. Correct transcription.
9. Adjust timing.
10. Save ASS.

Keep editing responsive.

Do not reload the video after subtitle edits.

## 12. File Handling

Use Electron IPC for file operations.

Electron main process:
- Open video dialog
- Open subtitle dialog
- Save subtitle dialog
- Read local subtitle files
- Write local subtitle files

Use:
- contextIsolation: true
- nodeIntegration: false
- preload script with contextBridge

Do not expose unrestricted Node.js APIs
to the renderer.

Video files should be accessed through
a secure local file loading mechanism.

Do not start an HTTP server to serve user files.

## 13. Keyboard Shortcuts

Cmd + O:
Open video

Cmd + Shift + O:
Open subtitle

Cmd + S:
Save subtitle

Cmd + Shift + S:
Save As

Cmd + Z:
Undo

Cmd + Shift + Z:
Redo

Space:
Play / Pause when not editing text

Cmd + Enter:
Set selected subtitle start to current time

Cmd + Shift + Enter:
Set selected subtitle end to current time

Delete:
Delete selected subtitle when table has focus

All shortcuts must respect text input focus.

## 14. Undo / Redo

Implement undo and redo for:

- Text edits
- Timing edits
- Add
- Delete
- Split
- Merge
- Global offset

Use an undo history.

Maximum history:
100 operations.

## 15. Unsaved Changes

Track dirty state.

Display * next to filename
when changes are unsaved.

Before closing or opening another subtitle:

- Save
- Discard
- Cancel

Use native macOS dialogs.

## 16. User Interface

Design direction:

- Clean
- Compact
- macOS desktop style
- Dark mode by default
- Minimal toolbar
- No unnecessary animations

Prioritize usable editing space.

Support resizing the window.

Minimum window size:
1000 x 700.

## 17. Project Structure

mini-ass-editor/
  package.json
  electron/
    main.ts
    preload.ts
  src/
    App.tsx
    components/
      VideoPlayer.tsx
      SubtitleOverlay.tsx
      SubtitleTable.tsx
      Toolbar.tsx
      TimingControls.tsx
    lib/
      assParser.ts
      assWriter.ts
      srtParser.ts
      srtWriter.ts
      asrParser.ts
      timecode.ts
    store/
      subtitleStore.ts
    types/
      subtitle.ts
  tests/
  README.md

The structure may be adjusted when justified.

## 18. Development Commands

Implement:

npm install

npm run dev

npm run build

npm run test

npm run dist:mac

Development mode must launch
the Electron desktop window.

Production build should generate
a macOS .app bundle.

Do not require Apple Developer signing
for local development.

Document macOS Gatekeeper limitations
for unsigned applications.

## 19. Testing

Create automated tests for:

ASS parsing:
- Standard Dialogue
- Custom Format column order
- Commas inside text
- Multiple styles
- Inline override tags
- Unicode text

Timing:
- ASS time parsing
- ASS time formatting
- SRT time parsing
- Millisecond offsets
- Negative timestamp prevention

Editing:
- Add
- Delete
- Split
- Merge
- Undo
- Redo

File roundtrip:
Import ASS -> Export ASS -> Import ASS

Verify that supported metadata
and formatting are preserved.

## 20. Development Phases

PHASE 1 — Working MVP

Implement:
- Electron project
- Video player
- ASS import
- Subtitle table
- Subtitle overlay
- Text editing
- Timing editing
- Save ASS

Ensure the complete workflow works.

PHASE 2 — Additional Formats

Implement:
- SRT import/export
- ASR JSON import
- Global offset
- Split/merge

PHASE 3 — Editing Productivity

Implement:
- Undo/redo
- Keyboard shortcuts
- Auto follow
- Multi-row editing
- Improved ASS style preview

PHASE 4 — Distribution

Implement:
- macOS .app packaging
- Application icon placeholder
- README
- Basic error handling

## 21. Important Constraints

Do not overengineer.

Do not add:
- Accounts
- Cloud sync
- AI transcription
- Translation
- Collaboration
- Database
- Subscription
- Analytics

Do not implement a complete
ASS rendering engine.

Use the simplest reliable implementation.

Prioritize functional correctness
over visual polish.

## 22. Acceptance Criteria

The MVP is complete when:

1. Application launches on macOS.
2. User can open a video.
3. User can import an ASS file.
4. Subtitles appear during playback.
5. User can edit subtitle text.
6. User can adjust timing.
7. Clicking a row seeks the video.
8. User can save a valid ASS file.
9. Saved ASS opens correctly in IINA.
10. All operations work offline.

## 23. Execution Instructions

Start implementing immediately.

Do not stop after generating a plan.

Create the actual project files.

Work incrementally.

After each phase:
- Run TypeScript checks.
- Run tests.
- Fix errors.
- Verify build.

Do not add features outside the seed
unless necessary for correctness.

Start with Phase 1.

When Phase 1 is functional,
report implementation status and
remaining limitations before
proceeding to Phase 2.