// Google Apps Script "Web App" that lets server.py read/write per-user word
// progress and topic visibility in this spreadsheet instead of a local file,
// so this data survives on hosts with an ephemeral filesystem.
//
// One-time setup:
//   1. Create a Google Sheet, then Extensions > Apps Script, and replace the
//      default Code.gs contents with this file.
//   2. Run the `setup` function once (Run menu > select "setup") to create
//      the "progress" and "topics" sheet tabs with their header rows.
//      Approve the permission prompt when asked.
//   3. Project Settings (gear icon) > Script Properties > add API_TOKEN with
//      a long random secret value. This is the shared secret server.py must
//      send with every request.
//   4. Deploy > New deployment > type "Web app". Execute as "Me", access
//      "Anyone" (this is what lets server.py call it without a Google
//      login — API_TOKEN is what keeps it private). Copy the resulting
//      /exec URL.
//   5. Set SHEETS_WEBAPP_URL to that URL and SHEETS_API_TOKEN to the same
//      secret from step 3 as environment variables for server.py.
//
// To assign a word to a user, add a row to the "progress" sheet:
//   email | lang | word_id | confident | shown_count | show
// e.g.  patricia.ramos@gmail.com | english | en-0001 | FALSE | 0 | TRUE
//
// To make a topic (and its texts) visible to a user, add a row to the
// "topics" sheet:
//   email | lang | topic_id
// e.g.  patricia.ramos@gmail.com | english | ch-01-tp-01
// A topic with no matching row is simply not visible to that user.
//
// --- New schema (RESTRUCTURE_REQUIREMENTS.md §6), rolling out alongside the
// above, not replacing it yet ---
// A "users" sheet replaces "topics": one row per (email, language_pair), with
// an enabled-topics *list* instead of one row per topic:
//   email | language_pair | topic_ids
// e.g.  patricia.ramos@gmail.com | pt-en | top-01, top-02
// Reached via the v2_get_topics action.
//
// Per-user progress tabs replace the shared "progress" sheet: one sheet per
// user, named "<email>-progress" (lowercased), auto-created on first
// v2_upsert_progress call for that user:
//   language_pair | word_id | confident | shown_count | show
// Reached via the v2_get_progress / v2_upsert_progress actions.

const PROGRESS_SHEET_NAME = "progress";
const PROGRESS_HEADERS = ["email", "lang", "word_id", "confident", "shown_count", "show"];

const TOPICS_SHEET_NAME = "topics";
const TOPICS_HEADERS = ["email", "lang", "topic_id"];

const USERS_SHEET_NAME = "users";
const USERS_HEADERS = ["email", "language_pair", "topic_ids"];

const USER_PROGRESS_HEADERS = ["language_pair", "word_id", "confident", "shown_count", "show"];

// Same mapping as backend/app/infrastructure/legacy_language_names.py — kept
// in sync by hand, not shared code (Apps Script and Python can't share a
// module), so any pair added there must be added here too.
const LEGACY_LANG_TO_PAIR = {
  english: "pt-en",
  spanish: "pt-es",
};

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet(ss, PROGRESS_SHEET_NAME, PROGRESS_HEADERS);
  ensureSheet(ss, TOPICS_SHEET_NAME, TOPICS_HEADERS);
  ensureSheet(ss, USERS_SHEET_NAME, USERS_HEADERS);
}

function userProgressSheetName(email) {
  return email.toLowerCase() + "-progress";
}

function getUserProgressSheetIfExists(ss, email) {
  return ss.getSheetByName(userProgressSheetName(email));
}

function getOrCreateUserProgressSheet(ss, email) {
  const name = userProgressSheetName(email);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(USER_PROGRESS_HEADERS);
  }
  return sheet;
}

function ensureSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
}

function doGet(e) {
  return handle(e.parameter);
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse(400, { error: "invalid JSON body" });
  }
  return handle(body);
}

function handle(params) {
  const expectedToken = PropertiesService.getScriptProperties().getProperty("API_TOKEN");
  if (!expectedToken || params.token !== expectedToken) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  if (params.action === "get") return actionGet(params);
  if (params.action === "upsert") return actionUpsert(params);
  if (params.action === "get_topics") return actionGetTopics(params);
  if (params.action === "remap_word_ids") return actionRemapWordIds(params);
  if (params.action === "v2_get_progress") return actionV2GetProgress(params);
  if (params.action === "v2_upsert_progress") return actionV2UpsertProgress(params);
  if (params.action === "v2_get_topics") return actionV2GetTopics(params);
  if (params.action === "v2_migrate") return actionV2Migrate(params);
  return jsonResponse(400, { error: "unknown action: " + params.action });
}

