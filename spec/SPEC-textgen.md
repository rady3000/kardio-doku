# SPEC-textgen — Classification rules, threshold bands, text blocks, extraction

Status: **Draft v0.2 (milestone 0, audit only)**. Everything below is copied
from the prototypes **as found** — wording, cut-offs and bugs included. Nothing
is endorsed. ⚠ = flag; `GAP` / `OVERLAP` / `INCONSISTENT` = band-set analysis.
German text in `code` or quote blocks is **verbatim** (placeholders in `{…}`).

Notation: `[a, b)` = a ≤ x < b. "m" = männlich, "f" = weiblich (and any
non-"männlich" value, since the code tests `gender === 'männlich'`).

---

## G. Conformance with CLAUDE.md and SPEC-extraction-gateway.md

The prototypes predate the gateway design. This section records where each
prototype rule would land under it. **No rule has been converted**: the
conversion to `reference/*.json` needs the physician's cut-offs, `source` and
`reviewedOn` (gateway §5.2).

### G-1 Rule inventory against the design constraints

| Rule | Type | Single value (CLAUDE.md rule 5)? | Names a guideline? | Therapy recommendation? | Status under the new design |
|---|---|---|---|---|---|
| TTE-R01 LVEF | band → sentence | yes (+ sex) | no | no | convertible once cut-offs/source are set (D-14, D-52) |
| TTE-R02 IVSd | band → sentence | yes (+ sex) | no | no | convertible (D-13) |
| TTE-H01…H17 | out-of-range highlight | yes | no | no | convertible as normal ranges |
| TTE-R10…R13 HFA-PEFF | score → sentence | **no** | no ("ESC Leitlinien" in UI text only) | no | **not allowed as auto text** (D-48) |
| TTE-T* qualitative sentences | selection → sentence | n/a (physician-chosen) | n/a | no | templates; allowed |
| TTE-B Empfehlung blocks | selection → paragraph | n/a | no | **yes** | text-block library, physician-inserted (D-49); content review D-20 |
| TEE-T*/TEE-S | selection → sentence | n/a | n/a | TEER suitability sentences | templates; TEER sentences only after the physician-assigned grade (D-29, D-49) |
| SM-T* | selection → sentence | n/a | n/a | post-op orders (SM-T17…T22) | templates; orders = physician-selected blocks (D-49) |
| CV-R01 | score → recommendation | yes (score) | no | **yes** | **automatic triggering not allowed** — the wording may survive only as physician-selected blocks (D-39, D-49) |
| CV-T18…T24 | selection → recommendation | n/a | n/a | **yes** | text-block library, physician-inserted (D-49); content review D-39 |
| DEV-B01…B06 badges | band → highlight + text | yes | no | B03, B06 give programming advice | highlight convertible; labels must become neutral (D-49, D-61) |
| DEV-T01, T05, T10 "Regelrecht…" | fixed normal conclusion | **no** (all values) | n/a | no | **not allowed** as automatic text (rule 5) |
| DEV-T11 follow-up | fixed recommendation | n/a | n/a | yes | automatic insertion not allowed; physician-selected block or fact field (D-49, D-63) |
| DEV `ahre`, `icdLastTherapy`, `indication` | model-written text | n/a | n/a | no | **excluded** — model prose (D-60) |

### G-2 Band semantics needed before conversion

The gateway `ClassificationRule` bands use `min`/`max` without stating
inclusivity. The gateway's own LVEF example (`min 55` / `min 45, max 54` /
`min 30, max 44` / `max 29`) is contiguous only for integers: 54.5 % or
29.5 % match **no** band and would silently produce no sentence (the exact
failure §5.2.3 forbids). Prototype values are decimals (step 0.1/0.01).
The prototype rules use half-open intervals (`≥ cut-off`), which are gap-free.
→ D-52.

### G-3 Condition dimension needed

Several prototype band sets vary by sex (R01, R02, H02, H03, H04, H06) or
rhythm (R12, H16, H17). The gateway `ClassificationRule` interface has one
`field` and one band list — no condition such as `when: { sex: 'männlich' }`.
→ D-51.

### G-4 Extraction contract gap

The prototype extraction returns `{value, unit}` only. The gateway requires
`confidence`, `page`, `boundingBox`, `rawText` per field and discards anything
without them (§3.1). The prototype prompt is therefore **reference material for
label hints only** (`extractionHints`), not a reusable extraction design.

---

## X. Extraction (model) — TTE and Device-Abfrage

### X-1 TTE extraction prompt (verbatim, `TTE_V2026/index.tsx` @ df72c6d, lines 54–90)

Sent together with the uploaded image/PDF as `inlineData` to model
`gemini-3.8-flash`, `responseMimeType: 'application/json'`.

```text
                Du bist ein spezialisierter medizinischer Assistent. Analysiere das hochgeladene Bild eines Echokardiographie-Befundes.
                Extrahiere die folgenden Messwerte. Achte genau auf die Einheiten (cm oder mm) neben den Werten.
                
                **WICHTIGE REGEL ZUR ZAHLENERKENNUNG:** In medizinischen Dokumenten aus dem deutschsprachigen Raum wird das Komma (,) als Dezimaltrennzeichen verwendet (z.B. "22,6" bedeutet 22.6). Du musst diese Zahlen korrekt als Dezimalzahlen interpretieren. Ignoriere das Komma nicht, sonst wird aus "22,6" fälschlicherweise "226". Behandle "22,6" als "22.6".

                Achte auf die folgenden speziellen Abkürzungen und mappe sie korrekt:
                - "RV Länge" oder "RVAWd" im Dokument entspricht dem Schlüssel "rv". Priorisiere "RV Länge".
                - "LVIDs" im Dokument entspricht dem Schlüssel "lvesd".
                - "E/E' Sept" oder "E/e' (Sep)" im Dokument entspricht dem Schlüssel "e_e_prime".
                - "G peak SL(Avg)" im Dokument entspricht dem Schlüssel "gls".
                - "TR maxPG" im Dokument entspricht dem Schlüssel "tr_max_pg".
                - "TV S'" oder "TDI S'" im Dokument entspricht dem Schlüssel "tasv". Falls der Wert in m/s angegeben ist (z.B. 0.12), rechne ihn bitte in cm/s um (z.B. 12).
                - Für den Schlüssel "lvef" (LVEF), priorisiere den Wert, der als "LVEF_BiP_Q" oder "EF Biplane" bezeichnet wird. Ignoriere Werte wie "EF (Teich)" oder "EF (Cube)".
                - "MV E" -> "mitral_e" (Einheit: m/s).
                - "MV A" -> "mitral_a" (Einheit: m/s).
                - "E/A" -> "e_a_ratio".
                
                **Biomarker & Morphologische Parameter:**
                - "RWT" oder relative Wanddicke -> "rwt".
                - "LVMI" oder linksventrikulärer Massenindex -> "lvmi" (Einheit g/m²).
                - "BNP" -> "bnp" (Einheit pg/ml).
                - "NT-proBNP" -> "nt_probnp" (Einheit pg/ml).
                
                **Aortenklappe (AV) Parameter:**
                - Suche nach "AV Vmax", "Vmax Aorta", "Vmax AV" -> Schlüssel: "av_vmax" (Einheit meist m/s).
                - Suche nach "AV maxPG", "Pmax Aorta" -> Schlüssel: "av_max_pg" (Einheit mmHg).
                - Suche nach "AV meanPG", "Pmean Aorta" -> Schlüssel: "av_mean_pg" (Einheit mmHg).
                - Suche nach "AVA", "AÖF", "AV Area" -> Schlüssel: "av_area" (Einheit cm²).

                Gib das Ergebnis NUR als valides JSON-Objekt zurück. Gib KEINEN Text oder Erklärungen vor oder nach dem JSON-Objekt aus.
                Das JSON-Objekt MUSS das folgende Schema haben:
                Jeder Schlüssel muss ein Objekt mit "value" (Zahl) und "unit" (string, z.B. "cm" oder "mm") sein.
                Die Schlüssel sind: 
                ivsd, lvedd, lvesd, lvef, la, rv, tapse, tasv, rvsp, laesvi, mitral_e, mitral_a, e_a_ratio, e_e_prime, aortenwurzel, aorta_ascendens_val, vci, gls, tr_max_pg,
                av_vmax, av_max_pg, av_mean_pg, av_area, rwt, lvmi, bnp, nt_probnp.

                Wenn ein Wert nicht vorhanden ist, lasse den Schlüssel im JSON weg.
```

History: in `d1086cb` the prompt was identical except that the block
"**Biomarker & Morphologische Parameter:**" (rwt, lvmi, bnp, nt_probnp) and the
four keys at the end of the key list were missing; model `gemini-3-flash-preview`.

Prompt flags:
- ⚠ `"RV Länge" oder "RVAWd"` → `rv`: length / wall thickness mapped onto a diameter field (SPEC-modules TTE F-03, D-21).
- ⚠ `"E/E' Sept"` → `e_e_prime`: septal ratio used as the average ratio (D-10).
- ⚠ The model is told to convert TASV units (a calculation, not extraction).
- ⚠ `"G peak SL(Avg)"` → `gls`: vendor-specific label (GE EchoPAC). Label heuristics are vendor-bound (D-07).
- Key `rvsp` is requested but no mapping hint is given; `tr_max_pg` is preferred downstream.

### X-2 Deterministic post-processing of the model response (TTE)

Applied in this order:

| # | Rule |
|---|---|
| P1 | Strip code fences (```` ```json ````, ```` ``` ````), `JSON.parse`. |
| P2 | `av_vmax.value` → `ak_vmax`. |
| P3 | `av_area.value` → `ak_aoef`. |
| P4 | `ak_dp` = `"{max}"` + (`"/{mean}"` if mean) — max-only gives "40", mean-only gives "/25". |
| P5 | For every other key with a matching input id (skip `rvsp, tr_max_pg, av_*`): if `unit.toLowerCase() === 'cm'` and key ∉ {tasv, mitral_e, mitral_a} → `value × 10`. |
| P6 | `tasv`: if `unit === 'm/s'` **or** `0 < value < 3.0` → `value × 100`; then round to 0.1. ⚠ May double-convert (the prompt already asks for cm/s). |
| P7 | If `tr_max_pg` present: `RVSP = ceil(tr_max_pg) + RAP`, `RAP = 10` if the VCI field (already filled by P5) `> 20` mm, else `5`. Else if `rvsp` present → take it. |
| P8 | Status line: "`{n} Felder wurden erfolgreich ausgefüllt und ausgewertet.`" (green). Error: "`Fehler: {message}`" / "`Fehler: Kein Gemini API-Schlüssel konfiguriert. Bitte überprüfen Sie die Einstellungen.`" |
| P9 | Recalculate HFA-PEFF score. |

`GAP`: mitral E/A in cm/s are not converted (D-22). `INCONSISTENT`: RAP cut-off 20 mm here vs VCI highlight 21 mm (TTE-H15).

### X-3 Other modules

