# SPEC-carotis.md — Modul: Karotis-/Vertebralis-Duplexsonographie

**Status:** hand-written specification. No prototype exists for this module.
This file also serves as the **format reference** for `SPEC-modules.md`.

**Review required before implementation:** all reference thresholds are left
blank and must be filled in by the physician (see §6). All German phrasing
below is a starting proposal and should be adjusted to departmental style.

---

## 1. Module identity

| Property | Value |
|---|---|
| Module key | `carotis` |
| Display name | Karotis-Duplexsonographie |
| Report title | Duplexsonographie der extrakraniellen hirnversorgenden Arterien |
| Bilateral | yes — mirrored `rechts` / `links` blocks |

---

## 2. Section: Untersuchungsdaten

(Patient header, date, examiner and indication come from the shared core —
see `SPEC-shared.md`. Only module-specific fields listed here.)

| Field key | Label (DE) | Type | Unit | Allowed values / notes | Default |
|---|---|---|---|---|---|
| `indikation` | Indikation | select + free text | — | Stenose-Screening; Z.n. TIA; Z.n. Ischämischer Insult; Amaurosis fugax; Strömungsgeräusch; präoperativ; Verlaufskontrolle; Risikostratifizierung; sonstige | — |
| `geraet` | Gerät | select | — | department device list | last used |
| `schallkopf` | Schallkopf | select | — | Linear; Sektor; Konvex | Linear |
| `schallbedingungen` | Schallbedingungen | select | — | gut; ausreichend; eingeschränkt; deutlich eingeschränkt | gut |
| `vorbefund_datum` | Voruntersuchung vom | date | — | optional | — |

---

## 3. Section: Seitenblock (rendered twice: rechts, links)

All keys below are prefixed with the side, e.g. `re_acc_imt`, `li_acc_imt`.

### 3.1 A. carotis communis (ACC)

| Field key | Label (DE) | Type | Unit | Allowed values | Default (normal) |
|---|---|---|---|---|---|
| `acc_darstellbarkeit` | Darstellbarkeit | select | — | gut; eingeschränkt; nicht beurteilbar | gut |
| `acc_wandstruktur` | Wandstruktur | select | — | glatt und zart; verbreitert; irregulär | glatt und zart |
| `acc_imt` | IMT | number | mm | 0.1 step, optional | — |
| `acc_plaque` | Plaque | boolean | — | — | nein |
| `acc_psv` | PSV | number | cm/s | integer | — |
| `acc_edv` | EDV | number | cm/s | integer, optional | — |
| `acc_stenosegrad` | Stenosegrad | select | % | keine; <50; 50–69; 70–89; ≥90; Verschluss | keine |

> **Note on IMT:** retained as an optional field. Routine IMT measurement is
> no longer recommended for cardiovascular risk stratification in current
> guidelines; plaque presence carries the information. Keep the field, do not
> make it required, and do not generate risk statements from it.

### 3.2 Bulbus caroticus

| Field key | Label (DE) | Type | Unit | Allowed values | Default |
|---|---|---|---|---|---|
| `bulbus_plaque` | Plaque | boolean | — | — | nein |
| `bulbus_plaque_morphologie` | Plaquemorphologie | multi-select | — | echoarm; echoreich; gemischt; verkalkt mit Schallschatten | — |
| `bulbus_plaque_oberflaeche` | Plaqueoberfläche | select | — | glatt; irregulär; ulzeriert; nicht beurteilbar | — |

*(Morphology fields are shown only when `bulbus_plaque` is true — conditional
visibility is a required feature of the schema renderer.)*

### 3.3 A. carotis interna (ACI)

