const endpoints = {
    watchlist: "/watchlist/",
    notes: "/financenotes/",
};

const state = {
    watchlist: [],
    notes: [],
    search: "",
    ticker: "",
    sort: "newest",
};

const elements = {
    refreshAll: document.getElementById("refresh-all"),
    statusWord: document.getElementById("status-word"),
    lastSync: document.getElementById("last-sync"),
    watchlistCount: document.getElementById("watchlist-count"),
    notesCount: document.getElementById("notes-count"),
    tickerCount: document.getElementById("ticker-count"),
    watchlistVisibleCount: document.getElementById("watchlist-visible-count"),
    notesVisibleCount: document.getElementById("notes-visible-count"),
    globalSearch: document.getElementById("global-search"),
    tickerFilter: document.getElementById("ticker-filter"),
    sortMode: document.getElementById("sort-mode"),
    clearFilters: document.getElementById("clear-filters"),
    watchlistList: document.getElementById("watchlist-list"),
    notesList: document.getElementById("finance-notes-list"),
    watchlistForm: document.getElementById("watchlist-form"),
    watchlistId: document.getElementById("watchlist-id"),
    watchlistTicker: document.getElementById("watchlist-ticker"),
    watchlistCompany: document.getElementById("watchlist-company"),
    watchlistNotes: document.getElementById("watchlist-notes"),
    watchlistMessage: document.getElementById("watchlist-message"),
    watchlistSubmit: document.getElementById("watchlist-submit"),
    watchlistFormTitle: document.getElementById("watchlist-form-title"),
    cancelWatchlistEdit: document.getElementById("cancel-watchlist-edit"),
    noteForm: document.getElementById("finance-note-form"),
    noteId: document.getElementById("finance-note-id"),
    noteTicker: document.getElementById("note-ticker"),
    noteTitle: document.getElementById("note-title"),
    noteTags: document.getElementById("note-tags"),
    noteSourceUrl: document.getElementById("note-source-url"),
    noteContent: document.getElementById("note-content"),
    noteMessage: document.getElementById("finance-note-message"),
    noteSubmit: document.getElementById("finance-note-submit"),
    noteFormTitle: document.getElementById("finance-note-form-title"),
    cancelNoteEdit: document.getElementById("cancel-finance-note-edit"),
    dialog: document.getElementById("detail-dialog"),
    dialogEyebrow: document.getElementById("dialog-eyebrow"),
    dialogTitle: document.getElementById("dialog-title"),
    dialogBody: document.getElementById("dialog-body"),
};

function normalizeTicker(value) {
    return value.trim().toUpperCase();
}

function parseTags(value) {
    return value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
}

function formatTags(tags) {
    return Array.isArray(tags) && tags.length > 0 ? tags.join(", ") : "Not provided";
}

function formatDate(value) {
    if (!value) {
        return "No date";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function getDateTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function setMessage(element, text, type = "") {
    element.textContent = text;
    element.className = type ? `message ${type}` : "message";
}

function setStatus(text, tone, note) {
    elements.statusWord.textContent = text;
    elements.statusWord.className = tone ? `status-text ${tone}` : "status-text";
    elements.lastSync.textContent = note;
}

function showDialog() {
    if (typeof elements.dialog.showModal === "function") {
        elements.dialog.showModal();
        return;
    }

    elements.dialog.setAttribute("open", "");
}

function clearNode(node) {
    while (node.firstChild) {
        node.removeChild(node.firstChild);
    }
}

function createTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) {
        element.className = className;
    }
    element.textContent = text;
    return element;
}

async function apiRequest(url, options = {}) {
    const headers = {
        Accept: "application/json",
        ...options.headers,
    };

    if (options.body) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const detail = typeof data === "object" && data !== null
            ? data.detail || data.message || JSON.stringify(data)
            : data;

        throw new Error(detail || `Request failed with status ${response.status}`);
    }

    return data;
}

function allTickers() {
    const tickers = new Set();

    state.watchlist.forEach((item) => tickers.add(item.ticker));
    state.notes.forEach((note) => tickers.add(note.ticker));

    return [...tickers]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
}

