interface CategoryRule {
  category: string;
  keywords: string[];
}

const MERCHANT_RULES: CategoryRule[] = [
  { category: 'Food', keywords: ['swiggy', 'zomato', 'uber eats', 'dominos', 'mcdonald', 'kfc', 'hotel', 'restaurant', 'cafe', 'pizza', 'burger', 'biryani', 'dine', 'eatery', 'bakery', 'chai', 'starbucks', 'dunkin'] },
  { category: 'Fuel', keywords: ['petrol', 'bpcl', 'hpcl', 'indian oil', 'iocl', 'hp petrol', 'shell', 'fuel', 'diesel', 'cng', 'ev charge'] },
  { category: 'Shopping', keywords: ['amazon', 'flipkart', 'myntra', 'meesho', 'ajio', 'nykaa', 'croma', 'reliance digital', 'tata cliq', 'snapdeal', 'bigbasket', 'blinkit', 'zepto', 'instamart', 'dmart'] },
  { category: 'Entertainment', keywords: ['netflix', 'spotify', 'hotstar', 'prime video', 'youtube', 'disney', 'zee5', 'sonyliv', 'jiocinema', 'bookmyshow', 'pvr', 'inox', 'game'] },
  { category: 'Healthcare', keywords: ['apollo', 'hospital', 'pharmacy', 'medical', 'pharmeasy', 'netmeds', '1mg', 'doctor', 'clinic', 'diagnostic', 'lab', 'health'] },
  { category: 'Utilities', keywords: ['electricity', 'water', 'gas', 'broadband', 'jio', 'airtel', 'bsnl', 'vi ', 'vodafone', 'tata sky', 'dish tv', 'internet', 'wifi', 'recharge', 'postpaid', 'prepaid'] },
  { category: 'Transport', keywords: ['uber', 'ola', 'rapido', 'metro', 'irctc', 'redbus', 'makemytrip', 'goibibo', 'cleartrip', 'indigo', 'spicejet', 'railway', 'bus', 'taxi', 'auto', 'parking', 'toll', 'fastag'] },
  { category: 'Rent', keywords: ['rent', 'pg ', 'hostel', 'landlord', 'housing', 'flat', 'apartment'] },
  { category: 'EMI', keywords: ['emi', 'loan', 'installment', 'bajaj finserv', 'hdfc ltd', 'home credit'] },
  { category: 'Education', keywords: ['school', 'college', 'university', 'tuition', 'course', 'udemy', 'coursera', 'unacademy', 'byju'] },
  { category: 'Investment', keywords: ['zerodha', 'groww', 'upstox', 'angel', 'motilal', 'sip', 'mutual fund', 'mf ', 'coin', 'kuvera', 'smallcase'] },
];

export function categorizeByMerchant(merchant: string): string {
  const lower = merchant.toLowerCase();
  for (const rule of MERCHANT_RULES) {
    for (const keyword of rule.keywords) {
      if (lower.includes(keyword)) return rule.category;
    }
  }
  return 'Miscellaneous';
}

export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    'Food': '🍕',
    'Fuel': '⛽',
    'Shopping': '🛍️',
    'Entertainment': '🎬',
    'Healthcare': '🏥',
    'Utilities': '💡',
    'Transport': '🚗',
    'Rent': '🏠',
    'EMI': '💳',
    'Education': '📚',
    'Investment': '📈',
    'Miscellaneous': '🎯',
  };
  return icons[category] || '🎯';
}
