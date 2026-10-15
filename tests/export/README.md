# Export test

Checks the Excel export against Daniel's master-sheet rules (status.md, section 3).
It runs the app's own code from `src/lib` (create nodules from AI findings, Daniel's edits, approve, build the workbook)
on one patient, Baseline + Follow-up 1, with synthetic AI findings in the engine API v1 shape and an in-memory stand-in for Base44.

    node --import ./tests/export/register.mjs tests/export/run.mjs tests/export/after
    python3 tests/export/check.py tests/export/after     # needs openpyxl

`before.report.txt` = result on the code as Base44 generated it (10/13, plus empty-text cells found in the raw XML).
`after.report.txt` = result now (18 checks: the 16 sheet rules + daily "only new rows" exports without duplicates + updated rows flagged in Read me).
Not covered here: clicking through the real UI. That needs scan data from the engine and is tested separately.