function searchableText(record, fields) {
    return fields
        .map((field) => record[field] || "")
        .join(" ")
        .toLowerCase();
}

function filterRecords(records, fields) {
    const search = state.search.toLowerCase();

    return records.filter((record) => {
        const matchesTicker = !state.ticker || record.ticker === state.ticker;
        const matchesSearch = !search || searchableText(record, fields).includes(search);
        return matchesTicker && matchesSearch;
    });
}

function sortRecords(records) {
    const sorted = [...records];

    sorted.sort((first, second) => {
        if (state.sort === "ticker") {
            return (first.ticker || "").localeCompare(second.ticker || "");
        }

        const firstTime = getDateTime(first.created_at);
        const secondTime = getDateTime(second.created_at);

        return state.sort === "oldest"
            ? firstTime - secondTime
            : secondTime - firstTime;
    });

    return sorted;
}

function updateTickerFilter() {
    const selectedTicker = state.ticker;
    const tickers = allTickers();

    clearNode(elements.tickerFilter);

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "All tickers";
    elements.tickerFilter.appendChild(defaultOption);

    tickers.forEach((ticker) => {
        const option = document.createElement("option");
        option.value = ticker;
        option.textContent = ticker;
        elements.tickerFilter.appendChild(option);
    });

    if (tickers.includes(selectedTicker)) {
        elements.tickerFilter.value = selectedTicker;
    } else {
        state.ticker = "";
        elements.tickerFilter.value = "";
    }
}

function renderSummary() {
    elements.watchlistCount.textContent = state.watchlist.length;
    elements.notesCount.textContent = state.notes.length;
    elements.tickerCount.textContent = allTickers().length;
}

function renderEmptyList(container, title, body) {
    clearNode(container);

    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.appendChild(createTextElement("strong", "", title));
    empty.appendChild(createTextElement("span", "", body));
    container.appendChild(empty);
}

function actionButton(label, action, type, id, className = "button subtle-button") {
    const button = document.createElement("button");
    button.className = className;
    button.type = "button";
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.type = type;
    button.dataset.id = id;
    return button;
}

function renderTagList(tags) {
    const tagList = document.createElement("div");
    tagList.className = "tag-list";

    if (!Array.isArray(tags) || tags.length === 0) {
        return tagList;
    }

    tags.forEach((tag) => {
        tagList.appendChild(createTextElement("span", "tag-pill", tag));
    });

    return tagList;
}

function renderWatchlistCard(item) {
    const card = document.createElement("article");
    card.className = "record-card";

    const topRow = document.createElement("div");
    topRow.className = "record-top-row";
    topRow.appendChild(createTextElement("span", "ticker-badge", item.ticker));
    topRow.appendChild(createTextElement("span", "record-id", `#${item.id}`));

    const title = createTextElement("h3", "", item.company_name || "Company not added");
    const notes = createTextElement("p", "record-body", item.notes || "No watchlist note yet.");
    const created = createTextElement("span", "record-date", `Created ${formatDate(item.created_at)}`);

    const actions = document.createElement("div");
    actions.className = "record-actions";
    actions.appendChild(actionButton("View", "view", "watchlist", item.id));
    actions.appendChild(actionButton("Edit", "edit", "watchlist", item.id));
    actions.appendChild(actionButton("Delete", "delete", "watchlist", item.id, "button danger-button"));

    card.appendChild(topRow);
    card.appendChild(title);
    card.appendChild(notes);
    card.appendChild(created);
    card.appendChild(actions);

    return card;
}

