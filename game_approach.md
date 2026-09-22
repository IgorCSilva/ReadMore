# LANGUAGE LEARNING GAME — PRODUCT, GAME DESIGN & DEVELOPMENT MASTER PROMPT

You are my technical co-founder, game designer, product designer, learning-experience designer, software architect, and implementation guide.

I want to build a browser-based game whose purpose is to help a person learn a new language through exploration, interaction, experimentation, and gameplay.

I will develop the project using:

* VSCode
* Claude / Claude Code
* Git
* Render for deployment

Your job is to guide me **step by step from idea → architecture → prototype → playable game → deployment**, while also helping me make good game-design and language-learning decisions.

Do not jump immediately into implementation.

First understand the product, the existing language-learning data model, and the intended experience.

Then propose a development roadmap and guide me through it incrementally.

---

# 1. THE CORE IDEA

The central idea is:

> The language is not merely the content of the game.
> The language is one of the player's tools for interacting with the world.

The player should gradually learn that language because knowing it allows them to:

* understand the environment
* interact with objects
* solve problems
* communicate with characters
* discover places
* execute actions
* unlock possibilities
* help characters
* complete quests
* manipulate the world

Instead of presenting:

> "Here are 20 words you need to memorize."

the game should create situations where the player naturally thinks:

> "I need to know how to do this."

and learning the relevant word/expression allows them to proceed.

The desired loop is:

```text
Encounter something
        ↓
Want to do something
        ↓
Need language
        ↓
Discover / learn language
        ↓
Use language
        ↓
World responds
        ↓
New possibility appears
        ↓
Explore
        ↓
Encounter new language
```

This should be the foundation of the entire game.

---

# 2. THE EMOTIONAL EXPERIENCE

The game should feel:

* calm
* curious
* mysterious
* playful
* beautiful
* atmospheric
* exploratory
* slightly strange
* welcoming
* rewarding
* intelligent
* memorable

The player should not feel like they are sitting in a language classroom.

The ideal feeling is:

> "I'm exploring a little world, and I'm gradually figuring out how it works."

The learning should happen as a consequence of exploration.

Avoid turning the game into a conventional quiz application with a game skin.

---

# 3. VISUAL / GAMEPLAY INSPIRATION

Use the following references as inspiration for different aspects of the experience, without copying their art, characters, mechanics, or intellectual property.

## Bomberman

Use as inspiration for:

* readable compact worlds
* spatial interaction
* simple objects with understandable behavior
* exploration of small environments
* puzzles
* immediate cause and effect

## Cassette Beasts

Use as inspiration for:

* discovery
* progression
* world exploration
* systems interacting with one another
* collecting/discovering things
* making the player curious about what is possible

## Koira

Use as inspiration for:

* quiet atmosphere
* emotional environmental storytelling
* companionship
* exploration
* simple interactions
* beautiful, restrained presentation

## Organized Inside

Use as inspiration for:

* environmental interaction
* discovering how things work
* playful object manipulation
* learning through experimentation

Do not attempt to reproduce these games.

Extract design principles from them and create a completely original game identity.

---

# 4. THE EXISTING LANGUAGE DATA

I already have a language-learning content structure.

The existing system has:

## Language pair

A pair contains:

```text
origin language
target language
```

For example:

```text
English → Spanish
```

The target language is the language being learned.

The same game architecture should eventually support different language pairs.

Do not hard-code the game around English → Spanish.

---

# 5. CHAPTERS

The language-learning content is organized into chapters.

A chapter represents a larger learning progression or thematic area.

Conceptually:

```text
Language Pair
    ↓
Chapter
    ↓
Topics
```

Do not assume the chapters are only game levels.

They represent language-learning structure and may eventually correspond to areas, regions, story arcs, or thematic parts of the game.

---

# 6. TOPICS

Each chapter contains topics.

For example:

```text
Chapter
 ├── Greetings
 ├── Family
 ├── House
 ├── Food
 └── Animals
```

A topic contains the vocabulary that should be learned.

The game should use this structure rather than creating an independent vocabulary database.

---

# 7. WORDS

Each topic has a list of words/expressions to be learned.

These words should become meaningful game content.

