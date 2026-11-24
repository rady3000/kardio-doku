# Possible upgrades 2 — Viewing echo clips, cines and images inside the app

Status: **discussion notes, not approved for implementation.** Not part of
`PLAN.md`. Considered only once the app is mature. Nothing here changes the
current design (PDF → extraction → unconfirmed values → physician
confirmation).

Date of discussion: 2026-11-24

## Context

Goal: see the echocardiography clips, cine loops and still images of a study
directly in Kardio-Doku, instead of switching to the PACS viewer or the echo
machine.

Setting as in upgrade 1: private practice, existing PACS and KIS, GE Vivid S70,
Electron app on Windows, own practice and/or research use only.

## 1. Choose the depth first

There are three ways to do it, from least to most effort:

| Option | How it works | Storage in the app | Effort |
|---|---|---|---|
| **A. Open the PACS viewer from the app** | A button in the study opens the PACS's own web viewer for that exam, looked up by accession number or Study Instance UID. | None | Very low. Only works if the PACS viewer can be opened by a link. |
| **B. Fetch clips from PACS when needed** | The app asks the PACS for the study and shows it in a viewer built into the app. Clips are cached for a while, then deleted. | Temporary cache | Medium |
| **C. Vivid sends a copy to the app** | The app becomes a second DICOM destination (as for the measurements in upgrade 1). It receives every clip and stores it. | Full copy | High: the app takes on archive, backup and data-protection duties |

**Recommendation:** ask the PACS vendor about Option A first. It gives most of
the benefit for almost no work. If A isn't possible, use B. Avoid C, because
the PACS should stay the only archive of record.

## 2. Software requirements

### What the files are

- Echo clips are DICOM files, each containing many frames. They are usually
  JPEG-compressed, sometimes JPEG-LS or RLE.
- The playback speed is stored in the file (Frame Time / Cine Rate). The ECG
  trace is normally burned into the image.
- GE also exports **raw data** in a closed format that only EchoPAC can open.
  A third-party app can show the normal DICOM clips, but not the raw data.
  Strain or 3D re-analysis stays in EchoPAC.

### Building blocks (all free and open source)

- **DICOM communication and a local image store:** **Orthanc**, a small
  open-source PACS that runs in the background on the app PC. It can receive
  images (C-STORE), fetch them from the practice PACS (C-FIND / C-MOVE or
  DICOMweb), offer them through a web interface (DICOMweb), and delete old
  clips automatically. Much safer than writing the DICOM networking ourselves.
- **Viewer inside the app:** **Cornerstone3D**, the engine behind the OHIF
  viewer. It plays clips in a loop, steps frame by frame, and shows several
  clips side by side. Its decoders are WebAssembly and ship with the app, so
  no C++ compiler is needed on Windows.
- **Linking clips to the right patient:** the Study Instance UID or accession
  number from the worklist is saved in the Kardio-Doku study, so the right exam
  opens automatically.

### Information to get from the vendors

1. **PACS vendor:**
   - Can the viewer be opened by URL with an accession number?
   - Is DICOMweb (QIDO-RS / WADO-RS) supported?
   - Or classic Query/Retrieve (C-FIND / C-MOVE)?
   - Which AE title, IP address and port should the app use?
2. **GE:** the DICOM Conformance Statement for the installed Vivid S70
   software version. Only needed for Option C; it lists the compression
   formats the machine uses.

## 3. Hardware requirements

| Item | Option A | Option B | Option C |
|---|---|---|---|
| App PC | Existing PC | 16 GB RAM, SSD, 256–500 GB free for the cache | Same as B, plus always switched on, with a fixed IP address |
| Archive storage | — | — | NAS with RAID mirroring and an off-site backup |
| Network | Existing | Wired gigabit Ethernet (not Wi-Fi) | Same as B |
| Graphics card | Not needed | Not needed | Not needed |
| Monitor | A good IPS screen in a darkened room | Same | Same |

- **Storage (rough estimate):** one clip is about 2–20 MB; one full TTE is
  about 200 MB to 1 GB. At 3,000 echos a year, roughly **0.6–3 TB per year**.
  Only relevant for Option C.
- **Monitor:** DIN 6868-157 (German acceptance/constancy testing of image
  display monitors) is understood to cover X-ray imaging, not ultrasound.
  **To be confirmed** with the quality-assurance contact before relying on it.

## 4. Conflicts with `CLAUDE.md` — need an explicit decision

1. **"One network egress path":** fetching clips from the PACS (Option B) is a
   new network connection outside the extraction gateway. The rule and its
   test would need a defined, local-network-only exception for PACS traffic.
   A DICOM receiver (Option C) is inbound, but still needs checking against
   the rule.
2. **TESTBETRIEB / ECHTBETRIEB:** clips are real patient data. In
   TESTBETRIEB the app shows only anonymized or phantom studies, and clips
   never cross between `test.db` and `live.db`.
3. **No new dependencies without asking:** Orthanc and Cornerstone3D would
   both be new dependencies.
4. **Regulatory:** if the in-app viewer is used for **diagnosis** rather than
   quick review, the app moves closer to medical-device software. Safe
   wording: "the review viewer is for convenience; the PACS is used for
   diagnosis."
5. **Retention:** §630f BGB requires records to be kept for 10 years. With
   Option C the app's copy becomes part of that obligation. With A or B the
   PACS remains responsible.

## 5. Cheapest first step

Ask the PACS vendor one question: *"Can your viewer be opened for a specific
study by URL, using the accession number?"* If yes, this upgrade is about a
day of work and needs no new hardware.
