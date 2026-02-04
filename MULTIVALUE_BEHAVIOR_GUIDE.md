# Multivalue Field Behavior Guide

## Current Implementation Overview

This document describes how multivalue fields work in the d.velop forms application, using Form.io's `tags` component (which uses Choices.js under the hood) with custom enhancements.

---

## Loading a Document (Edit Mode)

### Step 1: Document Fetch
- Entry point (`sections/13-entry-point.js`) detects edit mode
- Fetches document via `Dv.o2()` API
- Receives O2 response with:
  - `systemProperties` (system metadata)
  - `objectProperties` (single-value category properties)
  - `multivalueProperties` (multivalue category properties with `values` object)

### Step 2: Build Previous Values Map
- `makePrevMap()` creates snapshot of current values:
  - Multivalue: Extracts arrays from `multivalueProperties[].values`
  - Single: Extracts from `objectProperties[]` or `systemProperties[]`
- Stored in `form._o2mPrev` for later change detection

### Step 3: Build Form Schema
- `buildCategoryInputPanelAsync()` creates Form.io components:
  - Multivalue fields → `type: 'tags'` (Choices.js-based)
  - Single fields → `textfield`, `number`, `checkbox`, etc.
- Sets initial values via `buildInitialValuesFromIndex()`

### Step 4: Mount Form & Install Enhancements
- Form.io renders the form
- `installDelimitedEntry()` attaches to multivalue fields:
  - Finds component by UUID
  - Attaches event listeners (paste, keydown)
  - Mounts import button, clear button, filter UI

---

## User Interactions with Multivalue Fields

### Typing + Comma/Semicolon (Delimiter)
1. User types value(s) in input field
2. User presses comma `,` or semicolon `;`
3. **Our handler intercepts** (keydown event, capture phase)
4. Reads current input value
5. Calls `tokenize()` to split on delimiter (respects quotes)
6. Calls `addTokens()` which:
   - Gets current values from component
   - Filters out duplicates (if input contains existing values)
   - Appends new tokens to current array
   - Calls `setArray()` to update component
7. Clears input field
8. Choices.js prevented from processing the delimiter

### Typing + Tab
1. User types value(s) in input field
2. User presses Tab
3. **Our handler intercepts** (keydown event, capture phase)
4. Reads current input value
5. Calls `tokenize()` to split (respects quotes)
6. Calls `addTokens()` to append new values
7. Clears input field
8. Tab event continues (focus moves to next field)