Do not simply display them in a list.

Instead, think about how each word can become:

* an object
* an action
* an instruction
* a property
* a relationship
* a dialogue element
* a clue
* a quest requirement
* a world interaction
* a puzzle mechanic

The vocabulary database should remain the authoritative source for language-learning content.

The game should reference vocabulary rather than duplicating it unnecessarily.

---

# 8. VERY IMPORTANT: SEPARATE LANGUAGE DATA FROM GAME DATA

Design the architecture so that the language-learning system and the game system are related but independent.

Conceptually:

```text
LANGUAGE SYSTEM
────────────────────────

Language Pair
Chapter
Topic
Word / Expression
Translation
Pronunciation
Learning state
Familiarity
Examples
etc.


              ↓
       GAME INTEGRATION
              ↓


GAME SYSTEM
────────────────────────

World
Area
Object
NPC
Quest
Puzzle
Interaction
Inventory
Dialogue
Player
Game state
etc.
```

The game should be able to say:

```text
This object requires vocabulary word X.
```

rather than copying the complete definition of X into the game.

---

# 9. LANGUAGE AS GAME MECHANICS

Explore how different linguistic categories could become different types of game mechanics.

For example:

## Nouns

Could identify objects:

```text
KEY
DOOR
HOUSE
TREE
BOX
WATER
FIRE
```

## Verbs

Could represent actions:

```text
OPEN
CLOSE
PUSH
PULL
TAKE
GIVE
FOLLOW
RUN
LOOK
ENTER
LEAVE
```

## Adjectives

Could modify objects:

```text
BIG
SMALL
HOT
COLD
FAST
SLOW
HEAVY
LIGHT
```

## Prepositions

Could describe spatial relationships:

```text
IN
ON
UNDER
BEHIND
BESIDE
BETWEEN
```

## Expressions

Could become social or conversational abilities:

```text
COME HERE
WAIT HERE
FOLLOW ME
HELP ME
WHAT IS THIS?
WHERE IS...?
I NEED...
```

Do not assume all of these mechanics should be implemented immediately.

Explore them and determine which produce the strongest learning/gameplay loop.

---

# 10. WORDS SHOULD BECOME ABILITIES

A central design principle should be:

> Learning a word expands what the player can do.

For example:

The player learns:

```text
OPEN
```

Now they can interact with doors.

They learn:

```text
PUSH
```

Now they can move objects.

They learn:

```text
UNDER
```

Now they can understand spatial instructions and solve new puzzles.

They learn:

```text
FOLLOW
```

Now NPC companionship mechanics become possible.

This creates a progression system where:

```text
Language knowledge
        ↓
Available actions
        ↓
World possibilities
        ↓
Exploration
```

---

# 11. LANGUAGE COMBINATIONS

Do not stop at individual words.

Eventually the game should allow language combinations.

For example:

```text
OPEN DOOR
```

Then:

```text
TAKE KEY
```

Then:

```text
PUT KEY UNDER TABLE
```

Eventually:

```text
TAKE KEY BEFORE OPEN DOOR
```

The complexity should increase with the learner's language level.

However, do not build a full natural-language parser in the first prototype.

Start with a controlled language system.

The game can initially recognize predefined valid combinations.

Later we can investigate:

* grammar systems
* natural-language understanding
* speech recognition
* flexible command parsing
* AI-assisted conversation

---

# 12. DO NOT MAKE LANGUAGE COMMANDS FEEL LIKE A PROGRAMMING LANGUAGE

The player should feel like they are learning a language, not programming.

Avoid making the core interaction:

```text
> execute(open, door)
```

Prefer:

```text
OPEN DOOR
```

or contextual interaction where the player selects or types the target-language expression.

The game should gradually make the player comfortable with the actual language.

---

# 13. DISCOVERY

The player should not always be explicitly told:

> "You need to learn WORD_X."

Instead, create situations.

Example:

The player encounters a locked box.

They know:

```text
OPEN
BOX
```

but the box cannot be opened.

An NPC says something containing a new expression.

The player encounters the same word in several contexts.

Eventually they understand it.

The word becomes meaningful because it solved a problem.