TEE, SM-Implantation, Kardioversion: **no extraction, no model call.**
Device-Abfrage: see X-4, X-5.

### X-4 Device-Abfrage extraction prompts (verbatim, `HSM_Abfrage/index.tsx` @ df19444)

Sent by the browser to `POST /api/analyze` (`server.ts`), which forwards to
model `gemini-3.5-flash` with `responseMimeType: 'application/json'` and a
`responseSchema` of 28 **string** properties (deviceModel, deviceType,
implantationDate, batteryStatus, sensingRa, sensingRv, impedanceRa,
impedanceRv, thresholdRaV, thresholdRaMs, thresholdRvV, thresholdRvMs,
apAnteil, vpAnteil, company, indication, rhythm, ahre, icdVtZone, icdVfZone,
icdShockImpedance, icdChargeTime, icdLastTherapy, crtLvVector, crtLvPacingPct,
crtLvImpedance, crtLvSensing, crtLvThreshold). Request parts, in order: the
prompt text; if a PDF text layer could be read with pdf.js,
`"\n\n--- EXTRAHIERTER DOKUMENTEN-TEXT ---\n\n" + text`; the whole file as
base64 `inlineData` (images and PDFs).

#### `commonInstructions` — shared instructions, embedded as `${commonInstructions}` at the top of every variant (lines 40–106)

```text
            Du bist ein spezialisierter medizinischer Assistent für Kardiologie. Deine Aufgabe ist die präzise Extraktion von Herzschrittmacher-, ICD- und CRT-Daten aus Abfrageberichten ("Abschlussbericht" / "Final Report").
            
            WICHTIGE HERSTELLER-SPEZIFISCHE REGELN (ABBOTT / ST. JUDE MEDICAL / MERLIN):
            Wenn du erkennst, dass der Bericht von Abbott, St. Jude Medical (SJM) oder aus dem Merlin Patient Care System stammt:
            1. Hersteller (company): Setze "Abbott" (auch wenn "St. Jude Medical", "SJM" oder "Merlin" angegeben ist).
            2. Schrittmachermodus / Gerätetyp (deviceType):
               - Suche im Kopf nach Modellbezeichnung (z.B. "Gallant HF", "Quadra Assura", "Quadra Allure", "Fortify Assura", "Unify", "Ellipse", "Entrant", "Assurity", "Endurity").
               - Wenn CRT-D, Quadra Assura MP, Fortify CRT-D oder Biventrikulärer ICD: wähle "CRT-D (Dreikammer ICD)".
               - Wenn CRT-P, Quadra Allure oder Biventrikulärer HSM: wähle "CRT-P (Dreikammer HSM)".
               - Wenn Single Chamber ICD / VR: "1-Kammer ICD (VVI-D)". Dual Chamber ICD / DR: "2-Kammer ICD (DDD-D)".
            3. Batteriestatus (batteryStatus): Suche nach "Battery Status", "Remaining Longevity", "ERI", "Elective Replacement Indicator", "Battery Voltage" (z. B. "> 5.0 years", "2.85 V", "OK").
            4. Atriale Parameter (RA / Vorhof):
               - Sensing: Suche "P-Wave", "P Wave amplitude", "Intrinsic Amplitude", "A Sense" (in mV, z.B. 2.5).
               - Impedanz: Suche "A Impedance", "Atrial Lead Impedance", "Atrium Impedanz" (in Ohm, z.B. 450).
               - Reizschwelle: Suche "A Threshold", "Atrial Threshold" (Spannung in V, Impulsdauer in ms).
            5. Ventrikuläre Parameter (RV / Ventrikel):
               - Sensing: Suche "R-Wave", "R Wave amplitude", "Intrinsic Amplitude", "RV Sense" (in mV, z.B. 12.0).
               - Impedanz: Suche "RV Impedance", "V Impedance", "RV Lead Impedance" (in Ohm, z.B. 520).
               - Reizschwelle: Suche "RV Threshold", "V Threshold" (Spannung in V, Impulsdauer in ms).
            6. Linksventrikuläre Parameter / CRT (LV):
               - LV Vektor (crtLvVector): Suche "LV Pace Vector", "LV Pacing Vector" (z.B. "D1-M2", "M2-P4", "D1-RV Shell", "LV tip to RV ring").
               - BiV Stimulationsanteil (crtLvPacingPct): Suche "% BiV Paced", "% LV Paced", "BiV Pacing %" (z.B. 99.2%).
               - LV Impedanz (crtLvImpedance): Suche "LV Impedance", "LV Lead Impedance" in Ohm (z.B. 680).
               - LV Sensing (crtLvSensing): Suche "LV Sense", "LV Amplitude", "LV Intrinsic" in mV (z.B. 14.5).
               - LV Reizschwelle (crtLvThreshold): Suche "LV Threshold" (z.B. "1.0 V bei 0.4 ms").
            7. ICD-Therapiezonen & Schock (Abbott / SJM):
               - VT-Zone (icdVtZone): Suche "VT-1", "VT-2", "VT Zone Rate" (z.B. "> 170 bpm").
               - VF-Zone (icdVfZone): Suche "VF Zone Rate", "VF Zone" (z.B. "> 210 bpm").
               - Schockimpedanz (icdShockImpedance): Suche "HV Lead Impedance", "Shock Impedance", "RV Coil Impedance" in Ohm (z.B. 58).
               - Kondensator-Ladezeit (icdChargeTime): Suche "Capacitor Charge Time", "Last Charge Time", "Recharge Time" in Sek. (z.B. 7.8 s).
               - Therapien (icdLastTherapy): Suche "Delivered Shocks", "ATP Delivered", "Tachy Episodes" (z.B. "0 Shocks / 0 ATP" oder "Keine").

            WICHTIGE HERSTELLER-SPEZIFISCHE REGELN (BIOTRONIK):
            Wenn du erkennst, dass der Hersteller BIOTRONIK ist, priorisiere folgende Labels:
            1. Batteriestatus: Suche nach dem Feld "Errechneter ERI".
            2. Sensing (Wahrnehmung): Suche nach "Mittl. Amplitude [mV]" für RA (Vorhof) und RV (Ventrikel).
            3. Reizschwellen: 
               - Spannung (V): Suche nach "Reizschwelle [V]".
               - Pulsweite (ms): Suche nach "Impulsdauer [ms]".
            4. Stimulationsanteil: Suche nach "Stimulation [%]". Ordne es "apAnteil" zu, wenn es im Atrium/Vorhof steht, und "vpAnteil", wenn es im Ventrikel steht.
            5. CRT-Spezifisch: LV-Sondenwerte unter "LV" bzw. "Linksventrikulär" suchen (Sensing, Impedanz, Reizschwelle).

            WICHTIGE HERSTELLER-SPEZIFISCHE REGELN (MEDTRONIC DEUTSCH / GERMAN):
            Wenn du einen Bericht von Medtronic künstlich oder real erkennst (oft ein "Abschlussbericht"), priorisiere und wende unbedingt folgende deutsche Suchbegriffe an:
            1. Restkapazität / Batteriestatus (batteryStatus): Findet man unter "Geschätzte verbleibende Laufzeit" im Abschlussbericht (z. B. "> 15,0 Jahre" oder "10,2 Jahre"). Extrahiere diesen Wert genau.
            2. Sondenimpedanz RA (impedanceRa): Findet man unter "Gemessene Impedanz" im Abschnitt "A. Elektrode" (oder unter Atrium-Elektrode) im Abschlussbericht. Extrahiere nur den reinen Zahlenwert (Ohm).
            3. Sondenimpedanz RV (impedanceRv): Findet man unter "Gemessene Impedanz" im Abschnitt "V. Elektrode" (oder unter Ventrikel-Elektrode) im Abschlussbericht. Extrahiere nur den reinen Zahlenwert (Ohm).
            4. Schrittmachermodus / Gerätetyp (deviceType): Findet man unter "Betriebsart" im Abschlussbericht. Mappe dies unbedingt auf einen der folgenden Werte, wenn anwendbar: "1-Kammer HSM (VVI)", "2-Kammer HSM (DDD)", "1-Kammer ICD (VVI-D)", "2-Kammer ICD (DDD-D)", "CRT-D (Dreikammer ICD)", "CRT-P (Dreikammer HSM)". Wenn z.B. CRT-D oder biventrikulärer ICD steht, wähle "CRT-D".
            5. Hersteller (company): Findet man unter "Schrittmachermodell" im Abschlussbericht. Wenn dort Medtronic erwähnt wird oder das Modell ein Medtronic-Modell ist, trage "Medtronic" ein.
            6. Modellnummer / Gerätemodell (deviceModel): Findet man unter "Schrittmachermodell" im Abschlussbericht (z. B. "Astra XT DR" oder eine Modellbezeichnung/Nummer wie "ADDRS1").
            7. Sterilisations-/Implantations-Datum (implantationDate): Findet man unter "Implantiert:" im Abschlussbericht. Konvertiere das ausgelesene Datum (z.B. "12-Okt-2023", "12. Okt. 2023" oder "12.10.2023") präzise in das Format YYYY-MM-DD. Konvertiere deutsche Abkürzungen (Okt -> 10, Dez -> 12, Mai -> 05 usw.) korrekt.
            8. ICD-Therapiezonen (icdVtZone / icdVfZone): VT-Überwachungszone / VT-Zone suchen (z.B. "VT-Zone" oder "VT-Grenze", oft angegeben in bpm z.B. "> 185 bpm"). VF-Therapiezone / VF-Zone suchen (z.B. "VF-Zone" oder "VF-Grenze", angegeben in bpm z.B. "> 220 bpm").
            9. Schockimpedanz (icdShockImpedance): Wert der Defi-Elektrode unter "Schock-Impedanz" oder "RV-Coil" bzw. "Second Coil" (in Ohm, z.B. 65 Ohm).
            10. Kondensator-Ladezeit (icdChargeTime): Wert unter "Ladezeit" oder "Ladeversuch-Ladezeit" (in Sek., z.B. 8.4 s).
            11. LV-Sondenparameter (CRT): Für "crtLvVector" suche nach "LV-Sondenvektor", "LV-Polung" oder "Vektor-Auswahl" (z.B. "LV1 bis LV2", "LV2 zu LV4", "Bipolar: LV an RV" etc.). Für "crtLvPacingPct" suche biventrikuläre Stimulation / "BiV-Stimulation" oder "BiV %" (z.B. 99.4%). "crtLvImpedance", "crtLvSensing" und "crtLvThreshold" aus dem LV-Sondenabschnitt extrahieren.

            WICHTIGE HERSTELLER-SPEZIFISCHE REGELN (MEDTRONIC ENGLISCH / ENGLISH):
            Wenn du erkennst, dass der Bericht von Medtronic auf Englisch ist, priorisiere folgende Labels:
            1. Batteriestatus (batteryStatus): Suche nach "Estimated remaining longevity".
            2. Stimulationsanteil: "A. Paced" -> apAnteil, "V. Paced" -> vpAnteil, "BiV" / "Biventricular Paced" -> crtLvPacingPct.
            3. Sensing (sensingRa / sensingRv): "Atrial Sensing Threshold" -> sensingRa, "Ventricular Sensing Threshold" -> sensingRv. LV Sensing -> crtLvSensing.
            4. Impedenzen (impedanceRa / impedanceRv): "Measured Impedance" -> Atrial/A. -> impedanceRa, Ventricular/V. -> impedanceRv. LV Impedance -> crtLvImpedance.
            5. ICD zones: VT zone (VT interval/rate, e.g. "> 180 bpm"), VF zone (VF interval/rate, e.g. "> 220 bpm").
            6. Shock impedance & charge time: "Shocking Impedance" or "RV Coil Impedance" -> icdShockImpedance. "Capacitor Charge Time" -> icdChargeTime.
            
            WICHTIGER HINWEIS FÜR NICHT GEFUNDENE FELDER:
            Wenn ein Parameter im Dokument nicht vorhanden, unleserlich oder nicht anwendbar ist, gib für diesen Schlüssel den leeren String "" oder null zurück. Gib NIEMALS die Zahl 0 oder "0" als Standardwert für fehlende Werte an!
```

