## Add story

native: pt
target: es

Adapt the text below to have a identical structure to backend/content/pt-es/stories/b1/muddy_feet/text.json. You need to define the level from A1 to C2 and a folder name.
If there are some emojis like 😊 you can remove them.

=============
== Initial ==
=============


Bambú y el pañal viajero

Bambú descubre que su pañal tiene un sueño secreto: ¡conocer el mundo! Una historia tierna y respetuosa para acompañar a los niños en el paso de dejar el pañal, sin presiones y a su propio ritmo.
----------------------------------------

Bambú era un osito panda pequeño, redondito y muy abrazable.

Dentro de poco iba a empezar el jardín, y eso le hacía sentir cosquillas en la panza.

Pero había un pequeño problema…

Bambú todavía usaba pañal.

Una mañana, mientras se lo estaba poniendo, el pañal suspiró y dijo:

—Bambú, yo quiero viajar por el mundo.

—¿Cómo que viajar? —dijo Bambú, agarrándolo fuerte—. ¡Tú eres mío!

—He soñado con ver el mar, las montañas y hasta el desierto —dijo el pañal—. Ya he hecho mi trabajo contigo.

—¡No, no y no! —exclamó Bambú, y empezó un pequeño jaloneo con el pañal.
El pañal tiraba para un lado, Bambú para el otro… ¡Plaf! Los dos acabaron sentados en el suelo.

—Mira —dijo el pañal, un poco despeinado—, podrías probar a usar la bacinica, como los pandas grandes.

—Pero… ¿y si te necesito? —preguntó Bambú.

—No pasa nada —sonrió el pañal—. Me quedaré contigo un tiempo más. Poco a poco. Y cuando tú te sientas listo… me iré de viaje.

Bambú lo pensó. Eso sí le gustaba.

Así que empezó a usar la bacinica. A veces sí, a veces no. Y el pañal seguía ahí, ayudándolo.

Hasta que un día, Bambú dijo muy serio:

—Pañal… ya estoy listo.

El pañal se quedó mirándolo con orgullo, sonrió y sacó una maletita pequeñita.

—Entonces ha llegado mi momento.

Se despidieron con un abrazo enorme.

—¡Buen viaje! —dijo Bambú.

Y desde ese día, Bambú fue al jardín sin pañal…
un poco más ligero,
y muy, muy orgulloso 🐼✨

=========
== End ==
=========

### Add glossary data

Same glossary step as "Create theme content" above, run against this story's own
`sentences` instead of a learning topic's: build missing entries in
backend/content/<native>-<target>/glossary/glossary.json for every new normalized token
(word or multi-word phrase) in the new backend/content/<target>/stories/<level>/<folder>/
text.json, following the exact entry schema and merge/sort discipline described there —
meaning in <native> with a grammatical note for conjugated forms, two examples (one from
the story's own text, one freshly written), target-language synonyms/antonyms where
natural, additive merge only, re-sorted keys. Exclude bare numerals, same as above.

### Affected files:

- backend/content/<native>-<target>/glossary/glossary.json

### Verify

Confirm every token in the new story's `sentences` (excluding bare numerals) now resolves
in backend/content/<native>-<target>/glossary/glossary.json, and that loading the story
through JsonStoriesRepository.get_story() for a pair using this target actually returns
those new words in Story.glossary — not just that the raw JSON file contains them.