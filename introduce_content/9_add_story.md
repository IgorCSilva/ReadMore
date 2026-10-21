## Add story

native: pt
target: es

Adapt the text below to have a identical structure to backend/content/pt-es/stories/b1/muddy_feet/text.json. You need to define the level from A1 to C2 and a folder name.
If there are some emojis like 😊 you can remove them.

=============
== Initial ==
=============


Garbancito


Garbancito es un niño muy pequeñito pero lleno de valentía. Un día vive una gran aventura cuando un buey se lo traga por accidente. ¡Descubre cómo su ingenio lo ayuda a volver a casa!
--------------------------

Había una vez un niño tan, pero tan pequeño, que todos lo llamaban Garbancito, porque era tan chiquitito como un garbanzo. Aunque su tamaño era diminuto, Garbancito era muy valiente y le fascinaba salir a pasear.


Un día, su mamá le dijo:
—Garbancito, ten mucho cuidado y no te vayas muy lejos.

Pero Garbancito era curioso y, cantando fuerte para que nadie lo pisara, caminaba por el campo diciendo:
—“¡Pachín, pachán, pachón! Mucho cuidado con lo que hacen, pachín, pachán, pachón, a Garbancito no pisen” 🎶.

De repente, empezó a llover 🌧️. Para no mojarse, Garbancito se escondió debajo de un repollo gigante 🥬. Pero justo en ese momento, un buey hambriento que pasaba por allí se comió el repollo entero de un bocado, sin darse cuenta de que Garbancito estaba adentro. ¡Oh, no! 😱

Desde el interior de la panza del buey, Garbancito, sin perder el ánimo, empezó a gritar con todas sus fuerzas para que lo encontraran:
—“¡Mamá, mamá! ¡Estoy en la panza del buey, donde ni llueve ni nieva!” 🌦️.

Sus papás, muy preocupados, salieron a buscarlo, llamándolo:
—¡Garbancito! ¿Dónde estás?

Y Garbancito contestaba desde adentro del animal:
—¡En la panza del buey, donde ni llueve ni nieva! 🌧️❄️

Entonces, al papá de Garbancito se le ocurrió una idea brillante 💡. Se acercó despacito y le hizo cosquillas al buey 🐂 en la nariz. El animal no pudo evitar un gran estornudo y... ¡achís! 🤧 Garbancito salió volando por el aire y cayó sano y salvo en los brazos de sus papás, que le dieron un abrazo enorme 🤗.

Y colorín colorado, este cuento se ha acabado 🎉.

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