// Google Apps Script "Web App" that lets the backend read/write per-user word
// progress and topic visibility in this spreadsheet instead of a local file,
// so this data survives on hosts with an ephemeral filesystem.
//
// One-time setup:
//   1. Create a Google Sheet, then Extensions > Apps Script, and replace the
//      default Code.gs contents with this file.
//   2. Run the `setup` function once (Run menu > select "setup") to create
//      the "users" sheet tab with its header row. Approve the permission
//      prompt when asked.
//   3. Project Settings (gear icon) > Script Properties > add API_TOKEN with
//      a long random secret value. This is the shared secret the backend
//      must send with every request.
//   4. Deploy > New deployment > type "Web app". Execute as "Me", access
//      "Anyone" (this is what lets the backend call it without a Google
//      login — API_TOKEN is what keeps it private). Copy the resulting
//      /exec URL.
//   5. Set SHEETS_WEBAPP_URL to that URL and SHEETS_API_TOKEN to the same
//      secret from step 3 as environment variables for the backend.
//
// Schema (RESTRUCTURE_REQUIREMENTS.md §6):
//
// A "users" sheet: one row per (email, language_pair), listing which topics
// are enabled for that pair:
//   email | language_pair | topic_ids
// e.g.  patricia.ramos@gmail.com | pt-en | top-01, top-02
// A pair with no matching row is simply not active for that user; an empty
// topic_ids cell means the pair is active but no topic is enabled yet.
// Reached via the get_topics action.
//
// One progress sheet per user, named "<email>-progress" (email lowercased),
// auto-created on that user's first upsert_progress call:
//   language_pair | word_id | confident | shown_count | show
// Reached via the get_progress / upsert_progress actions. A word is enabled
// for a user purely by being in a topic enabled for them (the "users" sheet
// above) — there's no separate per-word assignment step. upsert_progress
// adds a new row the first time a given (language_pair, word_id) is
// interacted with, and updates it on every call after that.

const USERS_SHEET_NAME = "users";
const USERS_HEADERS = ["email", "language_pair", "topic_ids"];

const USER_PROGRESS_HEADERS = ["language_pair", "word_id", "confident", "shown_count", "show"];

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

  if (params.action === "get_progress") return actionGetProgress(params);
  if (params.action === "upsert_progress") return actionUpsertProgress(params);
  if (params.action === "get_topics") return actionGetTopics(params);
  if (params.action === "remap_word_ids") return actionRemapWordIds(params);
  return jsonResponse(400, { error: "unknown action: " + params.action });
}

function actionGetProgress(params) {
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

function actionUpsertProgress(params) {
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
    // First interaction with this word for this user+lang: add the row now
    // rather than requiring it to be pre-seeded (word enablement lives at
    // the topic level, in the "users" sheet, not per progress row).
    sheet.appendRow([
      lang,
      wordId,
      !!params.confident,
      Number(params.shown_count) || 0,
      !!params.show,
    ]);
    return jsonResponse(200, { ok: true });
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

// One-off maintenance action: catalog.json word_ids sometimes get renumbered
// (e.g. re-ordering the word list). This rewrites the word_id column in
// every user's progress sheet in place, so existing rows keep tracking the
// same word under its new id instead of silently pointing at whatever word
// now holds the old id. `mapping` is {old_word_id: new_word_id}.
function actionRemapWordIds(params) {
  const lang = params.lang;
  const mapping = params.mapping;
  if (!lang || !mapping || typeof mapping !== "object") {
    return jsonResponse(400, { error: "missing lang or mapping" });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    let updated = 0;
    for (let s = 0; s < sheets.length; s++) {
      const sheet = sheets[s];
      if (!sheet.getName().endsWith("-progress")) continue;
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row[0] === lang && Object.prototype.hasOwnProperty.call(mapping, row[1])) {
          sheet.getRange(i + 1, 2).setValue(mapping[row[1]]);
          updated++;
        }
      }
    }
    return jsonResponse(200, { updated: updated });
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