#### `prompt` — **the variant actually sent** (`body.prompt`) (lines 179–214)

```text
            ${commonInstructions}
            Analyse das hochgeladene Herzschrittmacher/ICD/CRT-Abfrageprotokoll.
            Extrahiere alle kardiologischen Werte präzise als JSON.
            
            Kardiologische Ziel-Felder:
            - deviceModel: Gerätemodell / Modellbezeichnung (z.B. "Gallant HF", "Quadra Assura MP", "Astra XT DR", "Enduri", "Evia").
            - deviceType: Exakt einer dieser Werte: "1-Kammer HSM (VVI)", "2-Kammer HSM (DDD)", "1-Kammer ICD (VVI-D)", "2-Kammer ICD (DDD-D)", "CRT-D (Dreikammer ICD)", "CRT-P (Dreikammer HSM)".
            - company: Hersteller: "Medtronic", "Abbott" (auch für St. Jude Medical / SJM / Merlin), "Biotronik", "Boston Scientific", "Vitatron", "Microport".
            - implantationDate: Datum der Implantation im Format YYYY-MM-DD.
            - batteryStatus: Restlaufzeit / ERI / Voltage / Status (z.B. "> 5.0 Jahre", "2.85 V", "OK").
            - sensingRa: Vorhof-Wahrnehmung (P-Welle) in mV.
            - sensingRv: Ventrikel-Wahrnehmung (R-Zacke) in mV.
            - impedanceRa: Sondenimpedanz Vorhof in Ohm.
            - impedanceRv: Sondenimpedanz Ventrikel in Ohm.
            - thresholdRaV: Reizschwelle Spannung Vorhof (V).
            - thresholdRaMs: Impulsdauer Vorhof (ms).
            - thresholdRvV: Reizschwelle Spannung Ventrikel (V).
            - thresholdRvMs: Impulsdauer Ventrikel (ms).
            - apAnteil: Atrialer Stimulationsanteil (%).
            - vpAnteil: Ventrikulärer Stimulationsanteil (%).
            - indication: Indikation (z.B. "AV-Block III°", "Sick-Sinus-Syndrom", "DCM / HF").
            - rhythm: Grundrhythmus (z.B. "Sinusrhythmus", "Vorhofflimmern").
            - ahre: Zusammenfassung AT/AF-Episoden.
            
            EXTRAS FÜR ICD & CRT:
            - icdVtZone: VT-Grenzfrequenz / Zone (z.B. "> 170 bpm")
            - icdVfZone: VF-Grenzfrequenz / Zone (z.B. "> 210 bpm")
            - icdShockImpedance: RV-Coil / Schock-Impedanz in Ohm (z.B. "58")
            - icdChargeTime: Kondensatorladezeit in Sek. (z.B. "7.8")
            - icdLastTherapy: Letzte ICD-Therapien (z.B. "0 Shocks", "Keine", "1 ATP erfolgreich")
            
            - crtLvVector: LV Polung/Vektor (z.B. "D1-M2", "Quadripolar: LV1 zu LV2", "Bipolar: LV an RV")
            - crtLvPacingPct: Biventrikuläre Stimulation % (% BiV / % LV) (z.B. "99.4")
            - crtLvImpedance: LV Sondenimpedanz in Ohm (z.B. "680")
            - crtLvSensing: LV Sensing in mV (z.B. "14.5")
            - crtLvThreshold: LV Reizschwelle (z.B. "1.0V bei 0.4ms")
```

#### `imagePrompt` — built but **never sent** (lines 110–143)

```text
            ${commonInstructions}
            Analyse das Bild des Herzschrittmacher/ICD/CRT-Abfrageprotokolls.
            Extrahiere Informationen und gib sie als JSON zurück.
            - deviceModel: Gerätemodell / Modellnummer (findet man unter "Schrittmachermodell" im Abschlussbericht).
            - deviceType: "1-Kammer HSM (VVI)", "2-Kammer HSM (DDD)", "1-Kammer ICD (VVI-D)", "2-Kammer ICD (DDD-D)", "CRT-D (Dreikammer ICD)" oder "CRT-P (Dreikammer HSM)".
            - implantationDate: Datum der Implantation im Format YYYY-MM-DD (findet man unter "Implantiert" im Abschlussbericht).
            - batteryStatus: Wert aus "Errechneter ERI" (Biotronik) oder "Geschätzte verbleibende Laufzeit" (Medtronic).
            - sensingRa: Vorhof-Wahrnehmung (P-Welle) in mV / "Atrial Sensing Threshold".
            - sensingRv: Ventrikel-Wahrnehmung (R-Zacke) in mV / "Ventricular Sensing Threshold".
            - impedanceRa: Sondenimpedanz Vorhof in Ohm (findet man unter "Gemessene Impedanz" unter "A. Elektrode" bzw. "Atrial" / "Measured Impedance").
            - impedanceRv: Sondenimpedanz Ventrikel in Ohm (findet man unter "Gemessene Impedanz" unter "V. Elektrode" bzw. "Ventricular" / "Measured Impedance").
            - thresholdRaV: Reizschwelle Spannung Vorhof (V).
            - thresholdRaMs: Impulsdauer/Pulsweite Vorhof (ms).
            - thresholdRvV: Reizschwelle Spannung Ventrikel (V).
            - thresholdRvMs: Impulsdauer/Pulsweite Ventrikel (ms).
            - apAnteil: "Stimulation [%]", "A. Paced" oder "A. Stim." (Vorhof).
            - vpAnteil: "Stimulation [%]", "V. Paced" oder "V. Stim." (Ventrikel).
            - company: Hersteller (z.B. Medtronic, Biotronik, Vitatron) (findet man unter "Schrittmachermodell" im Abschlussbericht).
            - indication: Indikation (z.B. Sick-Sinus-Syndrom, AV-Block).
            - rhythm: Grundrhythmus.
            - ahre: Zusammenfassung AHRE/AT-Episoden.
            
            EXTRAS FÜR ICD & CRT:
            - icdVtZone: z.B. "> 180 bpm" oder "Monitor 180"
            - icdVfZone: z.B. "> 220 bpm" oder "Therapie 220"
            - icdShockImpedance: Schock-Impedanz (Ohm) z.B. "65"
            - icdChargeTime: Kondensatorladezeit in Sekunden z.B. "8.4"
            - icdLastTherapy: Zusammenfassung letzter Therapien z.B. "Keine" oder "1 ATP erfolgreich"
            
            - crtLvVector: Vektor-Beschreibung wie z.B. "Quadripolar: LV1 zu LV2" oder "Bipolar: LV an RV"
            - crtLvPacingPct: Biventrikuläre Stimulation % (BiV) z.B. "99.4"
            - crtLvImpedance: LV Sondenimpedanz (Ohm) z.B. "620"
            - crtLvSensing: LV Sensing (mV) z.B. "15.0"
            - crtLvThreshold: LV Reizschwelle z.B. "1.2V bei 0.4ms"
```

#### `textAnalysisPrompt` — built but **never sent** (lines 147–175)

```text
            ${commonInstructions}
            Analysiere den extrahierten Text eines Herzschrittmacher/ICD/CRT-Abfrageberichts ("Abschlussbericht" / "Final Report").
            Extrahiere die Daten präzise als JSON.
            
            Besonderheiten für die Felder:
            - deviceModel: Gerätemodell / Modellnummer.
            - deviceType: "1-Kammer HSM (VVI)", "2-Kammer HSM (DDD)", "1-Kammer ICD (VVI-D)", "2-Kammer ICD (DDD-D)", "CRT-D (Dreikammer ICD)" (wenn ICD + CRT / biventrikulär) oder "CRT-P (Dreikammer HSM)".
            - company: Hersteller (z.B. Medtronic, Biotronik, Vitatron).
            - implantationDate: Datum der Implantation im Format YYYY-MM-DD.
            - batteryStatus: Wert der Restlaufzeit / ERI.
            - sensingRa: Vorhof-Wahrnehmung (P-Welle) in mV.
            - sensingRv: Ventrikel-Wahrnehmung (R-Zacke) in mV.
            - impedanceRa: Sondenimpedanz Vorhof (Ohm).
            - impedanceRv: Sondenimpedanz Ventrikel (Ohm).
            - thresholds: Reizschwellen für Vorhof / Ventrikel (Spannung in V, Dauer in ms).
            - apAnteil/vpAnteil: atrialer/ventrikulärer Stimulationsanteil (%).
            
            EXTRAS FÜR ICD & CRT:
            - icdVtZone: VT-Überwachungszone (z.B. "> 180 bpm")
            - icdVfZone: VF-Therapiezone (z.B. "> 220 bpm")
            - icdShockImpedance: RV-Coil Schockimpedanz in Ohm
            - icdChargeTime: Kondensatorladezeit in Sek.
            - icdLastTherapy: Letzte Therapien (ATP, Schock, Zähler)
            
            - crtLvVector: LV Polung/Vektor (z.B. "Quadripolar: LV1 zu LV2")
            - crtLvPacingPct: BiV-Stimulationsanteil (%)
            - crtLvImpedance: LV Sondenimpedanz in Ohm
            - crtLvSensing: LV Sensing in mV
            - crtLvThreshold: LV Reizschwelle (z.B. "1.2V bei 0.4ms")
```

Prompt flags:
- ⚠ `ahre` ("Zusammenfassung AT/AF-Episoden"), `icdLastTherapy` ("Zusammenfassung letzter Therapien") and `indication` ask the model to **write clinical text**, which is printed verbatim in the report → deviation from extraction-only (D-60).
- ⚠ `deviceModel` / "Modellnummer" extraction is forbidden by gateway §2.6.4 (D-55).
- ⚠ Date conversion ("12-Okt-2023" → YYYY-MM-DD) is delegated to the model.
- ⚠ "Atrial/Ventricular Sensing Threshold" → measured amplitude (D-59).
- ⚠ "Betriebsart" (pacing mode) → device type (D-56).
- The phrase "Wenn du einen Bericht von Medtronic künstlich oder real erkennst" suggests the hints were tuned on synthetic reports.
- Vendor rules exist for Abbott/SJM/Merlin, Biotronik, Medtronic (DE and EN). Boston Scientific, Vitatron-specific and Microport have none.

