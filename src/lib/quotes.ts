export const quotes = [
  "Financial freedom is mental, emotional, and physical freedom.",
  "Do not save what is left after spending, but spend what is left after saving. – Warren Buffett",
  "Beware of little expenses; a small leak will sink a great ship. – Benjamin Franklin",
  "A penny saved is a penny earned. – Benjamin Franklin",
  "Rich people invest in time, poor people invest in money. – Warren Buffett",
  "The goal is not more money. The goal is living life on your own terms.",
  "Financial peace isn't the acquisition of stuff. It's learning to live on less than you make.",
  "Never depend on a single income. Make investments to create a second source.",
  "Opportunities come infrequently. When it rains gold, put out the bucket, not the thimble.",
  "Budgeting isn't about limiting yourself; it's about making your money work for you.",
  "The price of anything is the amount of life you exchange for it. – Henry David Thoreau",
  "Compound interest is the eighth wonder of the world. He who understands it, earns it... he who doesn't... pays it.",
  "Every rupee you save is a step closer to owning your own time.",
  "An investment in knowledge pays the best interest. – Benjamin Franklin",
  "It’s not how much money you make, but how much money you keep, how hard it works for you, and how many generations you keep it for.",
  "The best way to predict your financial future is to create it.",
  "Too many people spend money they haven't earned, to buy things they don't want, to impress people they don't like. – Will Rogers",
  "Freedom is the ultimate luxury.",
  "Wealth consists not in having great possessions, but in having few wants. – Epictetus",
  "Your assets are your employees. Send them out to make more employees.",
  "Salary is the bribe they give you to forget your dreams. Build your own freedom.",
  "Debt is the worst poverty. Pay it off and be free.",
  "Don't work for money; make money work for you.",
  "If you buy things you do not need, soon you will have to sell things you need.",
  "A simple lifestyle is compatible with high financial goals.",
  "Consistency is the secret key to compounding.",
  "Invest in your future self today. Kalai, your future is worth saving for!",
  "Financial freedom is not about being rich; it's about being free to make choices.",
  "The first step towards freedom is tracking where your money goes.",
  "Build assets, reduce liabilities, and watch compounding do the magic.",
  "Start where you are, use what you have, do what you can. Financial freedom starts today!"
];

export function getDailyQuote(): string {
  const date = new Date();
  const day = date.getDate(); // 1 to 31
  return quotes[(day - 1) % quotes.length];
}
