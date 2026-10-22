## Add story

native: pt
target: es

Adapt the text below to have a identical structure to backend/content/pt-es/stories/b1/muddy_feet/text.json. You need to define the level from A1 to C2 and a folder name.
If there are some emojis like 😊 you can remove them.

=============
== Initial ==
=============

La estrella brillante de Rubén

Una historia tierna para ayudar a los pequeños a dormir tranquilos. Descubre cómo una estrellita mágica hace que Rubén se sienta seguro y acompañado toda la noche, transformando su miedo en dulces sueños.

---------------------------------------

Había una vez un niño pequeño llamado Rubén que vivía en una casita junto a un campo muy lindo. A Rubén le encantaba jugar todo el día bajo el sol, pero cuando llegaba la noche y se apagaban las luces, le daba un poquito de miedo. 🌙

Una noche, mientras se acomodaba en su camita, su mamá se sentó a la orilla y le enseñó algo que tenía en las manos:

—Rubén, ¿ves esta estrellita brillante? ✨

—Sí, mami. ¿Es una estrella de verdad? —preguntó Rubén con los ojos muy abiertos de la emoción. 😮

—Es una estrellita especial que brilla en la oscuridad. Ella te va a cuidar para que nunca te sientas solito cuando apaguemos la luz.

La mamá de Rubén pegó la pequeña estrella luminosa en el techo del cuarto.

—Esta estrellita te va a acompañar todas las noches —dijo con una sonrisa llena de cariño. 😊

Esa noche, Rubén miró hacia el techo y vio cómo la estrella brillaba suavemente. Sintió que el cuarto ya no estaba tan oscuro y que su nueva amiga lo cuidaba desde arriba. 🌟

—Buenas noches, estrellita —susurró Rubén antes de cerrar los ojos. 😴

Desde ese día, cada vez que le daba un poquito de temor, miraba su estrella brillante y recordaba que no estaba solo. La oscuridad dejó de asustarlo y se volvió un lugar mágico para soñar. ✨

Fin

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