### X-5 Device post-processing (deterministic, `index.tsx`)

| # | Rule |
|---|---|
| P1 | Any value that is empty, "null", "undefined" or (text fields) "n/a" is skipped. |
| P2 | `implantationDate`: first `\d{4}-\d{2}-\d{2}` match kept. |
| P3 | `company` normalised by substring (see SPEC-modules Device §12). |
| P4 | `deviceType` normalised by substring, first match wins (see SPEC-modules Device §12). |
| P5 | Selects: exact or substring match against the options; `indication` without match → "Andere" + value into the free-text field; other selects without match → value written into the button as is. |
| P6 | Status: "`{n} Felder wurden erfolgreich ausgefüllt.`" / "`Fehler bei der Dateianalyse: {message}`". Server errors: "`Keine Daten zur Analyse übergeben.`", "`Model output was not valid JSON.`". |
| P7 | After filling: show ICD/CRT sections, evaluate badges (DEV-B), update the mnemonic ribbon. |


---

## TTE — Rules

### TTE-R01 LVEF classification (text) — `getLvefInterpretation(lvef, gender)`

| Band | m | f | Output word |
|---|---|---|---|
| invalid | NaN, ≤ 0, > 100 | same | `nicht beurteilt` (via caller) |
| normal | ≥ 52 | ≥ 54 | `normal` |
| mild | [41, 52) | [41, 54) | `leicht reduziert` |
| moderate | [30, 41) | [30, 41) | `mittelgradig reduziert` |
| severe | (0, 30) | (0, 30) | `hochgradig reduziert` |

Analysis: complete, no overlap. `INCONSISTENT` with TTE-H04 (major ≤ 40).
No "hyperdynamic" band (> 72 % m / > 74 % f per ASE 2015).

Sentence: `Die globale systolische Pumpfunktion ist {word}. `

### TTE-R02 Wall thickness (text) — `getWallThicknessInterpretation(ivsd, gender)`

| Band | m (IVSd mm) | f (IVSd mm) | Output word |
|---|---|---|---|
| invalid | NaN, ≤ 0 | same | `nicht beurteilt` |
| normal | ≤ 10 | ≤ 9 | `normwertig` |
| mild | (10, 12] | (9, 12] | `geringgradig hypertrophiert` |
| moderate | (12, 14] | (12, 14] | `mittelgradig hypertrophiert` |
| severe | > 14 | > 14 | `hochgradig hypertrophiert` |

Analysis: complete, no overlap. ⚠ Differs from ASE/EACVI 2015 (see SPEC-modules
TTE F-07). `INCONSISTENT` with TTE-H01 (≥ 12) and TTE-R11 (≥ 12).

Sentence: `Die Wanddicke ist {word}. `

### TTE-R10 HFA-PEFF — functional domain (max 2)

| Criterion | Major (2) | Minor (1) |
|---|---|---|
| E/e' (`e_e_prime`) | ≥ 15 | [9, 15) |
| RVSP (`rvsp`) | > 35 mmHg | – |
| GLS (`abs(gls)`) | – | 0 < \|GLS\| < 16 % |

Domain = 2 if any major, else 1 if any minor, else 0.
⚠ Missing: septal e' < 7 cm/s / lateral e' < 10 cm/s (major); TR velocity > 2.8 m/s is covered only indirectly via RVSP. ⚠ E/e' septal vs average (D-10).

### TTE-R11 HFA-PEFF — morphological domain (max 2)

| Criterion | Major (2) | Minor (1) |
|---|---|---|
| LAVI (`laesvi`) | > 34 ml/m² | [29, 34] ml/m² |
| LVMI + RWT | LVMI ≥ 149 (m) / ≥ 122 (f) **and** RWT > 0.42 | – |
| LVMI alone | – | LVMI **>** 115 (m) / **>** 95 (f) (only if the major rule did not fire) |
| RWT alone | – | RWT > 0.42 (only if no morph major) |
| IVSd | – | ≥ 12 mm |

⚠ `GAP`: rhythm-independent LAVI; AF values (> 40 / 34–40) missing (D-11).
⚠ Boundary: LVMI minor uses `>` instead of ≥ (D-12).
Note: if LAVI is major, the "RWT alone" minor is suppressed — harmless (score is already 2).

### TTE-R12 HFA-PEFF — biomarker domain (max 2)

| Rhythm | Marker | Major (2) | Minor (1) |
|---|---|---|---|
| not "VHF / Vorhofflattern" | NT-proBNP | > 220 pg/ml | [125, 220] |
| | BNP | > 80 pg/ml | [35, 80] |
| "VHF / Vorhofflattern" | NT-proBNP | > 660 pg/ml | [365, 660] |
| | BNP | > 240 pg/ml | [105, 240] |

Complete for each rhythm. "AV-Block III" uses the SR values.

### TTE-R13 HFA-PEFF total & wording

Total = functional + morphological + biomarker (0–6).

Live panel (UI only):

| Score | Class text | Description text |
|---|---|---|
| 0–1 | `HFpEF Unwahrscheinlich (Normal)` | `Niedrige Wahrscheinlichkeit für diastolische Dysfunktion / HFpEF nach ESC Leitlinien (Score 0-1).` |
| 2–4 | `Grenzbereich (Intermediär)` | `Intermediärer Score (2-4). Klinische Abklärung durch diastolischen Belastungstest (Stressecho) o. invasive Hämodynamik empfohlen.` |
| 5–6 | `Verdacht auf HFpEF Bestätigt (Positiv)` | `Hohe Wahrscheinlichkeit für HFpEF (Score 5-6). Diagnose von HFpEF ist kardiologisch gesichert.` |

Report (two bands only):

| Score | Body sentence (appended + `". "`) | Summary fragment |
|---|---|---|
| ≥ 2 | `Hinweis auf diastolische Dysfunktion, HF-PEFF Score ({score})` | `Hinweis auf diastolische Dysfunktion` |
| < 2 | `kein Hinweis auf diastolische Dysfunktion, HF-PEFF Score ({score})` | `kein Hinweis auf diastolische Dysfunktion` |

⚠ `INCONSISTENT`: the UI has 3 bands, the report has 2; the intermediate band
(2–4) is reported as positive. Score is applied without an LVEF ≥ 50 % check. (D-08)
The `diastole` dropdown is overwritten with the report band on generate.

Criterion labels shown in the panel (verbatim): `E/E' ≥ 15 (Major, 2P)`,
`E/E' 9-14 (Minor, 1P)`, `RVSP > 35 mmHg (Major, 2P)`, `2D-GLS < 16% (Minor, 1P)`,
`LAVI > 34 ml/m² (Major, 2P)`, `LAVI 29-34 ml/m² (Minor, 1P)`,
`LV-Hypertrophie (LVMI & RWT, Major, 2P)`, `LVMI erhöht (>{115|95} g/m², Minor, 1P)`,
`Relative Wanddicke RWT > 0.42 (Minor, 1P)`, `IVS-Wanddicke ≥ 12 mm (Minor, 1P)`,
`NT-proBNP > 220 pg/ml (SR, Major, 2P)`, `NT-proBNP 125-220 pg/ml (SR, Minor, 1P)`,
`BNP > 80 pg/ml (SR, Major, 2P)`, `BNP 35-80 pg/ml (SR, Minor, 1P)`,
`NT-proBNP > 660 pg/ml (VHF, Major, 2P)`, `NT-proBNP 365-660 pg/ml (VHF, Minor, 1P)`,
`BNP > 240 pg/ml (VHF, Major, 2P)`, `BNP 105-240 pg/ml (VHF, Minor, 1P)`,
empty: `Keine Kriterien erfüllt`.

### TTE-H01…H17 Input highlight bands (UI colour only, not in text)

| ID | Field | Condition none | minor (amber) | major (red) | Analysis |
|---|---|---|---|---|---|
| H01 | IVSd | < 12 | ≥ 12 | – | sex-independent; `INCONSISTENT` with R02 |
| H02 | LVEDD | m ≤ 58, f ≤ 52 | m (58, 64], f (52, 58] | m > 64, f > 58 | complete |
| H03 | LVESD | m ≤ 40, f ≤ 35 | m (40, 45], f (35, 40] | m > 45, f > 40 | complete |
| H04 | LVEF | ≥ 52 m / ≥ 54 f | (40, cut-off) | ≤ 40 | `INCONSISTENT` with R01 (41) |
| H05 | RWT | ≤ 0.42 | > 0.42 | – | complete |
| H06 | LVMI | m ≤ 115, f ≤ 95 | m (115, 149), f (95, 122) | m ≥ 149, f ≥ 122 | complete |
| H07 | 2D-GLS | \|x\| ≥ 16 or 0 | 0 < \|x\| < 16 | – | 0 treated as "not measured" |
| H08 | E/e' | < 9 | [9, 15) | ≥ 15 | complete |
| H09 | RVSP | ≤ 35 | – | > 35 | complete |
| H10 | LAESVI | < 29 | [29, 34] | > 34 | complete; AF not considered |
| H11 | LA | ≤ 40 | (40, 46] | > 46 | sex-independent |
| H12 | RV | ≤ 41 | (41, 45] | > 45 | see D-21 |
| H13 | TAPSE | ≥ 17 | – | < 17 | complete |
| H14 | TASV | ≥ 10 | < 10 | – | complete |
| H15 | VCI | ≤ 21 | > 21 | – | `INCONSISTENT` with X-2 P7 (20) |
| H16 | BNP | SR < 35 / AF < 105 | SR [35, 80] / AF [105, 240] | SR > 80 / AF > 240 | complete |
| H17 | NT-proBNP | SR < 125 / AF < 365 | SR [125, 220] / AF [365, 660] | SR > 220 / AF > 660 | complete |

Extra: indication "vor Chemotherapie" → GLS field outlined red (no value test).

### TTE-G01 Adjective helper `getAdjectiveForm(x)` (summary only)

| Input | Output |
|---|---|
| empty / `nicht beurteilt` | `nicht beurteilte` |
| `normal` | `normale` |
| else | `x.replace(' ', 'e ') + 'e'` → e.g. `leicht reduziert` → **`leichte reduzierte`** ⚠ bug (expected `leicht reduzierte`) |

### TTE-T Text templates (body), in output order

**Header**
```
Transthorakale Echokardiographie:

Indikation: {indication}
Rhythmus: {rhythm | "Sinusrhythmus"}

Messwerte:
{Name}: {value} {unit}; …

BEFUND:
Linker Ventrikel: 
```

**TTE-T01 LV size**
- both `lvedd_dim` and `lvesd_dim` = `normal dimensioniert` → `Der linke Ventrikel ist normal dimensioniert. `
- else → `Der LVEDD ist {lvedd_dim | "n.b."}, der LVESD ist {lvesd_dim | "n.b."}. `

