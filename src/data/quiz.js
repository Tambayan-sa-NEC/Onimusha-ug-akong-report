/**
 * The riddle pool.
 */

/* ---------- Riddle pool: [question, correct answer, wrong, wrong] ---------- */
const QUIZ = [
  ['What does "arigatō" mean?', 'Thank you', 'Goodbye', 'Good morning'],
  ['What does "oyasumi" mean?', 'Good night', 'Welcome', 'Excuse me'],
  ['What is the red gate at a Shinto shrine called?', 'Torii', 'Shōji', 'Tatami'],
  ['What does a kappa keep on top of its head?', 'A dish of water', 'A tiny hat', 'A cucumber'],
  ['Which animal is said to shape-shift using a leaf?', 'Tanuki', 'Crane', 'Koi'],
  ['What is matcha?', 'Powdered green tea', 'Rice wine', 'Sweet bean paste'],
  ['How many tails can the oldest kitsune grow?', 'Nine', 'Three', 'Twelve'],
  ['At Setsubun, what do people throw to chase away oni?', 'Roasted soybeans', 'Rice balls', 'Flower petals'],
  ['What syllable pattern does a haiku follow?', '5-7-5', '7-7-7', '3-5-3'],
  ['What is the long-nosed mountain yokai called?', 'Tengu', 'Yūrei', 'Nue'],
  ['What weapon does an oni usually carry?', 'An iron club (kanabō)', 'A bow', 'A fan'],
  ['Which flower is famous for Japanese spring viewing (hanami)?', 'Cherry blossom', 'Lotus', 'Sunflower'],
];
const LAN_NOTES = [659.25, 440, 523.25, 329.63];
const DIGIT = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 };

export { DIGIT, LAN_NOTES, QUIZ };
