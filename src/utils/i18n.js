/**
 * i18n for Vue app UI. Translations aligned with sections/03-i18n.js (en, de, ro).
 * Use t(locale, key, ...args) for interpolated messages.
 */
const messages = {
  en: {
    editDocument: 'Edit properties',
    save: 'Update',
    documentId: 'Document ID',
    showMultivalueOnly: 'Limit to multi-value fields',
    tabProperties: 'Standard properties',
    tabSystem: 'System properties',
    errorNoContext: 'No formInit context (base missing).',
    errorNoDocId: 'No document ID (docId) available. Set via URL param (e.g. dmsObjectId, o2url) or form data.',
    errorNoRepo: 'No repository ID found.',
    errorSrmNoItem: 'SRM returned no item for this document.',
    errorNoCategory: 'Could not determine category ID from SRM.',
    noChangesToSave: 'No changes to save.',
    savedSuccessfully: 'Document updated successfully.',
    saveFailed: 'Update failed',
    saveFailedWithStatus: (s) => `Update failed (${s}).`,
    add: 'Add',
    paste: 'Paste',
    clear: 'Clear',
    importFromDocPlaceholder: 'Import from Doc ID (Enter to load)',
    import: 'Import',
    addValuePlaceholder: 'Add value (or use {0} for multiple)',
    addValuePlaceholderShort: 'Add value...',
    pasteNotAvailable: 'Paste not available',
    pasteFailed: (m) => `Paste failed: ${m}`,
    noValuesInClipboard: 'No values in clipboard',
    pastedNValues: (n) => `Pasted ${n} value(s).`,
    clearedAllValues: 'Cleared all values',
    importedNValues: (n) => `Imported ${n} value(s).`,
    noValuesInDocument: 'No values in document',
    importFailed: (m) => `Import failed: ${m}`,
    noSystemProperties: 'No system properties available.',
    runningStandalone: 'Running standalone (no host). When loaded by formInit, the edit flow will run with context (form, base, uiLocale, mountEl).'
  },
  de: {
    editDocument: 'Eigenschaften bearbeiten',
    save: 'Aktualisieren',
    documentId: 'Dokument-ID',
    showMultivalueOnly: 'auf Multivalue-Felder begrenzen',
    tabProperties: 'Standardeigenschaften',
    tabSystem: 'Systemfelder',
    errorNoContext: 'Kein formInit-Kontext (Basis-URL fehlt).',
    errorNoDocId: 'Keine Dokument-ID (docId) verfügbar. Über URL-Parameter (z. B. dmsObjectId, o2url) oder Formulardaten setzen.',
    errorNoRepo: 'Keine Repository-ID gefunden.',
    errorSrmNoItem: 'SRM hat kein Objekt für dieses Dokument zurückgegeben.',
    errorNoCategory: 'Kategorie-ID aus SRM konnte nicht ermittelt werden.',
    noChangesToSave: 'Keine Änderungen zu speichern.',
    savedSuccessfully: 'Dokument wurde erfolgreich aktualisiert.',
    saveFailed: 'Aktualisierung fehlgeschlagen',
    saveFailedWithStatus: (s) => `Aktualisierung fehlgeschlagen (${s}).`,
    add: 'Hinzufügen',
    paste: 'Einfügen',
    clear: 'Leeren',
    importFromDocPlaceholder: 'Import aus Dokument-ID (Enter zum Laden)',
    import: 'Importieren',
    addValuePlaceholder: 'Wert hinzufügen (oder {0} für mehrere)',
    addValuePlaceholderShort: 'Wert hinzufügen...',
    pasteNotAvailable: 'Einfügen nicht verfügbar',
    pasteFailed: (m) => `Einfügen fehlgeschlagen: ${m}`,
    noValuesInClipboard: 'Keine Werte in der Zwischenablage',
    pastedNValues: (n) => `${n} Wert(e) eingefügt.`,
    clearedAllValues: 'Alle Werte gelöscht',
    importedNValues: (n) => `${n} Wert(e) importiert.`,
    noValuesInDocument: 'Keine Werte im Dokument',
    importFailed: (m) => `Import fehlgeschlagen: ${m}`,
    noSystemProperties: 'Keine Systemeigenschaften verfügbar.',
    runningStandalone: 'Standalone (kein Host). Bei Laden durch formInit läuft der Bearbeitungsfluss mit Kontext (form, base, uiLocale, mountEl).'
  },
  ro: {
    editDocument: 'Editează proprietăți',
    save: 'Actualizează',
    documentId: 'ID document',
    showMultivalueOnly: 'doar câmpuri multi-valoare',
    tabProperties: 'Proprietăți standard',
    tabSystem: 'Proprietăți de sistem',
    errorNoContext: 'Lipsește contextul formInit (baza URL).',
    errorNoDocId: 'Nu este disponibil niciun ID de document (docId). Setați prin parametru URL (ex. dmsObjectId, o2url) sau date formular.',
    errorNoRepo: 'Nu s-a găsit ID-ul repository-ului.',
    errorSrmNoItem: 'SRM nu a returnat niciun element pentru acest document.',
    errorNoCategory: 'Nu s-a putut determina ID-ul categoriei din SRM.',
    noChangesToSave: 'Nu există modificări de salvat.',
    savedSuccessfully: 'Document actualizat cu succes.',
    saveFailed: 'Actualizarea a eșuat',
    saveFailedWithStatus: (s) => `Actualizarea a eșuat (${s}).`,
    add: 'Adaugă',
    paste: 'Lipește',
    clear: 'Golește',
    importFromDocPlaceholder: 'Import din ID document (Enter pentru încărcare)',
    import: 'Importă',
    addValuePlaceholder: 'Adaugă valoare (sau folosește {0} pentru mai multe)',
    addValuePlaceholderShort: 'Adaugă valoare...',
    pasteNotAvailable: 'Lipirea nu este disponibilă',
    pasteFailed: (m) => `Lipirea a eșuat: ${m}`,
    noValuesInClipboard: 'Nicio valoare în clipboard',
    pastedNValues: (n) => `${n} valoare(i) lipit(e).`,
    clearedAllValues: 'Toate valorile au fost șterse',
    importedNValues: (n) => `S-au importat ${n} valori.`,
    noValuesInDocument: 'Nicio valoare în document',
    importFailed: (m) => `Import nereușit: ${m}`,
    noSystemProperties: 'Nicio proprietate de sistem disponibilă.',
    runningStandalone: 'Rulare standalone (fără host). La încărcare prin formInit, fluxul de editare rulează cu context (form, base, uiLocale, mountEl).'
  }
}

/** Resolve locale to a supported language (en, de, ro). */
function resolveLocale (locale) {
  const l = (locale || 'en').toString().trim().toLowerCase()
  if (l.startsWith('de')) return 'de'
  if (l.startsWith('ro')) return 'ro'
  return 'en'
}

/**
 * Translate key for locale. Usage: t(locale, 'save'), t(locale, 'pastedNValues', 3).
 */
export function t (locale, key, ...args) {
  const lang = resolveLocale(locale)
  const dict = messages[lang] || messages.en
  let value = dict[key] ?? messages.en[key] ?? key
  if (typeof value === 'function') value = value(...args)
  if (args.length > 0 && typeof value === 'string') {
    args.forEach((a, i) => { value = value.replace(`{${i}}`, String(a)) })
  }
  return value
}

export { messages, resolveLocale }