**TTE-T02** `Die Wanddicke ist {R02}. Die globale systolische Pumpfunktion ist {R01}. `

**TTE-T03 Kinetik**
- `regionale Wandbewegungsstörungen` → `Regionale Wandbewegungsstörungen: {text | "n.s."}. `
- `globale Hypokinesie` → `Es zeigt sich eine globale Hypokinesie. `
- `keine Kinetikstörungen` **or null** → `Es zeigen sich keine regionalen Wandbewegungsstörungen. ` ⚠ null = normal

**TTE-T04 GLS** (only if indication = `vor Chemotherapie`)
- no GLS + `mäßig` → `Aufgrund der mäßigen Schallbedingungen war die Bestimmung der GLS unmöglich. `
- no GLS + `deutlich eingeschränkt` → `Aufgrund der deutlich eingeschränkten Schallbedingungen war die Bestimmung der GLS unmöglich. `
- GLS present → `Der globale longitudinale Strain (GLS) beträgt {gls}%. `
- ⚠ `GAP`: no GLS + `gut` → nothing.

**TTE-T05** HFA-PEFF sentence (R13) + `". "` then blank line. ⚠ lower-case start.

**TTE-T06 Vorhöfe & RV**
```
Vorhöfe und Rechter Ventrikel: Der linke Vorhof ist {la_q | "nicht beurteilt"}. Der rechte Vorhof ist {ra | "normwertig"}. Der rechte Ventrikel ist {rv | "normwertig"}. Die globale systolische rechtsventrikuläre Funktion ist {rv_funktion | "normal"}. 
```
- PH = `Hinweis` → `Es besteht ein indirekter Hinweis auf eine pulmonale Hypertonie (RVSP {rvsp | "N/A"} mmHg). `
- else (incl. null) → `Es besteht kein Hinweis auf eine pulmonale Hypertonie. `

**TTE-T07 Aortenklappe** (`Klappenbefund:\nAortenklappe: `)
- prosthesis → `Zustand nach Aortenklappenersatz durch eine {type | "n.s."} Prothese in regelrechter Funktion. `
- else `Die Aortenklappe ist {ak_taschen | "trikuspid"}, die Taschen sind {ak_sklerose | "zart"}. `
  - stenosis ≠ keine → `Es liegt eine {ak_stenose} Aortenstenose vor` + ` ({Vmax x m/s, dp max/mean y mmHg, AÖF z cm²})` if any + `. ` ⚠ `leichtgradig` uninflected
  - AI ≠ keine → `Zusätzlich besteht eine {ak_insuffizienz} Aortenklappeninsuffizienz` + ` (Jet: {ak_jet}; PHT: {pht} ms)` + `. ` ⚠ "Zusätzlich" also without AS; details printed even for "leichte" if values were entered earlier
  - neither → `Hämodynamisch zeigt sich keine relevante Pathologie. `
  - no stenosis measurements printed yet → `({Vmax x m/s, dp max/mean y mmHg}). ` (AÖF omitted)

**TTE-T08 Mitralklappe**
- prosthesis → `Zustand nach Mitralklappenersatz durch eine {type | "n.s."} Prothese in regelrechter Funktion. `
- else `Die Mitralklappensegel sind {mk_segel | "zart"}. `
  - MI ≠ keine → `Es zeigt sich eine {mk_insuffizienz} Mitralklappeninsuffizienz` + ` (Jet: …; Mechanismus: …; Konvergenzzone: …; Mitralis-Einstrom: …; VC {x} mm; PISA {x} mm; EROA {x} cm²)` + `. `
  - MS ≠ keine → `Es liegt eine {mk_stenose} Mitralklappenstenose vor` + ` (dp max/mean: {x} mmHg)` + `. `
  - neither → `Keine hämodynamisch relevante Stenose oder Insuffizienz. `

**TTE-T09 Trikuspidal-/Pulmonalklappe**
- prosthesis → `Zustand nach Trikuspidalklappenersatz durch eine {type | "n.s."} Prothese in regelrechter Funktion. `
- else `Die Segel sind {tk_segel | "zart"}. `
  - TR ∈ {leichte, mittelgradige, hochgradige} → `Es besteht eine {tk_insuffizienz} Trikuspidalklappeninsuffizienz` + (mittel/hoch only) ` (Jet: …; VC {x} mm; PISA {x} mm)` + `. `
  - TR ∈ {keine, physiologisch, null} → `Keine hämodynamisch relevante Insuffizienz. `
  - ⚠ `tk_stenose` / `tk_dp` are **never output**.
- then `Pulmonalklappe: Die Funktion ist {pk_funktion | "normal"}.` → e.g. "Die Funktion ist leichte Insuffizienz." ⚠ ungrammatical for non-normal values.

**TTE-T10 Aorta & Perikard** (`Aorta und Perikard: `)
- `Die Aorta ascendens ist {aorta_ascendens | "normwertig dimensioniert"}. `
- PE ≠ kein → `Es zeigt sich ein {perikarderguss}. ` + `{perikard_text} ` + `Herzhöhlen: {herzhoehlen}. ` + `Hämodynamik: {relevanz}. `
- else → `Kein Perikarderguss. `
- always → `Die Vena cava inferior ist normalkalibrig und zeigt atemmodulierte Kaliberschwankung.` ⚠ unconditional (D-16)

### TTE-S Zusammenfassung (fragments joined by `", "`, closed by `"."`)

Order:
1. `mäßige Schallbedingungen` / `deutlich eingeschränkte Schallbedingungen` (nothing for gut)
2. LV/RV function:
   - R01 = normal **and** RV function (null→normal) = normal → `normale biventrikuläre Pumpfunktion` + ` (LVEF {x}%)`
   - else: R01 ≠ nicht beurteilt → `{G01(R01)} LV-Funktion` + `, LVEF {x}%`; RV ≠ normal → `{G01(rv)} RV-Funktion`
3. HFA-PEFF fragment (R13)
4. `LA-Dilatation` if LA qualitative set and ≠ normal dimensioniert
5. `AI {grade}`, `MI {grade}`, `TI {grade}`, `MS {grade}`, `AS {grade}` + `, AÖF {x} cm²`
   Grade map: `leichte`→`I°`, `mittelgradige`→`II°`, `hochgradige`→`III°`, `leichtgradig`→`I`, `mittelgradig`→`II`, `hochgradig`→`III` ⚠ AS without °
6. PE: `{perikarderguss}` + ` ({relevanz})` or `Kein PE`

`GAP`: RA/RV dilatation, PH, wall thickness, regional WMA, prostheses, PK and aorta never appear in the summary.

### TTE-B Empfehlung Textbausteine (verbatim, appended as `\n\nEmpfehlung:\n{text}`)

`Herzinsuffizienz` ⚠ patient- and site-specific (D-20):
```text
Es handelt sich um eine Erstdiagnose einer Herzinsuffizienz. Da die Patientin klinisch sehr aktiv ist (täglich spazieren, regelmäßiges Schwimmen etc.), wird folgendes zielgerichtetes Vorgehen angestrebt:
Rekompensation: Fortführung der Rekompensationstherapie (i.v. Diurese, Bilanzierung der täglichen Ein- und Ausfuhr, tägliche Gewichtskontrolle sowie umtägige Elektrolytkontrollen).
Therapieoptimierung: Einleitung bzw. Optimierung der leitliniengerechten Herzinsuffizienz-Therapie (ARNI, Beta-Blocker, Spironolacton und SGLT-2-Inhibitor).
Invasive Diagnostik: Nach erfolgreicher Rekompensation Planung einer ambulanten, frühelektiven Koronarangiographie im Klinikum Chemnitz. Hierzu werden die Unterlagen an das Casemanagement der Klinik für Innere Medizin I im Klinikum Chemnitz weitergeleitet. Bei Ausschluss einer KHK wird im Verlauf die Durchführung eines Kardio-MRT zur weiteren Ätiologieklärung diskutiert.
Verlauf: Eine echokardiographische und klinische Verlaufskontrolle in 3 Monaten ist in unserer Funktionsdiagnostik geplant. Sollte sich die LV-Pumpfunktion nach Sanierung (oder Ausschluss) einer KHK und unter optimierter Medikation nicht verbessert haben, wird die Indikation für eine Device-Therapie (Defibrillator / CRT-D/P) geprüft.
```
`Vorhofflimmern`: `Textbaustein für Vorhofflimmern...` (placeholder)
`Myokardinfarkt`: `Textbaustein für Myokardinfarkt...` (placeholder)

---

## TEE — Rules (all selection → text; no numeric bands)

### TEE-T Body templates

```
Transösophageale Echokardiographie (TEE)

Indikation: {indikation | "Nicht angegeben"}.
```
**TEE-T01 Sedierung**
- `Erschwerte Sondenführung mit zusätzlicher Sedierung` → `Die Untersuchung erfolgte unter lokaler Anästhesie und Sedierung mit {dosis | "nicht spezifizierter Dosis Propofol"}.`
- else (incl. null) → `Die Untersuchung erfolgte in lokaler Anästhesie und wurde gut toleriert.`

**TEE-T02 Messwerte** `Messwerte:\n{Name}: {value} {unit}; …` (LAA Fluss cm/s, LVOT mm, Aortenwurzel mm, Aorta ascendens mm, Aorta descendens mm)

**TEE-T03** `BEFUND:` then, if LVEF set: `Die linksventrikuläre Ejektionsfraktion (LVEF) ist {lvef}.`

**TEE-T04 Thromben**
- `Nachweis` → `Es zeigt sich der Nachweis von intrakardialen Thromben: {beschreibung | "nicht näher spezifiziert"}. `
- else (incl. `Präthrombotische Formationen im LAA`, null) → `Kein Nachweis von intrakardialen Thromben, insbesondere im linken Vorhofohr (LAA). ` ⚠ contradiction
- `Der LAA-Fluss ist {laa_fluss_qualitativ lower-case | "nicht beurteilt"}. `

**TEE-T05 IAS**
- PFO/ASD → `Am interatrialen Septum zeigt sich ein {PFO|ASD}: {beschreibung | "nicht näher spezifiziert"}.`
- else (incl. null) → `Das interatriale Septum ist intakt, kein Hinweis auf ein persistierendes Foramen ovale (PFO) oder einen Vorhofseptumdefekt (ASD).` ⚠ null = normal

**TEE-T06 Aortenklappe**
- prosthesis → `Zustand nach Aortenklappenersatz ({typ | "Typ nicht spezifiziert"}). `
- else → `Die native Aortenklappe ist {taschen lower | "nicht beurteilbar"}, die Segel sind {segel lower | "nicht beurteilt"}. `
- AS ≠ Keine → `Es besteht eine {ak_stenose lower} Aortenstenose. ` + (mittel/hoch, AÖF) `(3D-AÖF: {x} cm²). `
- AI ≠ Keine → `Zudem besteht eine {ak_insuffizienz lower} Aortenklappeninsuffizienz. ` + (mittel/hoch) `Mechanismus: {…}. Jet/LVOT: {…}. VC: {x} mm. Holodiastolischer Rückfluss: {Ja|Nein}. `
- neither → `Keine hämodynamisch relevante Stenose oder Insuffizienz. `
- endocarditis → `Endokarditis-Befund: {beschreibung | "nicht spezifiziert"}. `

