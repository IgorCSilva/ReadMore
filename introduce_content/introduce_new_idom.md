# Introduce new idiom

1. In frontend/src/shared/languages.ts

- Add data in LANGUAGE_NAMES variable;
- Add data in SPEECH_LOCALES variable;


2. In frontend/src/shared/languagePreference.ts

- Add condition in applyAccent function.


3. In frontend/src/pages/LibraryPage.vue

- Add condition in setDataLang function.


4. In frontend/src/App.vue

- Add dedicated colors in :root style;
- Add dedicated colors in @media (prefers-color-scheme: light) style;
- Add dedicated variables in :root[data-lang="<target>"] style;


5. In backend/app/infrastructure/repositories/gemini_chat_client.py

- Add data in _LANGUAGE_NAMES variable;


6. In backend/app/infrastructure/repositories/edge_tts_client.py

- Add data in _VOICES variable;


7. In frontend/src/shared/flags.ts

- Add a FLAGS entry (code, flag image file name, native country name);
- Drop the matching image file into frontend/public/images/flags/ — flagUrl() silently
  renders a broken image if the file referenced by the new entry doesn't actually exist.


8. Only if the target language breaks the Latin-script/space-delimited assumption (no
   spaces between words at all, e.g. Chinese/Japanese; or particles/endings glued onto
   the previous word with no space, e.g. Korean):

- backend/scripts/check_sentence_markers.py — add the target to both _NO_SPACE_LANGUAGES
  and _RELIABLE_LANGUAGES (skip _RELIABLE_LANGUAGES only if its script can coincide with
  the native language's own prose, e.g. a Latin-script target — see the file's own
  docstring for why that case is excluded).
- backend/app/domain/text_boundaries.py — add a target_lang entry to _STRATEGIES, but only
  if correction-matching's word-boundary logic genuinely needs to differ from the plain
  \b/\b default (it currently does for Korean/French; it's a left-anchor-only match for a
  no-space script, mirroring _korean_boundary). Skip this file if the language is
  space-delimited and \b already works correctly.