function renderNoteCard(note) {
    const card = document.createElement("article");
    card.className = "record-card";

    const topRow = document.createElement("div");
    topRow.className = "record-top-row";
    topRow.appendChild(createTextElement("span", "ticker-badge", note.ticker));
    topRow.appendChild(createTextElement("span", "record-id", `#${note.id}`));

    const title = createTextElement("h3", "", note.title);
    const content = createTextElement("p", "record-body", note.content);
    const tags = renderTagList(note.tags);
    const created = createTextElement("span", "record-date", `Created ${formatDate(note.created_at)}`);

    const meta = document.createElement("div");
    meta.className = "note-meta";
    if (note.source_url) {
        const sourceLink = document.createElement("a");
        sourceLink.className = "source-link";
        sourceLink.href = note.source_url;
        sourceLink.target = "_blank";
        sourceLink.rel = "noreferrer";
        sourceLink.textContent = "Open source";
        meta.appendChild(sourceLink);
    }

    const actions = document.createElement("div");
    actions.className = "record-actions";
    actions.appendChild(actionButton("View", "view", "notes", note.id));
    actions.appendChild(actionButton("Edit", "edit", "notes", note.id));
    actions.appendChild(actionButton("Delete", "delete", "notes", note.id, "button danger-button"));

    card.appendChild(topRow);
    card.appendChild(title);
    card.appendChild(content);
    card.appendChild(tags);
    if (meta.childElementCount > 0) {
        card.appendChild(meta);
    }
    card.appendChild(created);
    card.appendChild(actions);

    return card;
}

function renderLists() {
    const watchlist = sortRecords(filterRecords(state.watchlist, ["ticker", "company_name", "notes"]));
    const notes = sortRecords(filterRecords(state.notes, ["ticker", "title", "content", "tags", "source_url"]));

    clearNode(elements.watchlistList);
    clearNode(elements.notesList);

    elements.watchlistVisibleCount.textContent = `${watchlist.length} shown`;
    elements.notesVisibleCount.textContent = `${notes.length} shown`;

    if (watchlist.length === 0) {
        renderEmptyList(
            elements.watchlistList,
            state.watchlist.length === 0 ? "No tickers yet" : "No matching tickers",
            state.watchlist.length === 0 ? "Add your first watchlist item above." : "Try clearing the filters."
        );
    } else {
        watchlist.forEach((item) => elements.watchlistList.appendChild(renderWatchlistCard(item)));
    }

    if (notes.length === 0) {
        renderEmptyList(
            elements.notesList,
            state.notes.length === 0 ? "No finance notes yet" : "No matching notes",
            state.notes.length === 0 ? "Add your first note above." : "Try clearing the filters."
        );
    } else {
        notes.forEach((note) => elements.notesList.appendChild(renderNoteCard(note)));
    }
}

function renderAll() {
    renderSummary();
    updateTickerFilter();
    renderLists();
}

async function loadData() {
    setStatus("Syncing", "pending", "Loading from the API...");
    elements.refreshAll.disabled = true;

    try {
        const [watchlist, notes] = await Promise.all([
            apiRequest(endpoints.watchlist),
            apiRequest(endpoints.notes),
        ]);

        state.watchlist = Array.isArray(watchlist) ? watchlist : [];
        state.notes = Array.isArray(notes) ? notes : [];

        renderAll();
        setStatus("Online", "success", `Last synced ${new Date().toLocaleTimeString()}`);
    } catch (error) {
        console.error(error);
        setStatus("Needs attention", "error", "Could not load API data. Check the server and database.");
        renderEmptyList(elements.watchlistList, "Could not load watchlist", "The browser could not read GET /watchlist/.");
        renderEmptyList(elements.notesList, "Could not load notes", "The browser could not read GET /financenotes/.");
    } finally {
        elements.refreshAll.disabled = false;
    }
}

function watchlistPayload() {
    return {
        ticker: normalizeTicker(elements.watchlistTicker.value),
        company_name: elements.watchlistCompany.value.trim() || null,
        notes: elements.watchlistNotes.value.trim() || null,
    };
}

function notePayload() {
    return {
        ticker: normalizeTicker(elements.noteTicker.value),
        title: elements.noteTitle.value.trim(),
        content: elements.noteContent.value.trim(),
        tags: parseTags(elements.noteTags.value),
        source_url: elements.noteSourceUrl.value.trim() || null,
    };
}