function actionGet(params) {
  const email = params.email;
  const lang = params.lang;
  if (!email || !lang) return jsonResponse(400, { error: "missing email or lang" });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const rows = getSheet(PROGRESS_SHEET_NAME).getDataRange().getValues();
    const words = {};
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[0] === email && row[1] === lang) {
        words[row[2]] = {
          confident: !!row[3],
          shown_count: Number(row[4]) || 0,
          show: !!row[5],
        };
      }
    }
    return jsonResponse(200, { words: words });
  } finally {
    lock.releaseLock();
  }
}

function actionUpsert(params) {
  const email = params.email;
  const lang = params.lang;
  const wordId = params.word_id;
  if (!email || !lang || !wordId) {
    return jsonResponse(400, { error: "missing email, lang or word_id" });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet(PROGRESS_SHEET_NAME);
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[0] === email && row[1] === lang && row[2] === wordId) {
        sheet.getRange(i + 1, 4, 1, 3).setValues([[
          !!params.confident,
          Number(params.shown_count) || 0,
          !!params.show,
        ]]);
        return jsonResponse(200, { ok: true });
      }
    }
    return jsonResponse(404, { error: "word not assigned to user: " + wordId });
  } finally {
    lock.releaseLock();
  }
}

function actionGetTopics(params) {
  const email = params.email;
  const lang = params.lang;
  if (!email || !lang) return jsonResponse(400, { error: "missing email or lang" });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const rows = getSheet(TOPICS_SHEET_NAME).getDataRange().getValues();
    const topicIds = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[0] === email && row[1] === lang) {
        topicIds.push(row[2]);
      }
    }
    return jsonResponse(200, { topic_ids: topicIds });
  } finally {
    lock.releaseLock();
  }
}

// One-off maintenance action: catalog.json word_ids sometimes get renumbered
// (e.g. re-ordering the word list). This rewrites the word_id column in the
// "progress" sheet in place, for every user, so existing rows keep tracking
// the same word under its new id instead of silently pointing at whatever
// word now holds the old id. `mapping` is {old_word_id: new_word_id}.
function actionRemapWordIds(params) {
  const lang = params.lang;
  const mapping = params.mapping;
  if (!lang || !mapping || typeof mapping !== "object") {
    return jsonResponse(400, { error: "missing lang or mapping" });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet(PROGRESS_SHEET_NAME);
    const rows = sheet.getDataRange().getValues();
    let updated = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[1] === lang && Object.prototype.hasOwnProperty.call(mapping, row[2])) {
        sheet.getRange(i + 1, 3).setValue(mapping[row[2]]);
        updated++;
      }
    }
    return jsonResponse(200, { updated: updated });
  } finally {
    lock.releaseLock();
  }
}

// --- New per-user-tab actions (RESTRUCTURE_REQUIREMENTS.md §6). These are
// additive: the actions above are untouched, so existing callers keep
// working exactly as before while these roll out. ---

function actionV2GetProgress(params) {
  const email = params.email;
  const lang = params.lang;
  if (!email || !lang) return jsonResponse(400, { error: "missing email or lang" });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getUserProgressSheetIfExists(ss, email);
    const words = {};
    if (sheet) {
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row[0] === lang) {
          words[row[1]] = {
            confident: !!row[2],
            shown_count: Number(row[3]) || 0,
            show: !!row[4],
          };
        }
      }
    }
    return jsonResponse(200, { words: words });
  } finally {
    lock.releaseLock();
  }
}

function actionV2UpsertProgress(params) {
  const email = params.email;
  const lang = params.lang;
  const wordId = params.word_id;
  if (!email || !lang || !wordId) {
    return jsonResponse(400, { error: "missing email, lang or word_id" });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateUserProgressSheet(ss, email);
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[0] === lang && row[1] === wordId) {
        sheet.getRange(i + 1, 3, 1, 3).setValues([[
          !!params.confident,
          Number(params.shown_count) || 0,
          !!params.show,
        ]]);
        return jsonResponse(200, { ok: true });
      }
    }
    return jsonResponse(404, { error: "word not assigned to user: " + wordId });
  } finally {
    lock.releaseLock();
  }
}

function actionV2GetTopics(params) {
  const email = params.email;
  const lang = params.lang;
  if (!email || !lang) return jsonResponse(400, { error: "missing email or lang" });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const rows = getSheet(USERS_SHEET_NAME).getDataRange().getValues();
    const emailLower = email.toLowerCase();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[0] === emailLower && row[1] === lang) {
        const topicIds = String(row[2] || "")
          .split(",")
          .map(function (s) { return s.trim(); })
          .filter(function (s) { return s.length > 0; });
        return jsonResponse(200, { topic_ids: topicIds });
      }
    }
    return jsonResponse(200, { topic_ids: [] });
  } finally {
    lock.releaseLock();
  }
}

