<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# L0180 RAG Training Examples

68 example prompts for training a RAG model on L0180, the web-based assessment language —
covering multiple choice, true/false, multi-select, weighted scoring, penalized distractors,
presentation options, unscored polls, and multi-part items over a reading passage.

Each numbered line is a prompt in the author's own voice. Prompts describe WHAT to build,
never how to write it: an author asks for a question, not for a `choice [...]` program. When
L0180 grows further interaction types, this file grows categories with them.

## Category 1: Basic Multiple Choice (1–12)

1. A multiple-choice question asking what 2 + 2 is, with options 3, 4 and 5, where 4 is correct.
2. Ask which planet is closest to the Sun. Options: Mercury, Venus, Earth, Mars. Mercury is correct.
3. Create a question asking for the capital of France, with Paris, Lyon, Marseille and Nice as options.
4. Which gas do plants absorb during photosynthesis? Offer oxygen, carbon dioxide, nitrogen and hydrogen. Carbon dioxide is right.
5. A reading comprehension question: which word best describes the narrator's mood — anxious, cheerful, bored or angry? Anxious is correct.
6. Ask who wrote "Romeo and Juliet", with Shakespeare, Dickens, Austen and Chaucer as choices.
7. Make a question about the water cycle asking what evaporation turns liquid water into. Options: vapour, ice, rain, snow.
8. Which of these is a prime number: 4, 6, 9 or 7? Seven is the answer.
9. A history question asking in which year the Second World War ended — 1943, 1945, 1947 or 1950.
10. Ask what the chemical symbol for gold is. Offer Au, Ag, Gd and Go, with Au correct.
11. Create a multiple-choice question on the largest organ in the human body, with skin as the correct answer among liver, heart and skin.
12. Which of these shapes has four equal sides? Give square, rectangle, triangle and circle as options.

## Category 2: True/False (13–20)

13. True or false: the Pacific is the largest ocean. True is correct.
14. A true/false question stating that spiders are insects. The answer is false.
15. True or false — the Great Wall of China is visible from the Moon with the naked eye. False.
16. Ask whether water boils at 100 degrees Celsius at sea level, as a true/false item. True.
17. True or false: Australia is both a country and a continent. Correct answer is true.
18. Present the claim "all mammals lay eggs" as true or false. It is false.
19. A true/false item on whether the Amazon is the longest river in the world. False — the Nile is longer.
20. True or false: a triangle's interior angles always sum to 180 degrees. True.

## Category 3: Multi-Select (21–32)

21. Select all the prime numbers from 2, 4, 5, 9 and 11 — 2, 5 and 11 are correct.
22. Which of these are mammals? Blue whale, great white shark, bat, sea turtle. Whale and bat are right.
23. Select all that apply: which of these countries are in South America — Brazil, Peru, Mexico, Chile?
24. Ask which of six words are nouns: run, table, quickly, mountain, sing, courage. Table, mountain and courage.
25. Choose every renewable energy source from solar, coal, wind, natural gas and hydroelectric.
26. Which of these are noble gases? Helium, oxygen, neon, argon, chlorine. Three are correct.
27. Select all the even numbers from 3, 8, 12, 15 and 20.
28. Pick every state of matter listed: solid, gravity, liquid, gas, density.
29. Which of these authors wrote novels in the nineteenth century? Dickens, Austen, Orwell, Brontë.
30. Select all the primary colours from red, green, blue, yellow and orange, allowing up to three selections.
31. Ask which of five foods are good sources of protein: eggs, lettuce, beans, chicken, apples.
32. Which of these are programming languages — Python, HTML, Java, CSS, Ruby? Allow three answers.

## Category 4: Weighted Answers and Partial Credit (33–42)

33. Which planet is closest to the Sun? Mercury is right and worth 2 points.
34. A question on the causes of the Civil War where the best answer earns 3 points.
35. Ask for the derivative of x squared, with the correct option worth 5 points.
36. Which sentence best states the central idea? Make the correct choice worth 2 points rather than 1.
37. Select all the prime numbers from 2, 4, 5, 9 and 11, where 2 is worth 1 point, 5 is worth 2 and 11 is worth 2.
38. A multi-select on renewable energy where each correct source earns 2 points.
39. Ask which two events happened before 1900, awarding 3 points for one and 1 for the other.
40. Which of these are noble gases? Give helium 1 point, neon 1 point and argon 2 points.
41. A question where the best answer is worth 4 points and a partially right answer is worth 1.
42. Make a five-option question where three options are correct and together they total 6 points.

## Category 5: Penalized Distractors (43–48)

43. Which planet is closest to the Sun? Mercury is right; penalize "The Moon" by a point.
44. Ask which of these is a mammal, and take a point off for choosing the great white shark.
45. A question on prime numbers where selecting 9 costs a point.
46. Make a multi-select on noble gases where each wrong selection loses a point.
47. Which word is spelled correctly? Deduct a point for the common misspelling.
48. Ask a chemistry question where the plausible-but-wrong answer carries a one-point penalty.

## Category 6: Presentation — Shuffling and Ids (49–56)

49. Select all the prime numbers from 2, 4, 5, 9 and 11, and shuffle the options.
50. A multiple-choice question on the capital of Japan with the options presented in random order.
51. Ask which of four animals is a mammal and give the options readable ids like "whale" and "shark".
52. Create a question about the water cycle with shuffled options so it can be reused across a class.
53. A four-option history question with the options shuffled and the correct answer worth 2 points.
54. Ask which shape has four equal sides, naming the options "square", "rect", "tri" and "circle".
55. Make a true/false item with the options in random order.
56. A multi-select on programming languages with authored ids so results can be reported per language.

## Category 7: Unscored Polls (57–60)

57. An ungraded poll asking which topic students found hardest: fractions, decimals or percentages.
58. Ask students how confident they feel about the material — very, somewhat, or not at all — without scoring it.
59. A poll collecting which project theme the class would prefer, with four options and no right answer.
60. Ask which day suits the review session best, as an unscored question.

## Category 8: Passages and Multi-Part Items (61–68)

61. A two-part reading question about a short passage: first what the reader can conclude about the character, then which line supports that answer. Both parts must be right for the point.
62. Give students a paragraph about honeybees and ask which sentence best states the central idea.
63. A reading item with a four-paragraph passage about a girl fixing a neighbour's porch, asking what it shows about her character.
64. Two questions about the same passage on the water cycle, each worth its own point.
65. An evidence-based question where part A asks for the author's purpose and part B asks which sentence shows it — award nothing unless both are right.
66. A passage titled "How a Honeybee Colony Works" followed by a multiple-choice question about the main idea.
67. A two-part item about a short informational text where the first part is worth 2 points and the second is worth 1.
68. Show a numbered passage and ask which line best supports the claim that the narrator regrets her decision.
