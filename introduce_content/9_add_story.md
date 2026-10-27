## Add story

native: pt
target: es

Adapt the text below to have a identical structure to backend/content/pt-es/stories/b1/muddy_feet/text.json. You need to define the level from A1 to C2 and a folder name.
If there are some emojis like 😊 you can remove them.

=============
== Initial ==
=============

Pelusa, la gatita astronauta

Una historia tierna sobre la amistad y la valentía, perfecta para leer antes de dormir. Acompaña a la pequeña Pelusa en su viaje a las estrellas, donde descubrirá que se pueden hacer nuevos amigos hasta en los lugares más lejanos.
-----------------------------------

Pelusa era una gatita astronauta 🐱🚀
Llevaba un casco redondo y brillante,
y era toda una aventurera.


Su nave estaba hecha con su cajita transportadora
y tenía todo lo necesario para cruzar el espacio.


Un día, decidió viajar hasta Marte.
La nave voló entre las estrellas y aterrizó muy despacito,
con un sonido suave:

—pusssssshhhhhh—


justo sobre el planeta rojo.

Cuando Pelusa salió a explorar,
vio algo moverse a lo lejos.


¡Era un marciano! 👽

El marciano se asustó muchísimo.
Pelusa también se llevó un tremendo susto.


Pelusa corrió y se metió rápido en su nave.
El marciano corrió y se escondió detrás de una roca grande.


Durante un rato,
nadie se movió.


Poco a poco, el marciano se asomó.
Caminó despacio y se acercó con un regalo entre las manos.


Era una roca de Marte,
roja y brillante 🪨

Entonces, Pelusa salió de su cajita.
Buscó en su arenero espacial
y le regaló una piedrita muy bonita.

Se miraron con curiosidad
y el miedo desapareció.

Pelusa subió a su nave y regresó feliz a la Tierra 🌍
con su roca de Marte,
un recuerdo especial de su nuevo amigo del espacio ✨

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