| Field key | Label (DE) | Type | Unit | Allowed values | Default (normal) |
|---|---|---|---|---|---|
| `aci_darstellbarkeit` | Darstellbarkeit | select | — | gut; eingeschränkt; nicht beurteilbar | gut |
| `aci_psv` | PSV | number | cm/s | integer | — |
| `aci_edv` | EDV | number | cm/s | integer | — |
| `aci_psv_poststenotisch` | PSV poststenotisch | number | cm/s | integer, optional | — |
| `aci_plaque` | Plaque | boolean | — | — | nein |
| `aci_plaque_morphologie` | Plaquemorphologie | multi-select | — | as bulbus | — |
| `aci_plaque_oberflaeche` | Plaqueoberfläche | select | — | as bulbus | — |
| `aci_plaque_laenge` | Plaquelänge | number | mm | optional | — |
| `aci_stenosegrad` | Stenosegrad (NASCET) | select | % | keine; <50; 50–69; 70–89; ≥90; Verschluss | keine |
| `aci_stroemungsprofil` | Strömungsprofil | select | — | regelrecht; turbulent; poststenotisch abgeschwächt; nicht beurteilbar | regelrecht |

> `aci_stenosegrad` is **assigned by the examiner**. The app displays the
> reference criteria table (§6) alongside the measured values as a decision
> aid. It must not preselect or auto-fill this field.

### 3.4 A. carotis externa (ACE)

| Field key | Label (DE) | Type | Unit | Allowed values | Default |
|---|---|---|---|---|---|
| `ace_psv` | PSV | number | cm/s | integer, optional | — |
| `ace_stenose` | Stenose | select | — | keine; <50%; ≥50%; Verschluss | keine |

### 3.5 A. vertebralis

| Field key | Label (DE) | Type | Unit | Allowed values | Default (normal) |
|---|---|---|---|---|---|
| `va_darstellbarkeit` | Darstellbarkeit V1/V2 | select | — | gut; eingeschränkt; nicht darstellbar | gut |
| `va_flussrichtung` | Flussrichtung | select | — | orthograd; pendelnd; retrograd | orthograd |
| `va_psv` | PSV | number | cm/s | integer, optional | — |
| `va_hypoplasie` | Hypoplasie | boolean | — | — | nein |

### 3.6 A. subclavia (optional section)

| Field key | Label (DE) | Type | Unit | Allowed values | Default |
|---|---|---|---|---|---|
| `subclavia_psv` | PSV | number | cm/s | optional | — |
| `subclavia_stenosezeichen` | Stenosezeichen | boolean | — | — | nein |
| `rr_seitendifferenz` | RR-Seitendifferenz | number | mmHg | optional | — |

---

## 4. Derived values

| Key | Label (DE) | Formula | Unit | Notes |
|---|---|---|---|---|
| `aci_acc_ratio` | ACI/ACC-Ratio | `aci_psv / acc_psv` (same side) | — | 1 decimal; hide if either input empty |
| `imt_mittel` | IMT Mittelwert | mean of entered IMT values | mm | 2 decimals; optional |

Both are display-only. Neither may trigger a grade, a classification, or a
warning label beyond simple out-of-range highlighting.

---

## 5. Section: Beurteilung

| Field key | Label (DE) | Type | Notes |
|---|---|---|---|
| `beurteilung` | Beurteilung | rich text | Prefilled from templates (§7), fully editable |
| `verlaufskontrolle` | Empfohlene Verlaufskontrolle | select | keine; 6 Monate; 12 Monate; 24 Monate; nach klinischem Verlauf |
| `empfehlung_freitext` | Weitere Empfehlung | free text | optional |

---

## 6. Reference criteria table — **TO BE COMPLETED BY THE PHYSICIAN**

Stored as an editable data file (`reference/carotis-criteria.json`), loaded at
runtime and displayed beside the ACI measurements. **Not** used to compute or
preselect anything.

| Stenosegrad (NASCET) | PSV ACI (cm/s) | EDV ACI (cm/s) | ACI/ACC-Ratio | Weitere Kriterien |
|---|---|---|---|---|
| <50 % | | | | |
| 50–69 % | | | | |
| 70–89 % | | | | |
| ≥90 % | | | | |
| Verschluss | | | | |

