# Holidays & Custom Dates POC

Small, self-contained front-end POC for **Location Settings -> Holidays & Custom Dates** using plain HTML, CSS, and JavaScript.

## How to run

1. Open the `holidays-custom-dates-poc` folder.
2. Double-click `index.html` (or open it in your browser).
3. No dev server or build step is required.

## What is implemented

- Single main table: **Holidays & Custom Dates**
- Empty state message + CTA:
  - "No holidays or custom dates yet. Add one to get started."
  - "Add holiday or custom date"
- Add popup:
  - Country selector (ISO country code options)
  - Year selector (current/next via datalist, any year allowed via number input)
  - Fetches suggestions from Nager.Date API:
    - `GET https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}`
  - Maps `localName || name` and `date`
  - Select one/many/all, clear selection
  - Inline fallback warning + mock fallback list when API fetch fails
  - "Add" commits selected holidays + staged custom dates
  - "Cancel" discards staged popup changes
- Nested "Add custom date" modal:
  - Name, Date, Closed, Open at, Closed at, Annual recurrence
  - Validation in modal (required fields + time ordering)
  - Save stages item (does not persist yet)
  - Cancel discards nested draft
- Pending additions area in add popup:
  - Shows selected holidays and staged custom dates
  - Remove action per pending item
  - Inline conflict errors if duplicate dates would be introduced
- Duplicate prevention rule:
  - Blocks commit if any pending date conflicts with existing table dates
  - Also blocks duplicate dates within pending additions
- Main table editing:
  - Editable fields: Closed, Open at, Closed at (and annual recurrence for custom rows)
  - If Closed is checked, times are disabled and become null when saved
  - Sticky bottom bar appears on edits:
    - Save (enabled only if valid)
    - Discard changes
  - Save persists and shows toast "Saved."
  - Discard reverts to last persisted state
- Delete row:
  - Confirmation dialog with name/date
  - Persists immediately and shows toast "Deleted."
- Add from popup:
  - Persists and shows toast "Added."
- Persistence:
  - Uses `localStorage`, persisting only `state.items`
- Debug panel:
  - Toggle button shows/hides live state JSON

## Architecture notes (inside `app.js`)

The code is organized by responsibilities:

- **Store / state**
  - single source of truth `state`
  - `loadItems()`, `saveItems(items)`
- **API**
  - `fetchHolidays(country, year)`
  - `normalizeHoliday(apiHoliday, country, year)`
  - fallback holiday provider
- **Validation**
  - `validateItemDraft(draft, existingItems, mode)`
  - `detectDateConflicts(existingItems, pendingAdditions)`
- **Computation**
  - `computePendingAdditions(selectedHolidays, stagedCustomDates)`
- **Rendering**
  - `renderMainTable()`, `renderEmptyState()`, `renderAddPopup()`, `renderCustomDateModal()`, `renderPendingArea()`
- **Controllers**
  - event delegation for table actions and popup list selection
  - `applyEdits()`, `revertEdits()`

## Known limitations

- The API call depends on browser/network/CORS behavior; when it fails, fallback mock holidays are used.
- Country selector includes a small list of ISO codes for demo purposes, not all countries.
- Styling and accessibility are POC-level and can be improved for production.
- Date conflict message lists conflicting dates but is intentionally lightweight.

## Acceptance checklist

- [x] Single-folder vanilla implementation (`index.html`, `styles.css`, `app.js`, `README.md`)
- [x] Runs by directly opening `index.html`
- [x] Uses in-memory state + `localStorage` persistence for saved rows
- [x] Add popup with API fetch, selection, select-all, clear, add/cancel
- [x] Nested custom date modal with validation and staging behavior
- [x] Pending additions list with remove + duplicate conflict blocking
- [x] Main table edit flow with sticky save/discard bar
- [x] Delete with confirmation + toast
- [x] Toasts: "Added.", "Saved.", "Deleted."
- [x] Debug panel toggle showing current state JSON