**TEE-T07 Mitralklappe**
- prosthesis → `Zustand nach Mitralklappenersatz ({typ | "Typ nicht spezifiziert"}). `; else `Die nativen Mitralklappensegel sind {segel lower | "nicht beurteilt"}. `
- MI ≠ Keine → `Es besteht eine {mk_insuffizienz lower} Mitralklappeninsuffizienz. ` + (mittel/hoch) `Mechanismus: {…} ({beschreibung}). ` + `Quantifizierung: 2D-VC {x} mm, 3D-VCA {x} cm². ` + retrograde flow: `Es zeigt sich ein holosystolischer Rückfluss in den Pulmonalvenen. ` / `Kein holosystolischer Rückfluss in den Pulmonalvenen nachweisbar. `
- else → `Keine hämodynamisch relevante Insuffizienz. `
- MI = Hochgradig and any TEER field → `\nBeurteilung der Eignung für eine interventionelle Mitralklappenrekonstruktion (M-TEER):\n` + lines `- Pathologie: …`, `- Verkalkung: …`, `- Segelintegrität: …`, `- Tethering: …`, `- Jet-Charakter: …`, `- Vor-Operation: …`, `- MVA: {x} cm²`, `- Mittlerer Gradient: {x} mmHg`, `- Länge post. Segel: {x} mm`, `- Tenting-Höhe: {x} mm`, `- Flail Gap: {x} mm`, `- Flail Weite: {x} mm`, `- Coaptation Reserve: {x} mm²`, `- Segel-Anulus-Index: {x}`
- TEER-Gesamteignung → `Ideal`: `Die Anatomie erscheint ideal für eine M-TEER.` · `Geeignet`: `Die Anatomie erscheint geeignet für eine M-TEER.` · `Anspruchsvoll`: `Die Anatomie ist anspruchsvoll für eine M-TEER.` · `Schwierig / Unmöglich`: `Die Anatomie ist schwierig bis unmöglich für eine M-TEER.`

**TEE-T08 Trikuspidalklappe**
- prosthesis → `Zustand nach Trikuspidalklappenersatz ({typ | "Typ nicht spezifiziert"}). `; else `Die nativen Trikuspidalklappensegel sind {segel lower | "nicht beurteilt"}. `
- TR ≠ Keine Insuffizienz → `Es besteht eine Trikuspidalklappeninsuffizienz {grade label}. ` e.g. "… Grad II (moderat)."; details only if the label does **not** start with "Grad I" ⚠ bug: only Grad V passes → `Mechanismus: …`, `Der Insuffizienzjet ist {jet lower}. `, `Quantifizierung: 2D-VC … mm, PISA … mm, 2D-EROA … cm², 3D-VCA … cm². `, `Geeignet für TEER: {Ja|Nein}. `
- else → `Keine hämodynamisch relevante Insuffizienz. `

### TEE-S Zusammenfassung

Fragments in order: `LVEF {lvef}` · `Nachweis intrakardialer Thromben` or
`Präthrombotische Formationen im LAA` · `{ias_befund}` (if not "Kein Hinweis auf PFO/ASD") ·
AS `AS I°`/`AS II°`/`AS III°` (+ ` (AÖF {x} cm²)` for III°) · `AI I°…III°` ·
`MI I°…III°` · `TI I°…V°` · `Hinweise auf eine Endokarditis` or (indication V.a.
Endokarditis) `Kein Anhalt für Endokarditis`.
If any fragment and thromben = `Kein Hinweis` → prepend `Kein Nachweis von Thromben`.
If no fragment → `Unauffälliger TEE-Befund ohne Nachweis von Thromben, relevanten Shunts oder hämodynamisch wirksamen Klappenvitien.` + (V.a. Endokarditis) ` Insbesondere keine Hinweise auf eine Endokarditis.`

`GAP`: with thromben = null and some other finding, nothing about thrombi is said in the summary, while the body says "Kein Nachweis …".

---

## SM-Implantation — Text blocks (all fixed; selection-driven)

Reference renderer: plain text `generateReportText` (preview/DOCX differences in SPEC-modules SM F-01).

| ID | Condition | Text (verbatim) |
|---|---|---|
| SM-T01 | always | `{clinic}\nOperationsbericht\n\nDatum: {dd.mm.yyyy}\nPatient: {Nachname}, {Vorname}, {Geb.}\nOperateur: {operator}\n\nDiagnose: {diagnosis text}` |
| SM-T02 | Aggregatwechsel | `Initiale Indikation: {initialIndication \| "–"}` |
| SM-T03 | always | `Prozedur: {Versuchte\|Erfolgreiche} Implantation eines {procedure}` |
| SM-T04 | always | `Aufklärung: Der Patient wurde ausführlich über die Notwendigkeit, den Ablauf, die potenziellen Risiken und die Alternativen des Eingriffs aufgeklärt und hat schriftlich eingewilligt.` |
| SM-T05 | always | `Nach steriler Abdeckung und Desinfektion des {links\|rechts}en subpektoralen Bereichs erfolgte die lokale Anästhesie der Haut und des subkutanen Gewebes in der Mohrenheim-Grube mittels Infiltration von {anesthetic}.` |
| SM-T06 | Abbruch | `Trotz mehrfacher Punktionsversuche der Vena cephalica, der Vena axillaris sowie der Vena subclavia – durchgeführt sowohl unter sonographischer als auch unter radiologischer Kontrolle (nach Kontrastmitteldarstellung) – gelang keine Sondierung des venösen Systems.` / `Aufgrund des fehlenden venösen Zugangs musste die Prozedur frustran abgebrochen werden.` / `Es wurde die Indikation zur zeitnahen Durchführung einer erneuten Implantation am Folgetag von der kontralateralen ({rechts\|links}en) Seite gestellt.` |
| SM-T07 | Subclavia | `Anschließend erfolgte die Punktion der Vena subclavia radiologisch gesteuert nach Venendarstellung mit Kontrastmittel und mehrmaligen frustranen Versuchen der Punktion sowohl der Vena axillaris als auch der Vena cephalica. ` |
| SM-T08 | Axillaris/Cephalica | `Anschließend wurde die {Vena axillaris\|Vena cephalica} unter sonographische Kontrolle erfolgreich punktiert. ` ⚠ grammar |
| SM-T09 | not Abbruch, not Wechsel | `Über eine Schleuse wurden {ein Schrittmacherdraht\|zwei Schrittmacherdrähte} problemlos in das venöse System eingeführt.` |
| SM-T10 | " | `Zuerst wurde die ventrikuläre Elektrode (RV-Sonde) unter radiologischer Kontrolle (Durchleuchtung in zwei Ebenen) im hochseptale Lage des rechten Ventrikels platziert. Die Positionierung war stabil. Nach Sicherstellung der stabilen Lage und der exzellenten Messwerte wurde die Elektrode mittels Schraubmechanismus fixiert.` |
| SM-T11 | " + dual chamber | `Im Anschluss wurde die atriale Elektrode (RA-Sonde) ebenfalls unter radiologischer Kontrolle an RAA und dort aktiv fixiert. Auch hier zeigten sich nach Kontrolle der Lage in zwei Ebenen gute Messwerte.` |
| SM-T12 | " | `Nach erfolgreicher Sondenplatzierung wurde subpektoral eine Tasche für das Aggregat präpariert. Die Elektroden wurden an den {procedure} angeschlossen und das Aggregat in der vorbereiteten Tasche platziert.` |
| SM-T13 | Aggregatwechsel | `Anschließend wurde die alte Tasche eröffnet, das alte Aggregat explantiert und nach Kontrolle der Elektroden das neue Aggregat angeschlossen und in der Tasche platziert.` |
| SM-T14 | always | `Die Wunde wurde sorgfältig in Schichten adaptiert und mit {Einzelknopfnähten\|einer intrakutanen Naht} verschlossen. Ein steriler Verband wurde angelegt.` |
| SM-T15 | Abbruch | `Hinweis: Aufgrund des Abbruchs wurden keine Komponenten implantiert.` |
| SM-T16 | always | Tables: `Messwerte (intraoperativ):` / `Implantierte Komponenten:` / `Strahlenschutzdaten:` (`Durchleuchtungszeit {x} Minuten`, `Dosis-Flächen-Produkt (DFP) {x} cGy*cm²`) |
| SM-T17 | sandbag | `o Sandsack und Bettruhe für 6 Stunden.` |
| SM-T18 | xray | text: `o Röntgen-Thorax-Kontrolle zum Ausschluss eines Pneumothorax.` · preview: `Röntgen-Thorax-Kontrolle zur Überprüfung der Sondenlage und zum Ausschluss eines Pneumothorax, Schrittmacher-Abfrage und Echokardiographie zum Ausschluss eines Perikardergusses am Folgetag.` · DOCX: `Röntgen-Thorax-Kontrolle.` ⚠ three versions |
| SM-T19 | dischargeToday | `o Entlassung heute möglich.` |
| SM-T20 | Abbruch | `o Geplante Neuaufnahme und Re-Implantation am Folgetag.` |
| SM-T21 | sutureRemovalNotNeeded | `o Eine Nahtentfernung ist aufgrund der intrakutanen Naht nicht erforderlich.` |
| SM-T22 | sutureRemovalByGP | `o Die Fäden sollen in 7-10 Tagen durch den Hausarzt entfernt werden.` |
| SM-T23 | always | closing `{operator}` |

No numeric bands exist. `GAP`: lead values (sensing, threshold, impedance) are never checked, yet the text asserts "exzellente"/"gute Messwerte" (D-33).

---

## CV — Kardioversion text blocks & rules

### CV-R01 Anticoagulation rule (embedded in text) ⚠

| Outcome | CHA₂DS₂-VASc entered | Text |
|---|---|---|
| success | empty | `Antikoagulation: Wir empfehlen die konsequente Fortführung der oralen Antikoagulation mit {drug} für mindestens 4 Wochen post-interventionell, danach je nach individuellem Risikoprofil (CHA₂DS₂-VASc-Score). Eine lebenslange Antikoagulation ist bei einem Score von ≥2 (Männer) bzw. ≥3 (Frauen) indiziert.` |
| success | any value x | `Antikoagulation: Wir empfehlen die konsequente Fortführung der oralen Antikoagulation mit {drug} für mindestens 4 Wochen post-interventionell, und darüber hinaus dauerhaft bei einem CHA₂DS₂-VASc-Score von {x}.` |
| failure | any / empty (`[Wert]`) | `Antikoagulation: Die orale Antikoagulation mit {drug} muss aufgrund des persistierenden {Vorhofflimmerns\|Vorhofflatterns} und des damit verbundenen Thromboembolierisikos (CHA₂DS₂-VASc-Score: {x \| "[Wert]"}) lebenslang fortgeführt werden.` |