**Fill these in from the criteria your department uses** (DEGUM
multiparametric criteria are the German standard; SRU consensus criteria are
an alternative). Record which criteria set you entered in a `source` field in
the JSON, and have the report footer name it. I deliberately left the numbers
blank rather than supplying values from memory — these drive clinical
decisions and should be entered from your reference of record.

---

## 7. German sentence templates

### 7.1 "Alles normal" defaults

Triggered per side or for the whole study. Fills all fields with the Default
(normal) column above and produces:

```
Die extrakraniellen hirnversorgenden Arterien sind {seite} gut darstellbar.
Wandstrukturen glatt und zart, keine Plaques. Regelrechtes Strömungsprofil
ohne Nachweis einer hämodynamisch relevanten Stenose. A. vertebralis
orthograd durchströmt.
```

### 7.2 Findings templates (composed per side)

```
ACC {seite}: {acc_wandstruktur}[, IMT {acc_imt} mm][, PSV {acc_psv} cm/s].
[Plaque nachweisbar.]

Bulbus {seite}: [keine Plaques | Plaque, {bulbus_plaque_morphologie},
Oberfläche {bulbus_plaque_oberflaeche}].

ACI {seite}: PSV {aci_psv} cm/s, EDV {aci_edv} cm/s, ACI/ACC-Ratio
{aci_acc_ratio}. [Plaque {aci_plaque_morphologie}, Oberfläche
{aci_plaque_oberflaeche}, Länge {aci_plaque_laenge} mm.] Strömungsprofil
{aci_stroemungsprofil}. Stenosegrad: {aci_stenosegrad}.

ACE {seite}: {ace_stenose}[, PSV {ace_psv} cm/s].

A. vertebralis {seite}: {va_darstellbarkeit}, Flussrichtung
{va_flussrichtung}[, PSV {va_psv} cm/s][. Hypoplasie].
```

Bracketed segments are omitted entirely when their field is empty or at
default. Empty parentheses, orphaned commas, and "undefined" must never
appear in output — this is a required test case.

### 7.3 Beurteilung templates

| Condition | Template |
|---|---|
| No plaque, no stenosis, both sides | `Unauffälliger Befund der extrakraniellen hirnversorgenden Arterien. Kein Nachweis von Plaques oder hämodynamisch relevanten Stenosen.` |
| Plaque, no relevant stenosis | `Nachweis von Plaques {lokalisationen} ohne hämodynamisch relevante Stenosierung.` |
| Stenosis present | `{grad} Stenose der ACI {seite}.` |
| Retrograde vertebral flow | `Retrograde Flussrichtung der A. vertebralis {seite}, vereinbar mit einem Subclavian-Steal-Phänomen.` |
| Occlusion | `Verschluss der {gefaess} {seite}.` |

Conditions are evaluated on the structured fields the examiner entered. They
compose the *draft* Beurteilung, which is then freely editable — the app is
reporting back what was recorded, not forming an opinion.

---

## 8. Report section order

1. Kopf (Patient, Datum, Untersucher, Indikation) — from shared core
2. Untersuchungsbedingungen
3. Befund rechts
4. Befund links
5. Messwerte-Tabelle (both sides, side by side)
6. Beurteilung
7. Empfohlene Verlaufskontrolle
8. Fußzeile: verwendete Graduierungskriterien (§6 `source`), Untersucher

---

## 9. Implementation notes

- The mirror action copies rechts → links (or reverse) so only deviations are
  re-entered. Bilateral normal studies should be enterable in seconds.
- The measurements table in the report is a genuine table in DOCX and PDF
  export, and tab-aligned plain text in the clipboard export.
- Conditional field visibility (morphology fields appearing only when a
  plaque is recorded) is required by this module and must therefore exist in
  the generic schema renderer, not as carotid-specific code.