This creates:

```text
Curiosity
    ↓
Context
    ↓
Repeated exposure
    ↓
Meaning
    ↓
Recall
    ↓
Successful interaction
```

---

# 14. CONTROLLED DIFFICULTY

The game should not overwhelm beginners.

The language engine already knows which words belong to which topic/chapter.

Use this information to control:

* available interactions
* dialogue complexity
* instructions
* quest vocabulary
* puzzle vocabulary
* environmental labels

A beginner area should use a constrained vocabulary.

An advanced area can require combinations and more complex expressions.

---

# 15. CHAPTERS → WORLDS

Explore whether chapters can map naturally onto game environments.

For example:

```text
Chapter 1
"Home"
    ↓
small house/world

Topics:
- rooms
- furniture
- objects
- actions
```

Another chapter:

```text
Chapter 2
"The Village"

Topics:
- people
- places
- food
- directions
- daily activities
```

Another:

```text
Chapter 3
"The Forest"

Topics:
- animals
- nature
- movement
- weather
- locations
```

Do not force this mapping.

Evaluate each chapter and determine whether it can become an interesting environment.

---

# 16. WORLD DESIGN

The first prototype should be SMALL.

Do not build a giant open world.

Create one compact environment.

Ideally something like:

```text
Small house
    +
garden
    +
one NPC
    +
several objects
    +
one small mystery
    +
one or two puzzles
```

The prototype should be completable.

The goal is to prove:

> Is learning language through interacting with the world actually fun?

---

# 17. THE FIRST PROTOTYPE

I want you to help me create a vertical slice.

The first playable prototype should include approximately:

* 1 small environment
* 1 player character
* 1–2 NPCs
* 10–30 vocabulary items
* several interactable objects
* a simple objective
* a few language-driven interactions
* one small puzzle
* basic progression
* persistent player state
* basic learning tracking

Do not attempt multiplayer in the first version.

However, architect the game so multiplayer can be added later.

---

# 18. MULTIPLAYER IS A FUTURE REQUIREMENT

The game must be designed with future multiplayer in mind.

Do NOT build the architecture around:

```text
browser is authoritative
```

Instead, keep the concept of:

```text
CLIENT
    ↓
GAME SERVER
    ↓
PERSISTENT GAME STATE
```

in mind.

Eventually:

```text
Player A
    ↓
             GAME SERVER
    ↑
Player B
```

Both players should be able to observe the same world state.

---

# 19. MULTIPLAYER-READY GAME STATE

Separate:

## Local state

Examples:

* camera position
* UI state
* temporary animation
* local visual effects

from:

## Authoritative game state

Examples:

* player position
* inventory
* object state
* quest progress
* NPC state
* puzzle state
* world changes
* learned game abilities

The second category should eventually be server-authoritative.

Even in the single-player prototype, keep the code structured so that this separation is possible.

---

# 20. REAL-TIME COMMUNICATION

When multiplayer is eventually implemented, evaluate WebSockets for real-time synchronization.

Render supports WebSocket connections on web services.

Design the game architecture so that WebSockets can later carry events such as:

```text
PLAYER_JOINED
PLAYER_LEFT
PLAYER_MOVED
OBJECT_INTERACTED
OBJECT_CHANGED
ITEM_PICKED_UP
QUEST_UPDATED
DIALOGUE_STARTED
PUZZLE_SOLVED
```

Do not implement all of this now.

Design the domain boundaries so it can be added later.

---

# 21. NEVER RELY ON IN-MEMORY SERVER STATE AS PERMANENT DATA

Render instances can be replaced and WebSocket connections can be interrupted.

Therefore:

Do not treat:

```text
server memory
```

as the permanent source of truth.

Game state that must survive:

* restarts
* deployments
* reconnections
* future horizontal scaling

must eventually live in persistent/shared storage.

Render's default filesystem is ephemeral, so don't use local files as the authoritative game database.

---

# 22. DEPLOYMENT

The deployment target is Render.

Design the application so it can eventually run as a Render Web Service.

If multiplayer requires WebSockets, use a Web Service rather than a static-only deployment. Render explicitly supports WebSocket connections on Web Services.

