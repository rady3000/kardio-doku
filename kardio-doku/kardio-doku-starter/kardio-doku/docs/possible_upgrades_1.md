# Possible upgrades 1 — Getting data from the machines without manual PDF upload

Status: **discussion notes, not approved for implementation.** Not part of
`PLAN.md`. Nothing here changes the current design (PDF → extraction →
unconfirmed values → physician confirmation).

Date of discussion: 2026-11-24

## Context

The current plan extracts values from the PDF reports that the machines
produce. The question was whether the app could instead take values
**directly from the machines** when an examination ends, or at least remove
the manual USB-stick step.

Setting as stated for this discussion: private practice, existing PACS and
KIS, use only for own practice and/or research (no distribution to other
clinics).

Machines:

- GE Vivid S70 (echocardiography)
- Medtronic programmer running Vitatron software VSF21 8.2
- Abbott Merlin 2 PCS (Patient Care System)

## 1. General findings

- There is no universal "docking station". Each device type uses its own
  interface standard:
  - **Echo:** DICOM over Ethernet; measurements as DICOM Structured Report (SR).
  - **Pacemaker/ICD programmers:** IHE IDCO (HL7 v2 + IEEE 11073 codes),
    vendor XML, USB export, or PDF. Usually only via vendor platforms
    (Medtronic Paceart/CareLink, Abbott Merlin.net).
  - **ECG, stress ECG, Holter, ABPM (not in scope now):** typically GDT
    (common in Germany), HL7, DICOM waveform, SCP-ECG or vendor XML.
- A direct-connection architecture would need: protocol connectors (DICOM
  receiver, HL7/IDCO listener, GDT/file watcher, PDF import as fallback) →
  normalization into one internal data model → patient matching (DICOM
  Modality Worklist) → the existing physician review/confirmation step.
- Hardware for direct connection: no extra box; the app PC on the practice
  network with a fixed IP, always on, with backup.
- Regulatory notes: in-house/private use avoids the full MDR certification
  path, but validation against the official reports remains the physician's
  responsibility. Research use needs GDPR measures (pseudonymization,
  consent and/or ethics committee vote as applicable).

## 2. Per-device assessment (direct connection)

### GE Vivid S70 — feasible

- The Vivid speaks DICOM and can export measurements as DICOM SR.
- No need to bypass PACS/KIS; work in parallel:
  - **Option A (preferred):** add the app as a **second DICOM storage
    destination** on the Vivid. On "End exam" it sends to PACS and to the app.
  - **Option B:** app queries the PACS for the SR object (DICOM
    Query/Retrieve); no change on the machine, but needs PACS vendor
    cooperation.
- Patient identity already comes from the existing worklist.
- To check first:
  1. Does the PACS already contain an "SR" series for echo studies? If not,
     the measurement-export option may need enabling/licensing by GE.
  2. Obtain the Vivid S70 DICOM Conformance Statement for the installed
     software version.
  3. Only measurements taken with the measurement package (labelled) arrive
     as structured data; free caliper measurements do not.

### Medtronic programmer (Vitatron VSF21 8.2) and Abbott Merlin 2 PCS — limited

- Closed systems; no open live interface for third-party software.
- Reading internal storage or reverse-engineering the protocol is **not
  recommended** (device tampering, warranty/support loss, legal and
  cybersecurity risk).
- Possible routes, most direct first:
  1. USB export at session end — check whether it produces only PDF or also
     XML/structured data. If XML: the app can import it directly.
  2. Vendor platform with IDCO export (Paceart/CareLink; Merlin.net) — cleanest
     structured option, requires vendor accounts/contracts.
  3. PDF — always works; current solution.
- To check first: export one test session from each programmer to USB and
  look at the file types. Also confirm which Medtronic programmer model
  (CareLink 2090, Encore, SmartSync) runs the Vitatron software.

## 3. Decision for now: stay with PDF, remove the USB plugging

Staying with PDF extraction was judged the simplest path. The remaining
problem is the repeated unplug/replug of the USB stick between machine and
computer.

| Device | Solution | Unplugging needed? |
|---|---|---|
| GE Vivid S70 | Export the PDF report to a **network folder** on the app PC, or "print" to a **virtual PDF printer** on the app PC | No (no stick at all) |
| Medtronic/Vitatron programmer | **USB sharing switch** (stick stays in the switch; button selects programmer or PC) | No (button press) |
| Merlin 2 PCS | **USB sharing switch** | No (button press) |

Notes:

- Vivid: which of the two network options the installed software supports is
  a machine setting (IT or GE service).
- USB sharing switch: cheap (approx. €20–40), nothing installed on the
  programmer. Limits: passive USB cable approx. 5 m, active extension approx.
  15–20 m. Switch only after the programmer has finished writing (eject if
  offered). Test with both programmers first; some medical devices are picky
  about USB hardware.
- Not recommended: Wi-Fi USB sticks / Wi-Fi SD cards (wireless in a medical
  device, unreliable sync, security risk).

### App-side addition: automatic folder import

- Watch configured folders (network share for echo; the USB stick when it
  appears) and import new PDFs automatically.
- Track already-processed files to prevent duplicate imports; optionally move
  processed files to an archive folder.
- Imported values still enter **unconfirmed** and go through the normal
  confirmation step.

## 4. Open points before any implementation

- Check against `CLAUDE.md` constraints: a folder watcher or DICOM receiver is
  local/inbound and does not add network egress, but this must be confirmed
  against the "one network egress path" rule and its test.
- During `TESTBETRIEB` only synthetic or anonymized documents are allowed;
  automatic import of real reports from the machines is only relevant for
  `ECHTBETRIEB`.
- Confirm Vivid network export options (network share / network printer / SR).
- Run the USB export test on both programmers and record the file formats.
- If adopted, add as a milestone to `PLAN.md` (needs approval).
