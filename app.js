(function () {
  "use strict";

  var STORAGE_KEY = "holidays-custom-dates-poc-items-v1";
  var now = new Date();
  var currentYear = now.getFullYear();
  var nextYear = currentYear + 1;
  var requestSeq = 0;
  var COUNTRY_OPTIONS = [
    { value: "US", label: "United States", apiCode: "US" },
    { value: "CA", label: "Canada", apiCode: "CA" },
    { value: "AU", label: "Australia", apiCode: "AU" },
    { value: "SCT", label: "Scotland", apiCode: "GB" },
    { value: "ENG", label: "England", apiCode: "GB" },
    { value: "WLS", label: "Wales", apiCode: "GB" },
    { value: "GE", label: "Georgia", apiCode: "GE" },
    { value: "AR", label: "Argentina", apiCode: "AR" }
  ];

  var state = {
    items: [],
    ui: {
      addPopupOpen: false,
      addCountry: "US",
      addYear: currentYear,
      addLoading: false,
      addError: null,
      suggestedHolidays: [],
      selectedHolidayIds: {},
      stagedCustomDates: [],
      pendingErrors: [],
      tableDirty: false,
      tableEdits: {},
      fieldErrors: {},
      debugOpen: false,
      customModalOpen: false,
      customDraft: getDefaultCustomDraft(),
      customErrors: {}
    }
  };

  var els = {
    mainContent: document.getElementById("main-content"),
    stickyActions: document.getElementById("sticky-actions"),
    addPopupRoot: document.getElementById("add-popup-root"),
    customModalRoot: document.getElementById("custom-modal-root"),
    toastRoot: document.getElementById("toast-root"),
    debugPanel: document.getElementById("debug-panel"),
    debugJson: document.getElementById("debug-json"),
    debugToggle: document.getElementById("debug-toggle")
  };

  var fallbackHolidayData = {
    US: [
      { localName: "New Year's Day", date: "YEAR-01-01" },
      { localName: "Independence Day", date: "YEAR-07-04" },
      { localName: "Christmas Day", date: "YEAR-12-25" }
    ],
    AR: [
      { localName: "Año Nuevo", date: "YEAR-01-01" },
      { localName: "Día de la Independencia", date: "YEAR-07-09" },
      { localName: "Navidad", date: "YEAR-12-25" }
    ],
    CA: [
      { localName: "New Year's Day", date: "YEAR-01-01" },
      { localName: "Canada Day", date: "YEAR-07-01" },
      { localName: "Christmas Day", date: "YEAR-12-25" }
    ],
    AU: [
      { localName: "New Year's Day", date: "YEAR-01-01" },
      { localName: "Australia Day", date: "YEAR-01-26" },
      { localName: "Christmas Day", date: "YEAR-12-25" }
    ],
    GE: [
      { localName: "New Year's Day", date: "YEAR-01-01" },
      { localName: "Orthodox Christmas Day", date: "YEAR-01-07" },
      { localName: "Saint George's Day", date: "YEAR-11-23" }
    ],
    SCT: [
      { localName: "New Year's Day", date: "YEAR-01-01" },
      { localName: "Early May Bank Holiday", date: "YEAR-05-01" },
      { localName: "Christmas Day", date: "YEAR-12-25" }
    ],
    ENG: [
      { localName: "New Year's Day", date: "YEAR-01-01" },
      { localName: "Early May Bank Holiday", date: "YEAR-05-01" },
      { localName: "Christmas Day", date: "YEAR-12-25" }
    ],
    WLS: [
      { localName: "New Year's Day", date: "YEAR-01-01" },
      { localName: "Early May Bank Holiday", date: "YEAR-05-01" },
      { localName: "Christmas Day", date: "YEAR-12-25" }
    ],
    DEFAULT: [
      { localName: "New Year's Day", date: "YEAR-01-01" },
      { localName: "National Day", date: "YEAR-06-15" },
      { localName: "Christmas Day", date: "YEAR-12-25" }
    ]
  };

  function getDefaultCustomDraft() {
    return {
      name: "",
      date: "",
      closed: true,
      openAt: "",
      closedAt: "",
      annualRecurrence: false
    };
  }

  function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isValidDateFormat(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
      return false;
    }
    var parsed = new Date(value + "T00:00:00");
    return !Number.isNaN(parsed.getTime());
  }

  function normalizeTime(value) {
    return value ? value : null;
  }

  function formatDateLocalized(isoDate) {
    if (!isValidDateFormat(isoDate)) {
      return isoDate || "";
    }
    var parsed = new Date(isoDate + "T00:00:00");
    return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(parsed);
  }

  function formatTimeLocalized(timeValue) {
    if (!/^\d{2}:\d{2}$/.test(timeValue || "")) {
      return timeValue || "";
    }
    var parts = timeValue.split(":");
    var parsed = new Date(1970, 0, 1, Number(parts[0]), Number(parts[1]));
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(parsed);
  }

  function loadItems() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .filter(function (item) {
          return item && typeof item === "object" && item.id && item.name && item.date;
        })
        .map(function (item) {
          return {
            id: String(item.id),
            type: item.type === "custom" ? "custom" : "holiday",
            name: String(item.name),
            date: String(item.date),
            closed: Boolean(item.closed),
            openAt: item.openAt || null,
            closedAt: item.closedAt || null,
            annualRecurrence: Boolean(item.annualRecurrence),
            sourceCountry: item.sourceCountry || null,
            sourceYear: Number.isFinite(item.sourceYear) ? item.sourceYear : null,
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || new Date().toISOString()
          };
        });
    } catch (error) {
      return [];
    }
  }

  function saveItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  async function fetchHolidays(country, year) {
    var url = "https://date.nager.at/api/v3/PublicHolidays/" + encodeURIComponent(year) + "/" + encodeURIComponent(country);
    var response = await fetch(url);
    if (!response.ok) {
      throw new Error("Holiday API request failed");
    }
    var apiData = await response.json();
    if (!Array.isArray(apiData)) {
      return [];
    }
    return apiData.map(function (apiHoliday) {
      return normalizeHoliday(apiHoliday, country, year);
    });
  }

  function normalizeHoliday(apiHoliday, country, year) {
    var displayName = (apiHoliday && (apiHoliday.localName || apiHoliday.name)) || "Unnamed holiday";
    var date = (apiHoliday && apiHoliday.date) || "";
    return {
      holidayKey: "holiday-" + country + "-" + year + "-" + date + "-" + displayName.toLowerCase().replace(/\s+/g, "-"),
      type: "holiday",
      name: displayName,
      date: date,
      closed: true,
      openAt: null,
      closedAt: null,
      annualRecurrence: false,
      sourceCountry: country,
      sourceYear: Number(year)
    };
  }

  function getCountryOption(value) {
    for (var i = 0; i < COUNTRY_OPTIONS.length; i += 1) {
      if (COUNTRY_OPTIONS[i].value === value) {
        return COUNTRY_OPTIONS[i];
      }
    }
    return COUNTRY_OPTIONS[0];
  }

  function getFallbackHolidays(country, year) {
    var template = fallbackHolidayData[country] || fallbackHolidayData.DEFAULT;
    return template.map(function (holiday) {
      return normalizeHoliday(
        {
          localName: holiday.localName,
          date: holiday.date.replace("YEAR", String(year))
        },
        country,
        year
      );
    });
  }

  function dedupeHolidaysByDate(holidays) {
    var seenByDate = {};
    var deduped = [];
    holidays.forEach(function (holiday) {
      if (!holiday || !holiday.date) {
        return;
      }
      if (seenByDate[holiday.date]) {
        return;
      }
      seenByDate[holiday.date] = true;
      deduped.push(holiday);
    });
    return deduped;
  }

  function validateItemDraft(draft, existingItems, mode) {
    var errors = {};

    if (!draft.name || !String(draft.name).trim()) {
      errors.name = "Name is required.";
    }

    if (!draft.date || !isValidDateFormat(String(draft.date))) {
      errors.date = "Date is required and must be YYYY-MM-DD.";
    }

    if (!draft.closed) {
      if (!draft.openAt) {
        errors.openAt = "Open at is required when Closed is unchecked.";
      }
      if (!draft.closedAt) {
        errors.closedAt = "Closed at is required when Closed is unchecked.";
      }
      if (draft.openAt && draft.closedAt && draft.closedAt <= draft.openAt) {
        errors.closedAt = "Closed at must be after Open at.";
      }
    }

    if (mode === "create" && draft.date && isValidDateFormat(draft.date)) {
      var alreadyExists = existingItems.some(function (item) {
        return item.date === draft.date;
      });
      if (alreadyExists) {
        errors.date = "A row with this date already exists.";
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors: errors
    };
  }

  function computePendingAdditions(selectedHolidays, stagedCustomDates) {
    var holidayItems = selectedHolidays.map(function (h) {
      return {
        pendingType: "holiday",
        pendingKey: h.holidayKey,
        type: "holiday",
        name: h.name,
        date: h.date,
        closed: true,
        openAt: null,
        closedAt: null,
        annualRecurrence: false,
        sourceCountry: h.sourceCountry,
        sourceYear: h.sourceYear
      };
    });

    var customItems = stagedCustomDates.map(function (c) {
      return {
        pendingType: "custom",
        pendingKey: c.stagedId,
        type: "custom",
        name: c.name,
        date: c.date,
        closed: Boolean(c.closed),
        openAt: c.closed ? null : c.openAt,
        closedAt: c.closed ? null : c.closedAt,
        annualRecurrence: Boolean(c.annualRecurrence),
        sourceCountry: null,
        sourceYear: null
      };
    });

    return holidayItems.concat(customItems);
  }

  function detectDateConflicts(existingItems, pendingAdditions) {
    var conflicts = {};
    var existingDates = {};
    existingItems.forEach(function (item) {
      existingDates[item.date] = true;
    });

    var pendingCountByDate = {};
    pendingAdditions.forEach(function (item) {
      pendingCountByDate[item.date] = (pendingCountByDate[item.date] || 0) + 1;
      if (existingDates[item.date]) {
        conflicts[item.date] = true;
      }
    });

    Object.keys(pendingCountByDate).forEach(function (date) {
      if (pendingCountByDate[date] > 1) {
        conflicts[date] = true;
      }
    });

    return Object.keys(conflicts).sort();
  }

  function getItemById(id) {
    return state.items.find(function (item) {
      return item.id === id;
    }) || null;
  }

  function getEffectiveItem(item) {
    var edit = state.ui.tableEdits[item.id] || {};
    return {
      id: item.id,
      type: item.type,
      name: item.name,
      date: item.date,
      closed: typeof edit.closed === "boolean" ? edit.closed : item.closed,
      openAt: Object.prototype.hasOwnProperty.call(edit, "openAt") ? edit.openAt : item.openAt,
      closedAt: Object.prototype.hasOwnProperty.call(edit, "closedAt") ? edit.closedAt : item.closedAt,
      annualRecurrence: Object.prototype.hasOwnProperty.call(edit, "annualRecurrence")
        ? edit.annualRecurrence
        : item.annualRecurrence,
      sourceCountry: item.sourceCountry,
      sourceYear: item.sourceYear
    };
  }

  function recomputeTableValidation() {
    var fieldErrors = {};
    Object.keys(state.ui.tableEdits).forEach(function (id) {
      var base = getItemById(id);
      if (!base) {
        return;
      }
      var effective = getEffectiveItem(base);
      var result = validateItemDraft(effective, state.items, "edit");
      if (!result.valid) {
        fieldErrors[id] = result.errors;
      }
    });
    state.ui.fieldErrors = fieldErrors;
  }

  function upsertRowEdit(id, patch) {
    var base = getItemById(id);
    if (!base) {
      return;
    }

    var current = state.ui.tableEdits[id] || {};
    var merged = Object.assign({}, current, patch);

    var normalized = {};
    if (Object.prototype.hasOwnProperty.call(merged, "closed")) {
      normalized.closed = Boolean(merged.closed);
    }
    if (Object.prototype.hasOwnProperty.call(merged, "openAt")) {
      normalized.openAt = normalizeTime(merged.openAt);
    }
    if (Object.prototype.hasOwnProperty.call(merged, "closedAt")) {
      normalized.closedAt = normalizeTime(merged.closedAt);
    }
    if (Object.prototype.hasOwnProperty.call(merged, "annualRecurrence")) {
      normalized.annualRecurrence = Boolean(merged.annualRecurrence);
    }

    var isSameAsBase =
      (Object.prototype.hasOwnProperty.call(normalized, "closed") ? normalized.closed : base.closed) === base.closed &&
      (Object.prototype.hasOwnProperty.call(normalized, "openAt") ? normalized.openAt : base.openAt) === base.openAt &&
      (Object.prototype.hasOwnProperty.call(normalized, "closedAt") ? normalized.closedAt : base.closedAt) === base.closedAt &&
      (Object.prototype.hasOwnProperty.call(normalized, "annualRecurrence")
        ? normalized.annualRecurrence
        : base.annualRecurrence) === base.annualRecurrence;

    if (isSameAsBase) {
      delete state.ui.tableEdits[id];
    } else {
      state.ui.tableEdits[id] = normalized;
    }

    state.ui.tableDirty = Object.keys(state.ui.tableEdits).length > 0;
    recomputeTableValidation();
  }

  function applyEdits() {
    var hasErrors = Object.keys(state.ui.fieldErrors).length > 0;
    if (hasErrors) {
      return;
    }

    var timestamp = new Date().toISOString();
    var mergedItems = state.items.map(function (item) {
      var edit = state.ui.tableEdits[item.id];
      if (!edit) {
        return item;
      }
      var next = Object.assign({}, item, edit, { updatedAt: timestamp });
      if (next.closed) {
        next.openAt = null;
        next.closedAt = null;
      }
      return next;
    });

    state.items = mergedItems;
    state.ui.tableEdits = {};
    state.ui.fieldErrors = {};
    state.ui.tableDirty = false;
    saveItems(state.items);
    showToast("Saved.");
    render();
  }

  function revertEdits() {
    state.ui.tableEdits = {};
    state.ui.fieldErrors = {};
    state.ui.tableDirty = false;
    render();
  }

  function getSelectedHolidays() {
    return state.ui.suggestedHolidays.filter(function (holiday) {
      return Boolean(state.ui.selectedHolidayIds[holiday.holidayKey]);
    });
  }

  function openAddPopup() {
    state.ui.addPopupOpen = true;
    state.ui.pendingErrors = [];
    state.ui.selectedHolidayIds = {};
    state.ui.stagedCustomDates = [];
    state.ui.addError = null;
    state.ui.customModalOpen = false;
    state.ui.customDraft = getDefaultCustomDraft();
    state.ui.customErrors = {};
    render();
    refreshSuggestions();
  }

  function closeAddPopup() {
    state.ui.addPopupOpen = false;
    state.ui.pendingErrors = [];
    state.ui.selectedHolidayIds = {};
    state.ui.stagedCustomDates = [];
    state.ui.addError = null;
    state.ui.customModalOpen = false;
    state.ui.customDraft = getDefaultCustomDraft();
    state.ui.customErrors = {};
    render();
  }

  async function refreshSuggestions() {
    var seq = ++requestSeq;
    state.ui.addLoading = true;
    state.ui.addError = null;
    render();
    try {
      var countryOption = getCountryOption(state.ui.addCountry);
      var holidays = await fetchHolidays(countryOption.apiCode, state.ui.addYear);
      holidays = holidays.map(function (holiday) {
        return Object.assign({}, holiday, { sourceCountry: state.ui.addCountry });
      });
      holidays = dedupeHolidaysByDate(holidays);
      if (seq !== requestSeq) {
        return;
      }
      state.ui.suggestedHolidays = holidays;
      state.ui.selectedHolidayIds = {};
      state.ui.addError = null;
    } catch (error) {
      if (seq !== requestSeq) {
        return;
      }
      state.ui.suggestedHolidays = dedupeHolidaysByDate(getFallbackHolidays(state.ui.addCountry, state.ui.addYear));
      state.ui.selectedHolidayIds = {};
      state.ui.addError = "Could not fetch live holidays. Showing fallback data.";
    } finally {
      if (seq === requestSeq) {
        state.ui.addLoading = false;
      }
      render();
    }
  }

  function commitPendingAdditions() {
    var pending = computePendingAdditions(getSelectedHolidays(), state.ui.stagedCustomDates);
    var conflicts = detectDateConflicts(state.items, pending);
    if (conflicts.length > 0) {
      state.ui.pendingErrors = conflicts;
      render();
      return;
    }
    if (pending.length === 0) {
      state.ui.pendingErrors = ["Select or stage at least one item before adding."];
      render();
      return;
    }

    var timestamp = new Date().toISOString();
    var committed = pending.map(function (item) {
      return {
        id: generateId(),
        type: item.type,
        name: item.name,
        date: item.date,
        closed: Boolean(item.closed),
        openAt: item.closed ? null : item.openAt,
        closedAt: item.closed ? null : item.closedAt,
        annualRecurrence: Boolean(item.annualRecurrence),
        sourceCountry: item.sourceCountry || null,
        sourceYear: Number.isFinite(item.sourceYear) ? Number(item.sourceYear) : null,
        createdAt: timestamp,
        updatedAt: timestamp
      };
    });

    state.items = state.items.concat(committed);
    saveItems(state.items);
    closeAddPopup();
    showToast("Added.");
  }

  function removePendingItem(kind, key) {
    if (kind === "holiday") {
      delete state.ui.selectedHolidayIds[key];
    } else if (kind === "custom") {
      state.ui.stagedCustomDates = state.ui.stagedCustomDates.filter(function (item) {
        return item.stagedId !== key;
      });
    }
    state.ui.pendingErrors = [];
    render();
  }

  function openCustomModal() {
    state.ui.customModalOpen = true;
    state.ui.customDraft = getDefaultCustomDraft();
    state.ui.customErrors = {};
    render();
  }

  function closeCustomModal() {
    state.ui.customModalOpen = false;
    state.ui.customDraft = getDefaultCustomDraft();
    state.ui.customErrors = {};
    render();
  }

  function saveCustomDraftToStaging() {
    var draft = state.ui.customDraft;
    var payload = {
      type: "custom",
      name: draft.name.trim(),
      date: draft.date,
      closed: Boolean(draft.closed),
      openAt: draft.closed ? null : draft.openAt,
      closedAt: draft.closed ? null : draft.closedAt,
      annualRecurrence: Boolean(draft.annualRecurrence),
      sourceCountry: null,
      sourceYear: null
    };

    var result = validateItemDraft(payload, [], "create");
    if (!result.valid) {
      state.ui.customErrors = result.errors;
      render();
      return;
    }

    payload.stagedId = generateId();
    state.ui.stagedCustomDates.push(payload);
    state.ui.customModalOpen = false;
    state.ui.customDraft = getDefaultCustomDraft();
    state.ui.customErrors = {};
    state.ui.pendingErrors = [];
    render();
  }

  function deleteItem(id) {
    var item = getItemById(id);
    if (!item) {
      return;
    }
    var ok = window.confirm("Delete this item?\n\n" + item.name + " (" + formatDateLocalized(item.date) + ")");
    if (!ok) {
      return;
    }
    state.items = state.items.filter(function (row) {
      return row.id !== id;
    });
    saveItems(state.items);
    delete state.ui.tableEdits[id];
    delete state.ui.fieldErrors[id];
    state.ui.tableDirty = Object.keys(state.ui.tableEdits).length > 0;
    showToast("Deleted.");
    render();
  }

  function showToast(message) {
    var toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    els.toastRoot.appendChild(toast);
    window.setTimeout(function () {
      toast.remove();
    }, 2200);
  }

  function renderEmptyState() {
    return [
      '<div class="empty-state">',
      "<p>No holidays or custom dates yet. Add one to get started.</p>",
      "</div>"
    ].join("");
  }

  function renderMainTable() {
    var rowsHtml = state.items
      .map(function (item) {
        var effective = getEffectiveItem(item);
        var errors = state.ui.fieldErrors[item.id] || {};
        var holiday = item.type === "holiday";
        var typeLabel = holiday ? '<span class="pill">Holiday</span>' : '<span class="pill pill-custom">Custom date</span>';
        var openDisabled = effective.closed ? "disabled" : "";
        var closeDisabled = effective.closed ? "disabled" : "";
        var openHint = effective.openAt ? '<div class="time-hint">' + escapeHtml(formatTimeLocalized(effective.openAt)) + "</div>" : "";
        var closeHint = effective.closedAt ? '<div class="time-hint">' + escapeHtml(formatTimeLocalized(effective.closedAt)) + "</div>" : "";
        return [
          "<tr>",
          "<td>" + escapeHtml(formatDateLocalized(effective.date)) + "</td>",
          "<td>" + escapeHtml(effective.name) + "</td>",
          "<td>" + typeLabel + "</td>",
          '<td><input data-edit-field="closed" data-item-id="' + escapeHtml(item.id) + '" type="checkbox" ' + (effective.closed ? "checked" : "") + "></td>",
          "<td>",
          '<input class="table-input" data-edit-field="openAt" data-item-id="' + escapeHtml(item.id) + '" type="time" value="' + escapeHtml(effective.openAt || "") + '" ' + openDisabled + ">",
          openHint,
          errors.openAt ? '<div class="field-error">' + escapeHtml(errors.openAt) + "</div>" : "",
          "</td>",
          "<td>",
          '<input class="table-input" data-edit-field="closedAt" data-item-id="' + escapeHtml(item.id) + '" type="time" value="' + escapeHtml(effective.closedAt || "") + '" ' + closeDisabled + ">",
          closeHint,
          errors.closedAt ? '<div class="field-error">' + escapeHtml(errors.closedAt) + "</div>" : "",
          "</td>",
          "<td>",
          '<input data-edit-field="annualRecurrence" data-item-id="' + escapeHtml(item.id) + '" type="checkbox" ' + (effective.annualRecurrence ? "checked" : "") + " " + (holiday ? "disabled" : "") + ">",
          "</td>",
          '<td><button class="danger-button" data-action="delete-row" data-item-id="' + escapeHtml(item.id) + '" type="button">Delete</button></td>',
          "</tr>"
        ].join("");
      })
      .join("");

    return [
      '<div class="table-wrap">',
      "<table>",
      "<thead><tr>",
      "<th>Date</th><th>Name</th><th>Type</th><th>Closed</th><th>Open at</th><th>Closed at</th><th>Annual recurrence</th><th>Actions</th>",
      "</tr></thead>",
      "<tbody>" + rowsHtml + "</tbody>",
      "</table>",
      "</div>"
    ].join("");
  }

  function renderPendingArea() {
    var pending = computePendingAdditions(getSelectedHolidays(), state.ui.stagedCustomDates);
    var listHtml = pending.length
      ? pending
          .map(function (item) {
            var timeText =
              item.closed || !item.openAt || !item.closedAt
                ? ""
                : " - " + formatTimeLocalized(item.openAt) + " to " + formatTimeLocalized(item.closedAt);
            return [
              '<li class="pending-item">',
              "<div>",
              "<strong>" + escapeHtml(item.name) + "</strong> <small>(" + escapeHtml(formatDateLocalized(item.date) + timeText) + ")</small>",
              "</div>",
              '<button class="secondary-button" type="button" data-action="remove-pending" data-pending-type="' +
                escapeHtml(item.pendingType) +
                '" data-pending-key="' +
                escapeHtml(item.pendingKey) +
                '">Remove</button>',
              "</li>"
            ].join("");
          })
          .join("")
      : '<li class="pending-item"><small>No pending additions yet.</small></li>';

    var errorHtml = "";
    if (state.ui.pendingErrors.length > 0) {
      var items = state.ui.pendingErrors
        .map(function (entry) {
          var display = isValidDateFormat(entry) ? formatDateLocalized(entry) : entry;
          return "<li>" + escapeHtml(display) + "</li>";
        })
        .join("");
      errorHtml =
        '<div class="inline-error"><strong>Conflicting dates:</strong><ul>' + items + "</ul></div>";
    }

    return [
      errorHtml,
      '<div class="pending-area">',
      '<div class="pending-header">Pending additions (' + pending.length + ")</div>",
      '<ul class="pending-list">' + listHtml + "</ul>",
      "</div>"
    ].join("");
  }

  function renderAddPopup() {
    if (!state.ui.addPopupOpen) {
      return "";
    }

    var holidayListHtml;
    if (state.ui.addLoading) {
      holidayListHtml = '<div class="holiday-item"><span>Loading holidays...</span></div>';
    } else if (state.ui.suggestedHolidays.length === 0) {
      holidayListHtml = '<div class="holiday-item"><span>No holidays found.</span></div>';
    } else {
      holidayListHtml = state.ui.suggestedHolidays
        .map(function (holiday) {
          var checked = state.ui.selectedHolidayIds[holiday.holidayKey] ? "checked" : "";
          return [
            '<label class="holiday-item">',
            "<div>",
            "<strong>" + escapeHtml(holiday.name) + "</strong><br>",
            '<span class="holiday-date">' + escapeHtml(formatDateLocalized(holiday.date)) + "</span>",
            "</div>",
            '<input data-holiday-checkbox="true" data-holiday-key="' +
              escapeHtml(holiday.holidayKey) +
              '" type="checkbox" ' +
              checked +
              ">",
            "</label>"
          ].join("");
        })
        .join("");
    }

    var selectedCount = Object.keys(state.ui.selectedHolidayIds).length;
    var allSelected =
      state.ui.suggestedHolidays.length > 0 && selectedCount === state.ui.suggestedHolidays.length;
    var selectAllLabel = allSelected ? "Deselect all" : "Select all";

    return [
      '<div class="modal-backdrop">',
      '<div class="modal" role="dialog" aria-modal="true" aria-label="Add holidays and custom dates">',
      '<div class="modal-header"><h3>Add holidays and custom dates</h3><button class="ghost-button" type="button" data-action="close-add-popup">X</button></div>',
      '<div class="modal-body">',
      '<div class="controls-row">',
      "<div>",
      "<label for=\"add-country\">Country</label>",
      '<select id="add-country">',
      COUNTRY_OPTIONS.map(function (option) {
        var selected = state.ui.addCountry === option.value ? "selected" : "";
        return '<option value="' + escapeHtml(option.value) + '" ' + selected + ">" + escapeHtml(option.label) + "</option>";
      }).join(""),
      "</select>",
      "</div>",
      "<div>",
      "<label for=\"add-year\">Year</label>",
      '<input id="add-year" type="number" list="year-options" value="' + escapeHtml(state.ui.addYear) + '">',
      '<datalist id="year-options"><option value="' + currentYear + '"></option><option value="' + nextYear + '"></option></datalist>',
      "</div>",
      '<div style="display:flex;align-items:flex-end;">',
      '<button class="custom-date-button" type="button" data-action="open-custom-modal">Add custom date</button>',
      "</div>",
      "</div>",
      state.ui.addError ? '<div class="inline-warning">' + escapeHtml(state.ui.addError) + "</div>" : "",
      '<div class="controls-actions">',
      '<label class="checkbox-row"><input id="select-all-holidays" type="checkbox" ' + (allSelected ? "checked" : "") + ">" + escapeHtml(selectAllLabel) + "</label>",
      '<button class="ghost-button" type="button" data-action="clear-holiday-selection">Clear</button>',
      "</div>",
      '<div class="holiday-list">' + holidayListHtml + "</div>",
      renderPendingArea(),
      "</div>",
      '<div class="modal-footer">',
      '<button class="secondary-button" type="button" data-action="close-add-popup">Cancel</button>',
      '<button class="primary-button" type="button" data-action="commit-pending">Add</button>',
      "</div>",
      "</div>",
      "</div>"
    ].join("");
  }

  function renderCustomDateModal() {
    if (!state.ui.addPopupOpen || !state.ui.customModalOpen) {
      return "";
    }
    var draft = state.ui.customDraft;
    var errors = state.ui.customErrors;
    var timesDisabled = draft.closed ? "disabled" : "";
    return [
      '<div class="modal-backdrop">',
      '<div class="modal nested-modal" role="dialog" aria-modal="true" aria-label="Add custom date">',
      '<div class="modal-header"><h3>Add custom date</h3><button class="ghost-button" type="button" data-action="cancel-custom-modal">X</button></div>',
      '<div class="modal-body">',
      '<div class="form-grid">',
      '<div class="full"><label>Name</label><input id="custom-name" type="text" value="' + escapeHtml(draft.name) + '"></div>',
      errors.name ? '<div class="full field-error">' + escapeHtml(errors.name) + "</div>" : "",
      '<div><label>Date</label><input id="custom-date" type="date" value="' + escapeHtml(draft.date) + '"></div>',
      '<div class="checkbox-row" style="align-self:end;"><input id="custom-closed" type="checkbox" ' + (draft.closed ? "checked" : "") + '><label for="custom-closed">Closed</label></div>',
      errors.date ? '<div class="full field-error">' + escapeHtml(errors.date) + "</div>" : "",
      '<div><label>Open at</label><input id="custom-open-at" type="time" value="' + escapeHtml(draft.openAt) + '" ' + timesDisabled + "></div>",
      '<div><label>Closed at</label><input id="custom-closed-at" type="time" value="' + escapeHtml(draft.closedAt) + '" ' + timesDisabled + "></div>",
      errors.openAt ? '<div class="full field-error">' + escapeHtml(errors.openAt) + "</div>" : "",
      errors.closedAt ? '<div class="full field-error">' + escapeHtml(errors.closedAt) + "</div>" : "",
      '<div class="full checkbox-row"><input id="custom-annual" type="checkbox" ' + (draft.annualRecurrence ? "checked" : "") + '><label for="custom-annual">Annual recurrence</label></div>',
      "</div>",
      "</div>",
      '<div class="modal-footer">',
      '<button class="secondary-button" type="button" data-action="cancel-custom-modal">Cancel</button>',
      '<button class="primary-button" type="button" data-action="save-custom-modal">Save</button>',
      "</div>",
      "</div>",
      "</div>"
    ].join("");
  }

  function renderStickyActions() {
    if (!state.ui.tableDirty) {
      els.stickyActions.classList.add("hidden");
      els.stickyActions.innerHTML = "";
      return;
    }
    var hasErrors = Object.keys(state.ui.fieldErrors).length > 0;
    els.stickyActions.classList.remove("hidden");
    els.stickyActions.innerHTML = [
      '<button class="secondary-button" type="button" data-action="discard-edits">Discard changes</button>',
      '<button class="primary-button" type="button" data-action="save-edits" ' + (hasErrors ? "disabled" : "") + ">Save</button>"
    ].join("");
  }

  function renderDebugPanel() {
    els.debugPanel.classList.toggle("hidden", !state.ui.debugOpen);
    els.debugJson.textContent = JSON.stringify(state, null, 2);
    els.debugToggle.setAttribute("aria-expanded", state.ui.debugOpen ? "true" : "false");
    els.debugToggle.textContent = state.ui.debugOpen ? "Hide debug panel" : "Show debug panel";
  }

  function renderMainContent() {
    if (state.items.length === 0) {
      els.mainContent.innerHTML = renderEmptyState();
    } else {
      els.mainContent.innerHTML = renderMainTable();
    }
  }

  function render() {
    renderMainContent();
    renderStickyActions();
    els.addPopupRoot.innerHTML = renderAddPopup();
    els.customModalRoot.innerHTML = renderCustomDateModal();
    renderDebugPanel();
  }

  function bindGlobalEvents() {
    document.addEventListener("click", function (event) {
      var target = event.target;

      if (target.id === "open-add-popup-top" || target.id === "open-add-popup-empty") {
        openAddPopup();
        return;
      }

      var action = target.getAttribute("data-action");
      if (!action) {
        return;
      }

      if (action === "close-add-popup") {
        closeAddPopup();
      } else if (action === "commit-pending") {
        commitPendingAdditions();
      } else if (action === "clear-holiday-selection") {
        state.ui.selectedHolidayIds = {};
        state.ui.pendingErrors = [];
        render();
      } else if (action === "open-custom-modal") {
        openCustomModal();
      } else if (action === "cancel-custom-modal") {
        closeCustomModal();
      } else if (action === "save-custom-modal") {
        saveCustomDraftToStaging();
      } else if (action === "remove-pending") {
        removePendingItem(target.getAttribute("data-pending-type"), target.getAttribute("data-pending-key"));
      } else if (action === "save-edits") {
        applyEdits();
      } else if (action === "discard-edits") {
        revertEdits();
      } else if (action === "delete-row") {
        deleteItem(target.getAttribute("data-item-id"));
      }
    });

    document.addEventListener("change", function (event) {
      var target = event.target;

      if (target.id === "add-country") {
        state.ui.addCountry = target.value.toUpperCase();
        refreshSuggestions();
        return;
      }
      if (target.id === "add-year") {
        var parsedYear = Number(target.value);
        if (Number.isFinite(parsedYear) && parsedYear > 0) {
          state.ui.addYear = parsedYear;
          refreshSuggestions();
        }
        return;
      }
      if (target.id === "select-all-holidays") {
        if (target.checked) {
          var all = {};
          state.ui.suggestedHolidays.forEach(function (holiday) {
            all[holiday.holidayKey] = true;
          });
          state.ui.selectedHolidayIds = all;
        } else {
          state.ui.selectedHolidayIds = {};
        }
        state.ui.pendingErrors = [];
        render();
        return;
      }
      if (target.getAttribute("data-holiday-checkbox") === "true") {
        var key = target.getAttribute("data-holiday-key");
        if (target.checked) {
          state.ui.selectedHolidayIds[key] = true;
        } else {
          delete state.ui.selectedHolidayIds[key];
        }
        state.ui.pendingErrors = [];
        render();
        return;
      }

      var itemId = target.getAttribute("data-item-id");
      var field = target.getAttribute("data-edit-field");
      if (itemId && field) {
        if (field === "closed") {
          var closed = target.checked;
          if (closed) {
            upsertRowEdit(itemId, { closed: true, openAt: null, closedAt: null });
          } else {
            upsertRowEdit(itemId, { closed: false, openAt: "", closedAt: "" });
          }
        } else if (field === "openAt") {
          upsertRowEdit(itemId, { openAt: target.value || null });
        } else if (field === "closedAt") {
          upsertRowEdit(itemId, { closedAt: target.value || null });
        } else if (field === "annualRecurrence") {
          upsertRowEdit(itemId, { annualRecurrence: target.checked });
        }
        render();
        return;
      }

      if (target.id === "custom-closed") {
        state.ui.customDraft.closed = target.checked;
        if (target.checked) {
          state.ui.customDraft.openAt = "";
          state.ui.customDraft.closedAt = "";
        }
        render();
        return;
      }
      if (target.id === "custom-annual") {
        state.ui.customDraft.annualRecurrence = target.checked;
        return;
      }
    });

    document.addEventListener("input", function (event) {
      var target = event.target;
      if (target.id === "custom-name") {
        state.ui.customDraft.name = target.value;
      } else if (target.id === "custom-date") {
        state.ui.customDraft.date = target.value;
      } else if (target.id === "custom-open-at") {
        state.ui.customDraft.openAt = target.value;
      } else if (target.id === "custom-closed-at") {
        state.ui.customDraft.closedAt = target.value;
      } else {
        return;
      }
    });

    els.debugToggle.addEventListener("click", function () {
      state.ui.debugOpen = !state.ui.debugOpen;
      render();
    });
  }

  function init() {
    state.items = loadItems();
    bindGlobalEvents();
    render();
  }

  init();
})();
