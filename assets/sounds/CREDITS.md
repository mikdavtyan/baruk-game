# Sound credits

Every file here comes from a source that is free for commercial use. All sources are
**CC0 1.0 (public domain dedication)**, so no attribution is legally required. They are
credited anyway so the source of each file can be traced.

All files are mono, 44.1 kHz MP3 (64 kbps, win.mp3 96 kbps). Each one had its leading
silence trimmed so it starts within about 2 ms, got a short fade-in (0.5 to 2 ms) and
a fade-out tail to avoid clicks, and was peak-normalized to about -3 to -6 dBFS. The
processing was done with PyAV (FFmpeg/libmp3lame) and numpy.

| File | Used for | Source | Author | License | Changes |
|---|---|---|---|---|---|
| `key.mp3` | Keyboard key tap | Kenney "Interface Sounds" 1.0, `drop_002.ogg`. https://kenney.nl/assets/interface-sounds | Kenney (www.kenney.nl) | CC0 1.0 | Trimmed to 75 ms, 25 ms fade-out, normalized, converted OGG to MP3 |
| `flip.mp3` | Tile flip | Kenney "Casino Audio", `card-place-1.ogg`. https://kenney.nl/assets/casino-audio | Kenney | CC0 1.0 | Started at the card snap, trimmed to 150 ms, faded, normalized, converted |
| `invalid.mp3` | Invalid-word shake | Kenney "Interface Sounds" 1.0, `error_006.ogg` | Kenney | CC0 1.0 | Trimmed leading silence and tail (230 ms), faded, normalized, converted |
| `coin.mp3` | Coin landing | Freesound #558992 "coins-falling-013.wav" (one coin dropped on another). https://freesound.org/people/Gerent/sounds/558992/ | Gerent | CC0 1.0 | Made from the Freesound HQ preview MP3, not the original WAV. Trimmed to the first clink (280 ms), 100 ms fade-out, normalized to -6 dBFS, downmixed to mono |
| `tab.mp3` | Tab switch | Kenney "Interface Sounds" 1.0, `back_002.ogg` | Kenney | CC0 1.0 | Trimmed (70 ms), faded, normalized, converted |
| `claim.mp3` | Task reward claim | Kenney "Interface Sounds" 1.0, `confirmation_002.ogg` (rising chime) layered with `glass_004.ogg` (sparkle, -13 dB, +100 ms) | Kenney | CC0 1.0 | Two files mixed, trimmed to 484 ms, 120 ms fade-out, normalized, converted |
| `button.mp3` | Generic button press | Kenney "Interface Sounds" 1.0, `pluck_001.ogg` | Kenney | CC0 1.0 | Trimmed (93 ms), faded, normalized, converted |
| `win.mp3` | Win jingle (kanun phrase over a duduk drone) | Kanun notes: Freesound #211133 "kanun_moderate_Chromatic_moreIsolated.mp3". https://freesound.org/people/barisbozkurt/sounds/211133/ . Duduk: Freesound #479213 "duduk C3". https://freesound.org/people/blood_of_a_pomegranate/sounds/479213/ | barisbozkurt (kanun); blood_of_a_pomegranate (duduk) | CC0 1.0 (both) | Made from the Freesound HQ preview MP3s. A new phrase was composed from single recorded kanun notes: a quick C5-E5-G5-C6 run, then A5-C6, ending on a strummed C5/G5/C6 chord. A duduk C3 note sits under it at about -11 dB with a 150 ms swell. Added a light short-delay room effect and a 1.1 s fade-out. Total 2.9 s, normalized to -3 dBFS, mono, 96 kbps |
| `lose.mp3` | Loss | Kanun notes from Freesound #211133 (as above) | barisbozkurt | CC0 1.0 | Composed a gentle descending G5-E5-C5 phrase from single kanun notes. Light room effect, 0.5 s fade-out, 1.15 s total, normalized to -4.5 dBFS |

## License texts

- CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/
- Kenney packs: each pack's `License.txt` says the content is "free to use in personal,
  educational and commercial projects" (CC0). Crediting Kenney is optional.
- Each Freesound page listed above shows "Creative Commons 0" as its license (checked 2026-10-12).