`GAP`: the score value is never evaluated — 0 or 1 produces "dauerhaft"/"lebenslang".
`OUTDATED`: sex-specific thresholds (ESC 2020) vs CHA₂DS₂-VA (ESC 2024). (D-39)

### CV-T Body templates

Gender forms: Nom `die Patientin`/`der Patient`; Gen `der Patientin`/`des Patienten`; Dat `der Patientin`/`dem Patienten`.

| ID | Condition | Text |
|---|---|---|
| CV-T01 | always | `1. INDIKATION UND AUFKLÄRUNG` |
| CV-T02 | Erstdiagnose | `Bei {Dat} {Name}[, geb. am {dd.mm.yyyy},] erfolgte heute die geplante elektrische Kardioversion bei symptomatischem, persistierendem Vorhofflimmern (Erstdiagnose am {dd.mm.yyyy}).` |
| CV-T03 | Rezidivierend | `… bei rezidivierendem, persistierendem Vorhofflimmern.` |
| CV-T04 | Vorhofflattern | `… bei rezidivierendem, persistierendem Vorhofflattern.` (⚠ the "symptomatischem, persistierendem Vorhofflattern" variant is unreachable) |
| CV-T05 | always | `2. ANTIKOAGULATION UND TEE-STATUS` |
| CV-T06 | Mit TEE | `Zur Beurteilung der kardialen Emboliequelle, insbesondere zum Ausschluss eines Thrombus im linken Vorhofohr, wurde unmittelbar vor der Kardioversion eine transösophageale Echokardiografie (TEE) durchgeführt. Hierbei zeigten sich keine Thromben oder thrombogenes Kontrastmittel ("smoke-like echo"), sodass die Kardioversion wie geplant durchgeführt werden konnte.` ⚠ |
| CV-T07 | Ohne TEE | `Auf die Durchführung einer transösophagealen Echokardiografie (TEE) zum Thrombusausschluss wurde verzichtet, da {Nom} die orale Antikoagulation über die letzten 4 Wochen lückenlos und glaubhaft eingenommen hat.` |
| CV-T08 | always | `3. PROZEDERE UND SEDIERUNG` / `Die Prozedur wurde in Analgosedierung durchgeführt. Nach Anlage eines periphervenösen Zugangs und unter kontinuierlichem Monitoring von EKG, Blutdruck und Sauerstoffsättigung wurden {x mg Propofol i.v.}[ und {y mg Midazolam i.v.}] verabreicht, bis eine ausreichende Sedierungstiefe erreicht war. Die Beatmung erfolgte spontan über eine Sauerstoffmaske.` |
| CV-T09 | always | `Die Kardioversion erfolgte mit einem biphasischen Defibrillator in {anterior-posteriorer\|anterior-lateraler} Elektrodenposition.` |
| CV-T10 | always | `4. ERGEBNIS DER KARDIOVERSION` |
| CV-T11 | Erfolg 1. Schock | `Ein erster synchronisierter Schock mit einer Energie von 360 Joule führte zur sofortigen Konversion in einen stabilen Sinusrhythmus mit einer Frequenz von {sinusRate}/min.` |
| CV-T12 | Erfolg mehrere | `Nach einem ersten erfolglosen Schock mit 360 Joule führte ein weiterer synchronisierter Schock mit gleicher Energie zur erfolgreichen Konversion in einen stabilen Sinusrhythmus mit einer Frequenz von {sinusRate}/min.` |
| CV-T13 | any success | `Das anschließende 12-Kanal-EKG bestätigte den stabilen Sinusrhythmus. Es zeigten sich keine signifikanten Pausen oder andere relevante Arrhythmien post-interventionell.` |
| CV-T14 | Erfolglos | `Trotz Abgabe von bis zu {shockCount} synchronisierten Schocks mit maximaler Energie (360 Joule) konnte kein stabiler Sinusrhythmus wiederhergestellt werden. Es persistiert das bekannte {Vorhofflimmern\|Vorhofflattern}. Die Prozedur wurde daraufhin beendet.` |
| CV-T15 | always | `5. POSTPROZEDURALER VERLAUF` / `{Die Patientin\|Der Patient} war nach der Prozedur hämodynamisch stabil und rasch wieder vollständig wach und orientiert. Die Überwachung im Aufwachraum verlief ohne Komplikationen. ` |
| CV-T16 | skin yes / no | `Lokal zeigten sich an den Klebestellen der Elektroden leichte Hautrötungen, jedoch keine Verbrennungen.` / `Die Haut an den Klebestellen der Elektroden war reizlos.` |
| CV-T17 | always | `6. EMPFEHLUNGEN UND WEITERES VORGEHEN` |
| CV-T18 | success + rhythm control | `Rhythmuserhalt: Zur Stabilisierung des Sinusrhythmus wird die Einleitung/Fortführung einer antiarrhythmischen Therapie mit {Flecainid\|Amiodaron} empfohlen.` |
| CV-T19 | success (always) | `Frequenzkontrolle: Eine begleitende frequenzregulierende Medikation mit ß-Blockern wird zur Vermeidung von schnellen Rezidiven empfohlen.` |
| CV-T20 | success + weight | `Zur Optimierung der Risikofaktoren und Senkung der Rezidivwahrscheinlichkeit wird bei bestehendem Übergewicht eine Gewichtsreduktion empfohlen.` |
| CV-T21 | success + recurrence advice | `Sollte es zu einem Rezidiv des Vorhofflimmerns kommen, bitten wir um erneute Vorstellung zur Diskussion des weiteren Procederes (Klasse-Ic-Antiarrhythmika vs. PVI).` |
| CV-T22 | success + plan PVI | `Aufgrund des erneuten Rezidivs des Vorhofflimmerns / einer Tachymyopathie ist eine elektive Pulmonalvenenisolation indiziert.` |
| CV-T23 | failure + Amiodaron | `Strategie: Da die elektrische Kardioversion initial erfolglos war, erfolgt eine Aufsättigung mit Amiodaron für 5 Tage und die Planung einer erneuten Kardioversion.` |
| CV-T24 | failure + Frequenzkontrolle | `Strategiewechsel: Da die elektrische Kardioversion erfolglos war, wird eine Strategie der Frequenzkontrolle weiterverfolgt.` / `Medikation: Die bisherige Medikation zur Frequenzkontrolle (ß-Blocker) wird angepasst/optimiert. Ziel ist eine Ruhefrequenz von < 110/min.` / `Alternative Verfahren: Als alternative Option könnte zu einem späteren Zeitpunkt eine Pulmonalvenenisolation in Betracht gezogen werden. Dies wird im weiteren Verlauf mit {Dat} besprochen.` |
| CV-T25 | failure | CV-R01 failure text |

---

## Device-Abfrage — Text blocks & badge bands

### DEV-T Report templates (verbatim; one text, blank line between blocks)

| ID | Condition | Text |
|---|---|---|
| DEV-T01 | always | `Regelrechte Abfrage eines {Gerätetyp \| "nicht spezifizierten Systems"} ({Hersteller \| "unbekannt"} {Modell}). ` ⚠ "Regelrechte" unconditional |
| DEV-T02 | always | `Das Aggregat wurde am {DD.MM.YYYY \| "unbekanntem Datum"} bei {Indikation \| Andere-Text \| "anderer Indikation" \| "unbekannter Indikation"} implantiert.` ⚠ the "unbekannter Indikation" branch tests for "Indikation auswählen"/"Indikation", but the placeholder is "Indikation ausw." → untouched prints "bei Indikation ausw. implantiert." |
| DEV-T03 | always | `Klinisch zeigt sich die Aggregattasche {pocket lower-case \| "reizlos, unauffällig"}. Der Patient {condition \| "ist in gutem Allgemeinzustand und beschwerdefrei"}.` ⚠ empty = normal; masculine fixed. Note: the empty check compares with "befund auswählen", but the placeholder is "Aggregattasche", so an **untouched** pocket prints "Klinisch zeigt sich die Aggregattasche aggregattasche." and an untouched condition prints "Der Patient Allgemeinzustand." ⚠ bug |
| DEV-T04 | any of rhythm / EKG texts | `Grundrhythmus: {rhythm}. EKG-Befund ohne Stimulation: {text}. EKG-Befund mit Stimulation: {text}.` (parts joined with ". ") |
| DEV-T05 | any measurement | `Regelrechte Messwerte: {parts joined ". "}.` with parts: `Batteriestatus: {x}` (bare number → `{x} Jahre bis EOL`); `AF Burden {x}`; `Stimulationsanteile AP {x} / VP {y}`; `Wahrnehmung RA {x} mV / RV {y} mV`; `Reizschwellen RA {v} V bei {ms} ms / RV {v} V bei {ms} ms` (only if both V and ms); `Impedanzen RA {x} Ω / RV {y} Ω` ⚠ "Regelrechte" unconditional |
| DEV-T06 | ICD and any ICD value | `ICD-Spezifische Parameter: VT-Überwachung: {x}, VF-Therapie: {x}, Schockimpedanz RV-Coil: {x} Ω, Ladezeit Kondensator: {x} Sek., Therapien/Zähler: {x}.` |
| DEV-T07 | CRT and any CRT value | `CRT-Spezifische Parameter: Vektor polung: {x}, Biventrikuläres Pacing: {x}%, LV Sondenimpedanz: {x} Ω, LV Sensing: {x} mV, LV Reizschwelle: {x}.` ⚠ typo; vector printed by default |
| DEV-T08 | AHRE text present / empty | `AHRE/AT-Episoden: {ahre}.` / `Keine relevanten AHRE/AT-Episoden detektiert.` ⚠ empty = normal; `ahre` may be model-written |
| DEV-T09 | reprogramming present | `Folgende Umprogrammierung wurde vorgenommen: {text}.` |
| DEV-T10 | always | `Zusammenfassend regelrechte Funktion des Aggregats ohne Anhalt für Sonden- oder Wahrnehmungsstörungen. ` ⚠ unconditional conclusion |
| DEV-T11 | always | `Die nächste Kontrolle wird in 6-8 Wochen beim niedergelassenen Kardiologen empfohlen.` ⚠ ignores `next_follow_up`; recommendation (D-49) |

### DEV-B Warning badges (UI only; do not affect the text)

Parsing: B01, B04, B05 `parseFloat(value)`; B02, B03 remove every character
except digits and "." then `parseFloat` (⚠ "8,4" → 84); B06 first
`[0-9.]+` match (⚠ may pick the ms value). NaN → no badge.