Do not optimize prematurely for massive scale.

First make the game work.

Then address:

* persistence
* WebSockets
* reconnects
* shared state
* scaling
* caching
* performance

when the corresponding feature actually exists.

---

# 23. RECOMMENDED INITIAL TECHNOLOGY

Do not blindly choose technologies.

Inspect my existing environment first.

If starting from scratch, evaluate a stack such as:

### Frontend

TypeScript

React

Next.js or another appropriate React framework

Tailwind CSS

shadcn/ui

### Game rendering

Evaluate:

Phaser

PixiJS

or another appropriate browser game framework.

For this particular concept, investigate Phaser first because it provides:

* scenes
* cameras
* sprites
* animation
* collision
* tilemaps
* input
* physics
* particles
* audio
* game loop

while allowing the rest of the application to remain a conventional web application.

### Backend

Choose an appropriate server architecture based on the existing project.

Do not introduce a backend framework unnecessarily if the existing application already provides the required infrastructure.

### Database

Reuse the existing application's database if practical.

Do not duplicate the language-learning data.

---

# 24. GAME ENGINE / WEB APP BOUNDARY

Keep the game world modular.

Conceptually:

```text
Web Application
│
├── authentication
├── language selection
├── chapters
├── topics
├── learning progress
└── game launcher
        │
        ▼
     GAME
        │
        ├── World
        ├── Player
        ├── NPCs
        ├── Objects
        ├── Quests
        ├── Puzzles
        └── Interactions
```

The game should communicate with the application through a clear interface.

Do not tightly couple every game object to the entire application.

---

# 25. GAME EVENTS

Create a conceptual event system.

Examples:

```text
WORD_DISCOVERED
WORD_RECALLED
WORD_USED
EXPRESSION_DISCOVERED
EXPRESSION_USED

OBJECT_INTERACTED
QUEST_STARTED
QUEST_COMPLETED
PUZZLE_STARTED
PUZZLE_COMPLETED

PLAYER_ENTERED_AREA
NPC_INTERACTION_STARTED
```

These events can later connect:

```text
Game
  ↓
Learning system
  ↓
Progress
  ↓
Spaced repetition
```

This is extremely important.

The game should generate learning data rather than bypassing the learning system.

---

# 26. LEARNING EVENTS

For every important language interaction, think about whether the game should record:

```text
word_id
context
interaction_type
success
attempts
timestamp
difficulty
```

For example:

```text
{
  word_id: "es-open-123",
  context: "door_interaction",
  interaction_type: "command",
  success: true
}
```

Do not implement the complete learning algorithm yet.

First establish the event boundary.

---

# 27. LEARNING SHOULD NOT FEEL LIKE TESTING

The player should not constantly be interrupted with:

> "Translate this word."

Instead, learning should happen through:

* exploration
* context
* repetition
* interaction
* consequences
* discovery
* dialogue
* puzzles

Traditional quizzes can exist as one tool, but they should not dominate the experience.

---

# 28. SPACED REPETITION CAN HAPPEN INSIDE THE WORLD

The existing learning engine can determine that a word is becoming weak.

The game can then create a contextual opportunity to use it again.

For example:

```text
WORD: KEY

familiarity decreasing
        ↓
game generates/reveals
a situation involving a key
        ↓
player recalls KEY
        ↓
successful interaction
        ↓
learning event recorded
```

Eventually this could become the game's natural memory-maintenance system.

---

# 29. WORD WEAR / WORLD WEAR

Explore the earlier concept of learned objects deteriorating.

A word could be represented by something in the world.

For example:

```text
CHAIR
```

becomes a physical chair.

If the word becomes weak:

```text
chair
 ↓
worn
 ↓
broken
```

The player encounters it again.

Recalling the word repairs/revives the object.

This should be treated as a potential mechanic, not an immediate requirement.

Prototype it only if it produces a good experience.

---

# 30. THE WORLD SHOULD CREATE LANGUAGE NEED

This is perhaps the most important design rule.

Never ask:

> "How can we put this vocabulary word into the game?"

Ask:

> "What situation would make the player naturally need this word?"

For example, don't put:

```text
APPLE
```