// One-off migration (RESTRUCTURE_PLAN.md Step 4.3): copies the existing
// shared progress/topics tabs into the new per-user-tab / users-tab schema.
// Purely additive — never reads back into or modifies the old tabs — and
// idempotent (skips rows already present in the destination), so it's safe
// to call more than once. Removed again once Step 4.4 cuts the backend over
// and drops the old schema.
function actionV2Migrate(params) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const unknownLangRows = [];
    const emailsSeen = {};

    // --- progress -> per-user progress tabs (1:1 row copy) ---
    const progressRows = getSheet(PROGRESS_SHEET_NAME).getDataRange().getValues();
    let progressRead = 0;
    let progressMigrated = 0;
    let progressSkippedExisting = 0;
    const userProgressSheets = {};
    const userProgressExisting = {};

    for (let i = 1; i < progressRows.length; i++) {
      const row = progressRows[i];
      const email = String(row[0] || "");
      const lang = row[1];
      const wordId = row[2];
      if (!email || !lang || !wordId) continue;
      progressRead++;

      const pair = LEGACY_LANG_TO_PAIR[lang];
      if (!pair) {
        unknownLangRows.push({ sheet: "progress", email: email, lang: lang });
        continue;
      }

      const emailLower = email.toLowerCase();
      emailsSeen[emailLower] = true;
      if (!userProgressSheets[emailLower]) {
        const sheet = getOrCreateUserProgressSheet(ss, emailLower);
        userProgressSheets[emailLower] = sheet;
        const existingRows = sheet.getDataRange().getValues();
        const existingKeys = {};
        for (let j = 1; j < existingRows.length; j++) {
          existingKeys[existingRows[j][0] + "|" + existingRows[j][1]] = true;
        }
        userProgressExisting[emailLower] = existingKeys;
      }

      const key = pair + "|" + wordId;
      if (userProgressExisting[emailLower][key]) {
        progressSkippedExisting++;
        continue;
      }
      userProgressSheets[emailLower].appendRow([pair, wordId, !!row[3], Number(row[4]) || 0, !!row[5]]);
      userProgressExisting[emailLower][key] = true;
      progressMigrated++;
    }

    // --- topics -> users tab (grouped, topic_ids joined) ---
    const topicsRows = getSheet(TOPICS_SHEET_NAME).getDataRange().getValues();
    let topicsRead = 0;
    const groups = {};

    for (let i = 1; i < topicsRows.length; i++) {
      const row = topicsRows[i];
      const email = String(row[0] || "");
      const lang = row[1];
      const topicId = row[2];
      if (!email || !lang || !topicId) continue;
      topicsRead++;

      const pair = LEGACY_LANG_TO_PAIR[lang];
      if (!pair) {
        unknownLangRows.push({ sheet: "topics", email: email, lang: lang });
        continue;
      }

      const emailLower = email.toLowerCase();
      emailsSeen[emailLower] = true;
      const key = emailLower + "|" + pair;
      if (!groups[key]) {
        groups[key] = { email: emailLower, pair: pair, topicIds: [] };
      }
      groups[key].topicIds.push(topicId);
    }

    const usersSheet = getSheet(USERS_SHEET_NAME);
    const usersRows = usersSheet.getDataRange().getValues();
    const existingUserPairs = {};
    for (let i = 1; i < usersRows.length; i++) {
      existingUserPairs[usersRows[i][0] + "|" + usersRows[i][1]] = true;
    }

    let usersMigrated = 0;
    let usersSkippedExisting = 0;
    const groupKeys = Object.keys(groups);
    for (let i = 0; i < groupKeys.length; i++) {
      const group = groups[groupKeys[i]];
      const key = group.email + "|" + group.pair;
      if (existingUserPairs[key]) {
        usersSkippedExisting++;
        continue;
      }
      usersSheet.appendRow([group.email, group.pair, group.topicIds.join(", ")]);
      existingUserPairs[key] = true;
      usersMigrated++;
    }

    return jsonResponse(200, {
      progress_rows_read: progressRead,
      progress_rows_migrated: progressMigrated,
      progress_rows_skipped_existing: progressSkippedExisting,
      topics_rows_read: topicsRead,
      users_rows_migrated: usersMigrated,
      users_rows_skipped_existing: usersSkippedExisting,
      emails_seen: Object.keys(emailsSeen).sort(),
      unknown_lang_rows: unknownLangRows,
    });
  } finally {
    lock.releaseLock();
  }
}

function getSheet(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error("Sheet '" + name + "' not found — run setup() first");
  return sheet;
}

function jsonResponse(status, obj) {
  const payload = Object.assign({ status: status }, obj);
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