| ID | Field | green | amber | red | Analysis |
|---|---|---|---|---|---|
| DEV-B01 | Schockimpedanz | [30, 100] Ω `✓ Optimal: Im normalen Bereich (30-100 Ω)` | [25, 30) ∪ (100, 115] `⚠️ Auffällig (Grenzbereich): Außerhalb 30-100 Ω` | < 25 or > 115 `⚠️ Kritisch (Sondenfehler?): <25 Ω oder >115 Ω` | complete; `INCONSISTENT` with sidebar "> 110 Ω" |
| DEV-B02 | Ladezeit | ≤ 11 s `✓ Optimal: Schnelle Kondensatorladung (<11s)` | (11, 15] `⚠️ Grenzwertig: Leicht verlängerte Ladezeit` | > 15 `⚠️ Verzögert (>15s): Verdacht auf Kondensatoralterung` | complete; label "<11s" vs rule ≤ 11 |
| DEV-B03 | BiV-Anteil | ≥ 98 % `✓ Exzellenter biventrikulärer Stimulationsanteil (≥98%)` | [95, 98) `⚠️ Grenzwertig (95-98%): Optimierung empfohlen` | < 95 `❌ Ungenügend (<95%): Hohes Risiko für CRT Non-Response!` | complete; ⚠ recommendation wording |
| DEV-B04 | LV-Impedanz | [250, 1500] Ω `✓ Optimal LV-Impedanz (250-1500 Ω)` | [200, 250) ∪ (1500, 1800] `⚠️ Auffällig: Sondenimpedanz außerhalb 250-1500 Ω` | < 200 or > 1800 `⚠️ Kritisch: Reizleitungsfehler! Verdacht auf Bruch/Isolationsleck.` | complete; `INCONSISTENT` with comment/sidebar "200 - 1500 Ω" |
| DEV-B05 | LV-Sensing | ≥ 5.0 mV `✓ Exzellenter Signal-Sensing-Pegel (≥5.0 mV)` | [2.0, 5.0) `⚠️ Grenzwertig (2.0-5.0 mV): Ausreichendes Sensing.` | < 2.0 `⚠️ Sehr niedrig (<2 mV): Risiko für Undersensing!` | complete; amber text self-contradictory |
| DEV-B06 | LV-Reizschwelle | ≤ 1.5 V `✓ Ausgezeichnete LV Reizschwelle (<1.5 V)` | (1.5, 2.5] `⚠️ Grenzwertig (1.5-2.5 V): Erhöhter Stromverbrauch` | > 2.5 `❌ Kritisch hoch: Reizschwelle (>2.5 V). Vektorwechsel vorgeschlagen!` | complete; no pulse-width dimension; ⚠ programming advice |

Static reference texts (hints, no rule): RA/RV impedance "Ziel: 250 - 1000 Ω";
P wave "Empfohlen: >1.5 mV"; R wave "Empfohlen: >5.0 mV"; sidebar "Normalbereiche
(Lehrbuch)": `Zielbereich: 250 - 1000 Ω. Bruch: >2000 Ω. Isolationsdefekt: <250 Ω.`
(`GAP` 1000–2000 Ω); `RA (Vorhof): >1.5 mV (Empfindlichkeit 0.4-0.5 mV). RV (Kammer): >5.0 mV (Empfindlichkeit: Halbe R-Zacke).`;
`Reizschwelle optimal <1.0 V bei 0.4 ms. Sicherheitsmarge Amplitudenreizschwelle: +100% (Verdoppelung!).`;
`Schockimpedanz (RV-Coil): 30 - 100 Ω (Defekt: <25 Ω oder >110 Ω). Ladezeit: <15 Sek. (Alterung wenn verlängert).`;
`BiV-Pacing: Ziel ≥98% (kritischer Verlust bei <95%). LV Reizschwelle optimal <1.5 V. LV Impedanz: 200 - 1500 Ω.`;
battery: `>5 Jahre ist exzellent; <3 Monate erfordert rasche Terminierung.`, `Austauschkriterium (ERI/RRT) reduziert Frequenz um 11% (Biotronik) oder wechselt auf VVI-Energiesparmodus.`

---

## LIB — Text-block library drafts (pending physician review)

Per CLAUDE.md, recommendations appear only as blocks the physician inserts
from a reviewed library; never inserted, preselected or triggered from values.
Each block will carry `source` and `reviewedOn`. **Status of every block below:
DRAFT — not approved.** Edits relative to the prototype are listed per block.

### LIB-HI-01 Herzinsuffizienz (Erstdiagnose) — general version (D-20)

Source text: TTE-B "Herzinsuffizienz". Edits: removed the patient-specific
activity sentence and the site-specific referral (Klinikum Chemnitz,
Casemanagement, Klinik für Innere Medizin I); everything else unchanged.

```text
Es handelt sich um eine Erstdiagnose einer Herzinsuffizienz. Folgendes Vorgehen wird angestrebt:
Rekompensation: Fortführung der Rekompensationstherapie (i.v. Diurese, Bilanzierung der täglichen Ein- und Ausfuhr, tägliche Gewichtskontrolle sowie umtägige Elektrolytkontrollen).
Therapieoptimierung: Einleitung bzw. Optimierung der leitliniengerechten Herzinsuffizienz-Therapie (ARNI, Beta-Blocker, Spironolacton und SGLT-2-Inhibitor).
Invasive Diagnostik: Nach erfolgreicher Rekompensation Planung einer ambulanten, frühelektiven Koronarangiographie. Bei Ausschluss einer KHK wird im Verlauf die Durchführung eines Kardio-MRT zur weiteren Ätiologieklärung diskutiert.
Verlauf: Eine echokardiographische und klinische Verlaufskontrolle in 3 Monaten ist in unserer Funktionsdiagnostik geplant. Sollte sich die LV-Pumpfunktion nach Sanierung (oder Ausschluss) einer KHK und unter optimierter Medikation nicht verbessert haben, wird die Indikation für eine Device-Therapie (Defibrillator / CRT-D/P) geprüft.
```

Review points: the therapy line describes HFrEF therapy (the block has no
LVEF condition); "unserer Funktionsdiagnostik" is kept as house style.

### LIB-VHF-01, LIB-MI-01 — to be supplied by the physician (reminder in D-20)

### LIB-CV — Kardioversion anticoagulation blocks, ESC 2024 (D-39)

Basis: 2024 ESC Guidelines for the management of atrial fibrillation
(Van Gelder IC et al., Eur Heart J 2024;45:3314–3414): CHA₂DS₂-VA score
(sex category removed; 0–8 points); OAC recommended at ≥ 2, to be considered at
1; therapeutic OAC ≥ 3 weeks before elective cardioversion or TEE to exclude
thrombus; OAC for ≥ 4 weeks after cardioversion, long-term according to
thromboembolic risk. ⚠ Class/level details must be checked against the
guideline text before `reviewedOn` is set. The physician chooses the block;
the app shows the score but does not preselect.

| ID | Replaces | Draft text |
|---|---|---|
| LIB-CV-01 | CV-T07 (ohne TEE) | `Auf die Durchführung einer transösophagealen Echokardiografie (TEE) zum Thrombusausschluss wurde verzichtet, da {Nom} die orale Antikoagulation mit {Wirkstoff} über mindestens die letzten 3 Wochen lückenlos und glaubhaft eingenommen hat.` |
| LIB-CV-02 | CV-R01 success, general | `Antikoagulation: Wir empfehlen die Fortführung der oralen Antikoagulation mit {Wirkstoff} für mindestens 4 Wochen nach der Kardioversion. Über die Fortführung darüber hinaus wird anhand des individuellen Thromboembolierisikos (CHA₂DS₂-VA-Score) entschieden.` |
| LIB-CV-03 | CV-R01 success, score ≥ 2 | `Antikoagulation: Bei einem CHA₂DS₂-VA-Score von {x} ist eine dauerhafte orale Antikoagulation mit {Wirkstoff} indiziert.` |
| LIB-CV-04 | CV-R01 success, score 1 | `Antikoagulation: Wir empfehlen die Fortführung der oralen Antikoagulation mit {Wirkstoff} für mindestens 4 Wochen nach der Kardioversion. Bei einem CHA₂DS₂-VA-Score von 1 sollte eine dauerhafte orale Antikoagulation erwogen werden.` |
| LIB-CV-05 | CV-R01 success, score 0 | `Antikoagulation: Wir empfehlen die Fortführung der oralen Antikoagulation mit {Wirkstoff} für mindestens 4 Wochen nach der Kardioversion. Bei einem CHA₂DS₂-VA-Score von 0 besteht darüber hinaus keine Indikation zur dauerhaften oralen Antikoagulation.` |
| LIB-CV-06 | CV-R01 failure | `Antikoagulation: Die orale Antikoagulation mit {Wirkstoff} wird bei persistierendem {Vorhofflimmern\|Vorhofflattern} fortgeführt (CHA₂DS₂-VA-Score: {x}).` |

Field change implied: `chadsvasc_score` → `cha2ds2_va_score` (0–8), label
"CHA₂DS₂-VA-Score". Still open (D-39): an early-cardioversion pathway (AF
duration < 24 h, without 3 weeks of OAC) — needed as a TEE-status option?

### LIB-DEV-01 Follow-up interval (D-63)

Not a recommendation block but a fact line, printed only if the field
`next_follow_up` is filled: `Nächste Kontrolle: {Intervall}.` Replaces DEV-T11.

---

## Band-set analysis summary

| Rule set | Gaps | Overlaps | Inconsistencies |
|---|---|---|---|
| TTE-R01 LVEF | none | none | vs H04 (40 vs 41) |
| TTE-R02 IVSd | none | none | vs H01/R11 (12 mm); vs ASE 2015 |
| TTE-R10 functional | missing e' criteria | none | septal vs average E/e' |
| TTE-R11 morphological | AF LAVI band missing | none | LVMI `>` vs ≥ |
| TTE-R12 biomarker | none | none | AV-Block III → SR values |
| TTE-R13 total | none | none | UI 3 bands vs report 2 bands |
| TTE-H01…H17 | none (each complete) | none | H04 vs R01; H15 vs X-2 P7; H01 vs R02 |
| TTE-T04 GLS | "gut" + no GLS → silence | – | – |
| TTE text fallbacks | – | – | null → normal wording (RA, RV, RV-Fkt, AK, MK, TK, PK, Aorta, Kinetik, PH) |
| TTE-S summary | RA/RV size, PH, wall thickness, WMA, prostheses, PK, aorta missing | – | AS grade without ° |
| TEE thrombus | – | "Präthrombotische Formationen" → body says none | – |
| TEE TR details | Grad II–IV details dropped (bug) | – | 5-grade TR vs 3-grade others |
| CV-R01 | score not evaluated (0/1 → lifelong) | – | ESC 2020 vs 2024 |
| SM | no measurement bands | – | fixed quality claims |
| DEV-B01…B06 | none (each complete) | none | B01/B04 vs sidebar values; comma parsing |
| DEV RA/RV impedance/sensing/threshold | no bands at all | – | hint texts only; 1000–2000 Ω undefined |
| DEV-T conclusion | – | – | "regelrecht" regardless of values |
| Gateway LVEF example (§5.1) | decimals between integer bands (e.g. 54.5) | none | differs from prototype cut-offs (D-52) |