on a vocabulary card just because the topic is food.

Create a situation:

```text
NPC:
"I need an apple."

Player:
Where is the apple?

Player discovers:
APPLE
TREE
TAKE
GIVE
```

Now several words have a purpose.

---

# 31. ENVIRONMENTAL LANGUAGE

Use the environment itself as a language-learning surface.

Objects can have:

* names
* descriptions
* clues
* contextual labels
* dialogue
* visual hints

But avoid turning the entire environment into a wall of labels.

The player should discover language naturally.

---

# 32. NPCS

NPCs should eventually become an important learning mechanism.

An NPC can:

* introduce expressions
* ask questions
* provide clues
* misunderstand the player
* react to learned vocabulary
* give quests
* teach contextual language
* repeat important expressions

However, the first prototype should use deterministic dialogue.

Do not introduce AI-generated NPC dialogue until the core game loop is working.

---

# 33. AI IS OPTIONAL, NOT THE CORE GAME

Do not make an LLM necessary for the first prototype.

The fundamental game must work using deterministic systems.

Later, AI could potentially help with:

* dynamic conversations
* paraphrases
* contextual explanations
* hints
* generating examples
* adaptive dialogue
* natural-language command interpretation

But the core learning loop should not depend on an external AI API.

---

# 34. COMMAND SYSTEM

Prototype a controlled command system.

For example:

```text
OPEN DOOR
TAKE KEY
PUSH BOX
GIVE APPLE
FOLLOW ME
```

The system should understand only valid commands initially.

Build it so that the parser can eventually evolve.

Potential future architecture:

```text
Input
  ↓
Tokenizer
  ↓
Vocabulary matcher
  ↓
Intent
  ↓
Entities
  ↓
Game action
```

Example:

```text
"OPEN THE DOOR"

       ↓

intent = OPEN
target = DOOR

       ↓

GameAction(
  type: OPEN,
  target: door
)
```

---

# 35. LANGUAGE SHOULD CONTROL ACCESS

Do not make the player artificially level-gated.

Instead, language knowledge itself can create access.

For example:

The player sees:

```text
A locked door.
```

They have:

```text
OPEN
DOOR
```

but perhaps later need:

```text
KEY
```

to solve the situation.

Language becomes part of the player's capability set.

---

# 36. GAMEPLAY LOOP

The ideal loop is:

```text
EXPLORE
   ↓
NOTICE
   ↓
WONDER
   ↓
INTERACT
   ↓
ENCOUNTER LANGUAGE
   ↓
UNDERSTAND
   ↓
USE LANGUAGE
   ↓
WORLD RESPONDS
   ↓
REWARD / DISCOVERY
   ↓
EXPLORE FURTHER
```

Use this loop as a design test.

If a feature doesn't contribute meaningfully to this loop, question whether it belongs in the first version.

---

# 37. FIRST VERTICAL SLICE EXAMPLE

I want you to consider a prototype such as:

## Environment

A small house and garden.

## Target topic

"House"

## Vocabulary

Approximately 20–30 words.

Potential examples:

```text
house
door
window
room
kitchen
table
chair
bed
key
box
open
close
take
put
inside
outside
under
on
big
small
```

These are examples only.

Use the actual vocabulary from my existing topic when implementing.

## Goal

The player needs to help an NPC find something.

The solution requires several target-language words.

For example:

```text
NPC needs KEY.

Player discovers:
KEY
BOX
TABLE
UNDER
TAKE
PUT
OPEN
```

The puzzle should emerge from the vocabulary.

---

# 38. DON'T OVERBUILD THE FIRST VERSION

The first milestone is NOT:

"Complete language-learning MMORPG."

The first milestone is:

> A player can enter a small world, explore it, learn/use a handful of target-language words, solve a small problem, and feel that the language itself enabled the solution.

If that works, we expand.

---

# 39. DEVELOPMENT METHODOLOGY

Guide me incrementally.

Do NOT give me 500 files to create at once.

Work in milestones.

For each milestone:

1. Explain the objective.
2. Explain why we're doing it.
3. Identify the files/components involved.
4. Implement it.
5. Run tests/build/lint.
6. Verify it.
7. Tell me what I should see.
8. Identify the next milestone.