function resetWatchlistForm() {
    elements.watchlistForm.reset();
    elements.watchlistId.value = "";
    elements.watchlistFormTitle.textContent = "Add ticker";
    elements.watchlistSubmit.textContent = "Save ticker";
    elements.cancelWatchlistEdit.classList.add("is-hidden");
    setMessage(elements.watchlistMessage, "");
}

function resetNoteForm() {
    elements.noteForm.reset();
    elements.noteId.value = "";
    elements.noteFormTitle.textContent = "Add finance note";
    elements.noteSubmit.textContent = "Save note";
    elements.cancelNoteEdit.classList.add("is-hidden");
    setMessage(elements.noteMessage, "");
}

async function saveWatchlistItem(event) {
    event.preventDefault();

    const id = elements.watchlistId.value;
    const editing = Boolean(id);
    const payload = watchlistPayload();

    setMessage(elements.watchlistMessage, editing ? "Updating ticker..." : "Saving ticker...");
    elements.watchlistSubmit.disabled = true;

    try {
        await apiRequest(editing ? `${endpoints.watchlist}${id}` : endpoints.watchlist, {
            method: editing ? "PUT" : "POST",
            body: JSON.stringify(payload),
        });

        resetWatchlistForm();
        setMessage(elements.watchlistMessage, editing ? "Ticker updated." : "Ticker saved.", "success");
        await loadData();
    } catch (error) {
        console.error(error);
        setMessage(
            elements.watchlistMessage,
            "Could not save ticker. If it already exists, edit the existing card.",
            "error"
        );
    } finally {
        elements.watchlistSubmit.disabled = false;
    }
}

async function saveNote(event) {
    event.preventDefault();

    const id = elements.noteId.value;
    const editing = Boolean(id);
    const payload = notePayload();

    setMessage(elements.noteMessage, editing ? "Updating note..." : "Saving note...");
    elements.noteSubmit.disabled = true;

    try {
        await apiRequest(editing ? `${endpoints.notes}${id}` : endpoints.notes, {
            method: editing ? "PUT" : "POST",
            body: JSON.stringify(payload),
        });

        resetNoteForm();
        setMessage(elements.noteMessage, editing ? "Note updated." : "Note saved.", "success");
        await loadData();
    } catch (error) {
        console.error(error);
        setMessage(elements.noteMessage, "Could not save note. Check the fields and try again.", "error");
    } finally {
        elements.noteSubmit.disabled = false;
    }
}

function editWatchlistItem(id) {
    const item = state.watchlist.find((entry) => String(entry.id) === String(id));
    if (!item) {
        return;
    }

    elements.watchlistId.value = item.id;
    elements.watchlistTicker.value = item.ticker || "";
    elements.watchlistCompany.value = item.company_name || "";
    elements.watchlistNotes.value = item.notes || "";
    elements.watchlistFormTitle.textContent = `Edit ${item.ticker}`;
    elements.watchlistSubmit.textContent = "Update ticker";
    elements.cancelWatchlistEdit.classList.remove("is-hidden");
    setMessage(elements.watchlistMessage, "Editing existing watchlist item.");
    elements.watchlistForm.scrollIntoView({ behavior: "smooth", block: "start" });
    elements.watchlistTicker.focus();
}

function editNote(id) {
    const note = state.notes.find((entry) => String(entry.id) === String(id));
    if (!note) {
        return;
    }

    elements.noteId.value = note.id;
    elements.noteTicker.value = note.ticker || "";
    elements.noteTitle.value = note.title || "";
    elements.noteTags.value = Array.isArray(note.tags) ? note.tags.join(", ") : "";
    elements.noteSourceUrl.value = note.source_url || "";
    elements.noteContent.value = note.content || "";
    elements.noteFormTitle.textContent = `Edit ${note.ticker} note`;
    elements.noteSubmit.textContent = "Update note";
    elements.cancelNoteEdit.classList.remove("is-hidden");
    setMessage(elements.noteMessage, "Editing existing finance note.");
    elements.noteForm.scrollIntoView({ behavior: "smooth", block: "start" });
    elements.noteTicker.focus();
}

