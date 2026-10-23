## Add story

native: pt
target: es

Adapt the text below to have a identical structure to backend/content/pt-es/stories/b1/muddy_feet/text.json. You need to define the level from A1 to C2 and a folder name.
If there are some emojis like 😊 you can remove them.

=============
== Initial ==
=============

Huellas de luna


Un cuento relajante y sensorial que invita a los pequeños a seguir un rastro mágico de luz y calma antes de dormir, perfecto para desconectar y soñar bonito.
----------------------------

Cuando el cielo se pinta de azul oscuro y las primeras estrellas empiezan a brillar, allá arriba, muy alto, la luna despierta.

Es redonda y brillante, con esa luz fresca y blanquita que baña todo lo que la rodea. Esta noche, como cada noche mágica, decide bajar al bosque.

Baja muy despacito, flotando entre las ramas, sin hacer ruido.

Sus pies, si es que los tiene, no pisan fuerte, solo dejan un rastro de luz, unas huellas plateadas que se posan sobre el pasto, sobre las piedras, sobre los troncos dormidos.

Nadie la ve. Nadie la oye. Ella camina tranquila, dejando su rastro de calma y de magia.

Un poco más allá, en una madriguera redondita, un conejo blanco llamado Luno duerme acurrucado, con las orejas dobladas y los ojitos cerrados.

Pero algo, una luz muy suave, le roza la nariz.

Luno se estira con un suspiro, abre un ojito y ve un destello. Allí, en el claro, justo frente a su casita, hay una huella brillante en el pasto.

Se despereza como solo los conejitos saben hacerlo y se acerca con curiosidad. Toca la huella con su patita. Está fresca, como el rocío de la mañana, y huele a jazmín recién abierto.

—¿Quién ha caminado por aquí? —susurra Luno, sin esperar respuesta.

La luna ya se ha ido, pero sus huellas siguen ahí. Así que Luno, despacito, comienza a seguirlas. Una, dos, tres huellas más adelante y el conejito atraviesa un helecho alto que le acaricia las orejas como si le hiciera cariñitos.

Después salta sobre una piedra lisa, que suena apenas bajo sus patitas suaves. Y sigue adelante revisando todas las huellas una por una.

El sendero lo lleva por un camino entre los árboles. Las ramas crujen muy suavecito al moverse con el viento. Un grillo canta, pero su canción no despierta, sino que arrulla.

Y cada huella le regala a Luno una sensación distinta. Una huele a lavanda y le recuerda a su mamá cuando lo abraza. Otra huele a hojas mojadas, y Luno imagina el sonido de la lluvia a lo lejos. Otra le hace cosquillas en los bigotes, como si alguien invisible le hiciera reír muy bajito.

El camino no tiene prisa. Y Luno tampoco. Da saltitos cortos, se detiene, respira los aromas, observa los brillos plateados y se deja llevar.

Al final del sendero, cuando el bosque se abre en un claro secreto, Luno se detiene.

Allí está, la luna, brillando justo encima de un charquito redondo. Reflejada en el agua, como si tuviera una hermana que vive debajo, jugando con el resplandor de su luz sobre la superficie.

Luno se sienta a mirar y sonríe.

—Gracias por las huellas —susurra—. Me han traído hasta ti.

La luna no le contesta, pero una brisa suave le pasa por la cara, como una caricia que no se ve.

El conejito bosteza. Un bostezo largo, de esos que hacen ruido. Se acurruca en el pasto blandito del claro, pone una oreja sobre sus patas, y la otra le cae con suavidad sobre su carita.

Y justo antes de quedarse dormido, nota algo en la barriguita: una huella plateada, dibujada con luz.

La luna lo arropa desde el cielo. Y Luno sueña con huellas brillantes que lo acompañan flotando entre estrellas, llevándolo siempre a lugares tranquilos.

Y tú, si cierras los ojitos muy despacio quizá también veas una huella de luna. Quizá la sigas. Quizá te lleve a un lugar donde todo es suave y relajante.

Buenas noches, amor mío.
Buenas noches, luna.

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