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