async function deleteRecord(type, id) {
    const label = type === "watchlist" ? "watchlist item" : "finance note";
    const ok = window.confirm(`Delete this ${label}?`);

    if (!ok) {
        return;
    }

    try {
        await apiRequest(`${type === "watchlist" ? endpoints.watchlist : endpoints.notes}${id}`, {
            method: "DELETE",
        });
        await loadData();
    } catch (error) {
        console.error(error);
        setStatus("Needs attention", "error", `Could not delete ${label}.`);
    }
}

function addDetailRow(parent, label, value) {
    const row = document.createElement("div");
    row.className = "detail-row";

    row.appendChild(createTextElement("span", "", label));
    row.appendChild(createTextElement("strong", "", value || "Not provided"));
    parent.appendChild(row);
}

async function viewRecord(type, id) {
    const isWatchlist = type === "watchlist";
    const url = `${isWatchlist ? endpoints.watchlist : endpoints.notes}${id}`;

    elements.dialogEyebrow.textContent = isWatchlist ? "GET /watchlist/{id}" : "GET /financenotes/{id}";
    elements.dialogTitle.textContent = "Loading record";
    clearNode(elements.dialogBody);
    elements.dialogBody.appendChild(createTextElement("p", "record-body", "Fetching the latest version from the API..."));
    showDialog();

    try {
        const record = await apiRequest(url);
        elements.dialogTitle.textContent = isWatchlist
            ? `${record.ticker} watchlist item`
            : `${record.ticker} finance note`;

        clearNode(elements.dialogBody);
        addDetailRow(elements.dialogBody, "ID", String(record.id));
        addDetailRow(elements.dialogBody, "Ticker", record.ticker);

        if (isWatchlist) {
            addDetailRow(elements.dialogBody, "Company", record.company_name);
            addDetailRow(elements.dialogBody, "Notes", record.notes);
        } else {
            addDetailRow(elements.dialogBody, "Title", record.title);
            addDetailRow(elements.dialogBody, "Content", record.content);
            addDetailRow(elements.dialogBody, "Tags", formatTags(record.tags));
            addDetailRow(elements.dialogBody, "Source URL", record.source_url);
        }

        addDetailRow(elements.dialogBody, "Created", formatDate(record.created_at));
    } catch (error) {
        console.error(error);
        elements.dialogTitle.textContent = "Could not load record";
        clearNode(elements.dialogBody);
        elements.dialogBody.appendChild(createTextElement("p", "message error", "The detail endpoint returned an error."));
    }
}

function handleRecordAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button) {
        return;
    }

    const { action, type, id } = button.dataset;

    if (action === "view") {
        viewRecord(type, id);
    }

    if (action === "edit") {
        type === "watchlist" ? editWatchlistItem(id) : editNote(id);
    }

    if (action === "delete") {
        deleteRecord(type, id);
    }
}

function handleFilters() {
    state.search = elements.globalSearch.value.trim();
    state.ticker = elements.tickerFilter.value;
    state.sort = elements.sortMode.value;
    renderLists();
}

elements.watchlistForm.addEventListener("submit", saveWatchlistItem);
elements.noteForm.addEventListener("submit", saveNote);
elements.cancelWatchlistEdit.addEventListener("click", resetWatchlistForm);
elements.cancelNoteEdit.addEventListener("click", resetNoteForm);
elements.refreshAll.addEventListener("click", loadData);
elements.globalSearch.addEventListener("input", handleFilters);
elements.tickerFilter.addEventListener("change", handleFilters);
elements.sortMode.addEventListener("change", handleFilters);
elements.clearFilters.addEventListener("click", () => {
    elements.globalSearch.value = "";
    elements.tickerFilter.value = "";
    elements.sortMode.value = "newest";
    state.search = "";
    state.ticker = "";
    state.sort = "newest";
    renderLists();
});
document.addEventListener("click", handleRecordAction);

loadData();
