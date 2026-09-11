// Google Apps Script "Web App" that lets server.py read/write per-user word
// progress in this spreadsheet instead of a local file, so progress survives
// on hosts with an ephemeral filesystem.
//
// One-time setup:
//   1. Create a Google Sheet, then Extensions > Apps Script, and replace the
//      default Code.gs contents with this file.
//   2. Run the `setup` function once (Run menu > select "setup") to create
//      the "progress" sheet tab with its header row. Approve the permission
//      prompt when asked.
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

const SHEET_NAME = "progress";
const HEADERS = ["email", "lang", "word_id", "confident", "shown_count", "show"];

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
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
  return jsonResponse(400, { error: "unknown action: " + params.action });
}

function actionGet(params) {
  const email = params.email;
  const lang = params.lang;
  if (!email || !lang) return jsonResponse(400, { error: "missing email or lang" });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const rows = getSheet().getDataRange().getValues();
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
    const sheet = getSheet();
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

function getSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Sheet '" + SHEET_NAME + "' not found — run setup() first");
  return sheet;
}

function jsonResponse(status, obj) {
  const payload = Object.assign({ status: status }, obj);
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