### Typing + Enter
1. User types value(s) in input field
2. User presses Enter
3. **Our handler intercepts** (keydown event, capture phase)
4. Reads current input value
5. Calls `tokenize()` to split (respects quotes)
6. Calls `addTokens()` to append new values
7. Clears input field
8. Enter event prevented (Choices.js doesn't process it)

### Pasting Text with Delimiters

#### Case A: Not Within Quotes
Example: `A,B,C` or `"A",B,"C"`
1. User pastes text into input field
2. **Our handler intercepts** (paste event, capture phase)
3. Extracts clipboard text
4. Checks if text contains delimiters (`hasSepRe.test(text)`)
5. Calls `tokenize()` which:
   - Splits on comma/semicolon
   - Respects quoted strings (keeps `"A,B"` as one token)
   - Removes surrounding quotes from tokens
6. Calls `addTokens()` with `replace: false` to append
7. Clears input field

#### Case B: Within Quotes
Example: `"A,B,C"` (entire paste is quoted)
1. User pastes quoted text
2. **Our handler intercepts** (paste event)
3. Extracts clipboard text
4. Calls `tokenize()` which:
   - Detects opening quote, sets `inQuotes = true`
   - Skips delimiter splitting while in quotes
   - Detects closing quote, sets `inQuotes = false`
   - Result: `["A,B,C"]` (single token, quotes removed)
5. Calls `addTokens()` to append the single value
6. Clears input field

### Import Button (Per-Field)
1. User clicks "Import" button next to multivalue field
2. Enters document ID in small input field
3. Clicks import button or presses Enter
4. **Handler fetches** document via `Dv.o2()` API
5. Extracts values for this field's UUID from O2 response
6. Calls `setValues()` which:
   - Sets component value to imported array
   - Flags field in `form._o2mForceReplace` Set
7. On save, `collectSourceProperties()` sees the flag and:
   - Sends empty strings `""` for each previous value slot
   - Appends new imported values
   - This ensures old values are cleared, new ones added

### Clear Button
1. User clicks "Clear" button
2. **Handler calls** `cmp.setValue([], { fromSubmission: true })`
3. Clears visible input buffer
4. Triggers form change event

### Value Filter
1. User types in filter input (below chip list)
2. **Filter handler** finds all chips (`.choices__item`)
3. Hides chips that don't match filter text
4. Updates counter (e.g., "3 / 10")

---

## Saving Changes

### Step 1: Collect Source Properties
- `collectSourceProperties()` runs when form is submitted
- Iterates through all form fields
- For each multivalue field:

#### Normal Edit (No Force Replace)
1. Gets previous values from `form._o2mPrev[uuid]`
2. Gets current values from `form.submission.data[uuid]`
3. Compares arrays:
   - Maps previous values to current (preserves order)
   - If previous value found in current → keep it
   - If previous value not found → send `""` (deletion)
   - New values not in previous → append
4. Result: Array with empty strings at deleted positions, new values appended

#### Import/Replace Case (Force Replace)
1. Checks if `form._o2mForceReplace.has(uuid)`
2. If true:
   - Creates array of empty strings (one per previous value)
   - Appends all current values
3. Result: `["", "", "", "new1", "new2"]` (old cleared, new appended)

### Step 2: Build O2M Payload
- `buildO2mPayload()` assembles request body:
  ```json
  {
    "sourceProperties": {
      "properties": [
        { "key": "uuid-1", "values": ["val1", "val2"] },
        { "key": "uuid-2", "values": ["", "", "new"] }
      ]
    },
    "displayValue": "...",
    "filename": "..."
  }
  ```

### Step 3: Submit to API
- PUT request to `/dms/r/{repoId}/o2m/{docId}`
- Server applies changes to document
- Empty strings in multivalue arrays clear those positions

---

## Key Functions

### `tokenize(raw)`
- Splits input on delimiters (comma, semicolon)
- Respects quoted strings (keeps `"A,B"` together)
- Handles escaped quotes (`""` → `"`)
- Returns array of tokens (quotes removed)

### `addTokens(tokens, el, { replace })`
- Adds tokens to multivalue field
- If `replace: false`: Appends to current values (filters duplicates)
- If `replace: true`: Replaces all values
- Ensures select options exist (for select fields)
- Updates component via `setArray()`

### `getArray(cmp)`
- Gets current values from component
- Tries: `cmp.getValue()`, `cmp.dataValue`, `form.submission.data[key]`
- Returns array (normalizes single values to arrays)

### `setArray(cmp, form, arr)`
- Sets component value to array
- No deduplication (allows duplicates)
- Converts all values to strings
- Triggers form change event

---

## Current Issues / Complexity

1. **Choices.js conflicts**: Choices.js has its own event handling that conflicts with our handlers
2. **State synchronization**: Component value vs input field value vs what Choices.js thinks
3. **Quote handling**: Complex logic to detect and preserve quoted strings
4. **Duplicate detection**: Need to filter out existing values when appending
5. **Event timing**: Multiple handlers (input, keydown, keyup) can fire for same action

---

## Potential Simplifications

1. **Remove delimiter key handling**: Only support paste for bulk entry
2. **Remove Choices.js entirely**: Build custom Vue/vanilla chips component
3. **Simplify quote handling**: Only support simple comma-separated values
4. **Let Choices.js handle Enter/Tab**: Remove our interception, only handle paste

