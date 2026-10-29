## Add story

native: es
target: fr

Adapt the text below to have a identical structure to backend/content/pt-es/stories/b1/muddy_feet/text.json. You need to define the level from A1 to C2 and a folder name.
If there are some emojis like 😊 you can remove them.

=============
== Initial ==
=============


Le Doux Voyage de Petit Nuage

Une invitation à la rêverie pour les tout-petits. Suivez un nuage tout doux dans sa promenade apaisante au-dessus de paysages familiers, entre champs de lavande et lacs miroitants. Une histoire tendre, idéale pour apaiser les enfants avant le dodo.
--------------------------------

Il était une fois Petit Nuage, qui flottait doucement dans le ciel bleu. Il était fait de coton blanc, si tendre et si doux qu'on aurait dit un oreiller tout moelleux. ☁️

Un jour, Petit Nuage décida de partir faire une grande promenade. Il glissa son corps vaporeux entre les montagnes et descendit vers un joli champ de fleurs. Là-bas, les papillons volaient au ralenti et les abeilles bourdonnaient doucement : Bzzzz, bzzzz. L'air sentait bon la lavande et le miel. Tout était si calme ! Petit Nuage se sentait heureux et léger. 🌸🐝

Il continua de flotter jusqu'à un immense lac. L'eau était si claire qu'on y voyait le soleil se refléter comme dans un miroir magique. Petit Nuage descendit encore un peu, jusqu'à effleurer l'eau avec son petit bidou. L'eau était bien fraîche et cela lui fit des chatouillis agréables, tout en le chargeant de gouttelettes brillantes. 💧

Il s'amusa un moment, puis quelque chose attira son attention : des canetons nageaient et clapotaient derrière leur maman canne, qui leur montrait comment trouver à manger. « Quelle paix ! » pensa Petit Nuage. Il resta là à les regarder se laisser bercer par l'eau, tout comme lui se laissait bercer par le ciel. 🦆

Un peu plus tard, il arriva au-dessus d'une forêt aux arbres immenses. Les arbres chuchotaient dans la brise légère et les oiseaux chantonnaient des mélodies apaisantes. Il décida de se reposer là un instant, accroché aux branches, profitant du vent et du chant des oiseaux. Il laissa les feuilles caresser son corps tout doux, les arrosant au passage des petites gouttes fraîches qu'il avait rapportées du lac. 🌳🐦

Quand le soleil commença à se cacher derrière les montagnes, Petit Nuage sut qu'il était l'heure de rentrer à la maison. Il remonta doucement dans le ciel, admirant le jour qui disait au revoir avec des couleurs rose, orange et violette à l'horizon. Tout devenait silencieux. 🌅

Heureux et détendu, Petit Nuage alla se blottir au milieu des étoiles et ferma les yeux. « C'était une journée merveilleuse », pensa-t-il, en se laissant porter par le doux bercement de la nuit. ⭐️🌙

Et c'est ainsi que le nuage de coton s'endormit, flottant paisiblement, alors que le monde entier reposait en paix. 😴

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