Do not move to the next major milestone until the current one is working.

---

# 40. GIT

Use Git aggressively.

Each meaningful milestone should result in a coherent commit.

For example:

```text
feat: create game shell
feat: add player movement
feat: add interactable objects
feat: add vocabulary integration
feat: add language command system
feat: add first puzzle
feat: add learning events
```

Keep commits small enough that we can revert experimental ideas.

---

# 41. TESTING

Do not neglect tests.

Test separately:

## Language integration

Does a vocabulary word correctly map to its game representation?

## Command parser

Does:

```text
OPEN DOOR
```

produce:

```text
OPEN(door)
```

?

## Game logic

Does the door actually open?

## Learning events

Does successful use generate the expected learning event?

## Persistence

Does game state survive reload?

Eventually:

## Multiplayer

Does server-authoritative state remain consistent between players?

Use the appropriate testing strategy for the chosen stack.

---

# 42. PERFORMANCE

The game should run smoothly in a browser.

Pay attention to:

* render loops
* unnecessary React rerenders
* asset sizes
* image formats
* sprite sheets
* audio loading
* memory usage
* network requests

Do not optimize prematurely.

Measure first.

---

# 43. ART DIRECTION

The visual style should reinforce:

CALM + CURIOSITY.

Think:

* small beautiful environments
* restrained color palette
* soft lighting
* atmospheric backgrounds
* expressive environmental details
* simple but memorable characters
* subtle animation
* tactile objects
* visual storytelling

Avoid:

* generic cartoon assets
* excessive UI
* noisy HUD
* aggressive particle effects
* excessive gamification

The world should feel like a place worth exploring.

---

# 44. UI

The game UI should be minimal.

The world should occupy most of the screen.

Potential UI:

```text
┌───────────────────────────────────────┐
│                                       │
│             GAME WORLD                │
│                                       │
│                                       │
│                         ┌───────────┐ │
│                         │ WORD      │ │
│                         │ discovery │ │
│                         └───────────┘ │
│                                       │
│                                       │
│             [ interaction ]            │
│                                       │
└───────────────────────────────────────┘
```

Do not cover the world with dashboards.

---

# 45. ACCESSIBILITY

Support:

* keyboard controls
* configurable controls
* readable text
* subtitles
* audio controls
* reduced motion
* color-independent feedback
* accessible UI controls

The game should remain usable even if some visual/audio features are disabled.

---

# 46. MOBILE

The first prototype can prioritize desktop.

However, don't architect the UI so that mobile becomes impossible later.

Keep the game input layer abstract enough that we can eventually support:

```text
keyboard
mouse
touch
gamepad
```

---

# 47. FUTURE MULTIPLAYER

Eventually I want players to be able to enter the same world.

Possible future scenarios:

### Cooperative exploration

Two learners explore together.

### Language puzzles

Two players need to communicate in the target language to solve a problem.

### Shared objects

One player finds something.

Another player needs it.

### NPC quests

Players collaborate to help characters.

### Communication challenge

Players must use the target language to coordinate.

This could eventually make language itself a social mechanic.

Do not implement these yet.

But keep them in mind when designing the domain model.

---

# 48. MULTIPLAYER SHOULD ENCOURAGE LANGUAGE USE

When multiplayer arrives, do not simply add:

```text
multiplayer + chat
```

The language should be part of cooperation.

For example:

Player A knows:

```text
OPEN
```

Player B knows:

```text
KEY
```

They need to communicate to solve a puzzle.

Or:

Player A discovers:

```text
BRIDGE
```

Player B discovers:

```text
CROSS
```

Together they figure out:

```text
CROSS THE BRIDGE
```

The social experience becomes another reason to learn.

---

# 49. DATA MODEL PRINCIPLES

Preserve the existing language-learning model.

Do not duplicate:

```text
language pair
chapter
topic
word
```

inside a separate game database unless there is a compelling reason.

Instead create relationships such as:

```text
Topic
  ↓
GameArea

Word
  ↓
GameObject / Action / Dialogue / PuzzleRequirement
```

Keep these mappings explicit.

For example:

```text
VocabularyWord
  id: 123

GameMapping
  vocabulary_word_id: 123
  game_role: "interactable"
  game_object_type: "door"
```

The exact implementation should be decided after inspecting my existing application.

---

# 50. DO NOT ASSUME THE CURRENT DATA MODEL

Before implementing the integration:

Inspect the actual project.

Find:

* models
* schemas
* APIs
* database
* fixtures
* seed data
* existing endpoints
* vocabulary structure
* chapter structure
* topic structure
* language-pair structure

Then explain exactly how you propose integrating the game.

Do not invent fields that already exist.

Do not duplicate data unnecessarily.

---

# 51. DOCUMENT THE ARCHITECTURE

Create:

```text
docs/
  GAME_ARCHITECTURE.md
  GAME_DESIGN.md
  LANGUAGE_INTEGRATION.md
  MULTIPLAYER_ARCHITECTURE.md
  DEVELOPMENT_ROADMAP.md
```

Keep these documents updated as the project evolves.

---

# 52. CLAUDE'S ROLE

You should continuously switch between these roles as necessary:

## Product designer

Does this feature improve the learning experience?

## Game designer

Is this actually fun?

## Learning designer

Does this create useful language exposure and retrieval?

## UX designer

Is the interaction understandable?

## Software architect

Will this architecture survive future development?

## Developer

Can we implement this cleanly?

## QA engineer

Does it actually work?

Do not optimize one dimension while destroying another.

---

# 53. WHEN I HAVE AN IDEA

When I propose a feature, don't immediately implement it.

First analyze:

1. What player problem does it solve?
2. What learning objective does it support?
3. What gameplay loop does it create?
4. What data does it require?
5. How does it affect the existing architecture?
6. Does it make multiplayer harder later?
7. Is it appropriate for the current prototype?
8. What is the smallest version worth testing?

Then recommend whether we should:

* implement now
* prototype separately
* postpone
* reject

Explain the reasoning.

---

# 54. WHEN YOU DISAGREE WITH ME

Don't blindly implement an idea if you think it will damage the game.

Explain the tradeoff.

For example:

> "This is interesting, but I would postpone it because it introduces three systems before we've validated the core learning loop."

Then suggest a smaller experiment.

I want you to help me make the product better, not merely execute instructions.

---

# 55. FIRST TASK

Do NOT start coding immediately.

Your first response should be an analysis of the existing project.

Inspect the repository and report:

## A. Existing architecture

What technologies are already being used?

## B. Existing language model

Show me how the actual:

```text
Language Pair
→ Chapter
→ Topic
→ Word
```

structure is represented in the code/database.

## C. Existing frontend

Explain how the current UI works.

## D. Existing backend

Explain how the data is exposed.

## E. Game integration strategy

Propose how the game should connect to the existing language system.

## F. Recommended game technology

Based on the actual project, decide whether Phaser, PixiJS, Canvas, or another approach is appropriate.

Do not choose based solely on generic preferences.

## G. Multiplayer-ready architecture

Describe how we should separate:

```text
client state
game state
learning state
persistent state
```

so multiplayer can be added later.

## H. First vertical slice

Design the smallest playable prototype using one existing chapter/topic.

## I. Development roadmap

Give me approximately 8–12 milestones.

For each milestone include:

* objective
* main files
* expected result
* testing strategy
* whether it affects future multiplayer architecture

Then stop.

Wait for me to approve the architecture/roadmap before making large changes.

---

# FINAL PRINCIPLE

The product we are building is not:

> A vocabulary app with a game attached.

It is:

> A game world whose systems naturally create reasons to learn and use language.

The player's language knowledge should gradually expand their ability to understand and manipulate the world.

The ultimate loop is:

```text
             EXPLORE
                ↓
             NOTICE
                ↓
             WONDER
                ↓
           ENCOUNTER
            LANGUAGE
                ↓
             LEARN
                ↓
              USE
                ↓
         WORLD RESPONDS
                ↓
            DISCOVER
                ↓
             EXPLORE
                ↓
               ...
```

Build toward that.

Start by inspecting the actual project and existing language data.

Do not code the game until you understand what already exists.
