export const categoryMeta = {
  Housing: { color: '#7B68EE', bg: '#EDE9FF', icon: '🏠' },
  Food: { color: '#4ECBA8', bg: '#E0F7F1', icon: '🍔' },
  Transport: { color: '#FFB347', bg: '#FFF0D9', icon: '🚗' },
  Entertainment: { color: '#FF7EB3', bg: '#FFE8F3', icon: '🎬' },
  Health: { color: '#5BBCFF', bg: '#E3F4FF', icon: '💊' },
  Utilities: { color: '#A78BFA', bg: '#EDE9FF', icon: '💡' },
  Shopping: { color: '#FB923C', bg: '#FFF0D9', icon: '🛍️' },
  Salary: { color: '#4ECBA8', bg: '#E0F7F1', icon: '💼' },
  Freelance: { color: '#5BBCFF', bg: '#E3F4FF', icon: '💻' },
  Other: { color: '#94A3B8', bg: '#F1F5F9', icon: '📦' },
}

export const seedTransactions = [
  { id: 1, date: '2026-03-28', description: 'Monthly Salary', category: 'Salary', type: 'income', amount: 6200 },
  { id: 2, date: '2026-03-27', description: 'Apartment Rent', category: 'Housing', type: 'expense', amount: 1650 },
  { id: 3, date: '2026-03-26', description: 'Groceries', category: 'Food', type: 'expense', amount: 230 },
  { id: 4, date: '2026-03-25', description: 'Streaming Bundle', category: 'Entertainment', type: 'expense', amount: 42 },
  { id: 5, date: '2026-03-24', description: 'Freelance Sprint', category: 'Freelance', type: 'income', amount: 1450 },
  { id: 6, date: '2026-03-22', description: 'Power & Water', category: 'Utilities', type: 'expense', amount: 124 },
  { id: 7, date: '2026-03-21', description: 'Ride Shares', category: 'Transport', type: 'expense', amount: 86 },
  { id: 8, date: '2026-03-18', description: 'Pharmacy', category: 'Health', type: 'expense', amount: 74 },
  { id: 9, date: '2026-03-16', description: 'Headphones', category: 'Shopping', type: 'expense', amount: 180 },
  { id: 10, date: '2026-03-14', description: 'Dinner with Clients', category: 'Food', type: 'expense', amount: 112 },
  { id: 11, date: '2026-02-28', description: 'Monthly Salary', category: 'Salary', type: 'income', amount: 6200 },
  { id: 12, date: '2026-02-27', description: 'Apartment Rent', category: 'Housing', type: 'expense', amount: 1650 },
  { id: 13, date: '2026-02-21', description: 'Freelance Retainer', category: 'Freelance', type: 'income', amount: 980 },
  { id: 14, date: '2026-02-17', description: 'Weekend Trip', category: 'Entertainment', type: 'expense', amount: 260 },
  { id: 15, date: '2026-02-15', description: 'Supermarket Run', category: 'Food', type: 'expense', amount: 190 },
  { id: 16, date: '2026-02-11', description: 'Internet Bill', category: 'Utilities', type: 'expense', amount: 72 },
  { id: 17, date: '2026-01-29', description: 'Monthly Salary', category: 'Salary', type: 'income', amount: 6200 },
  { id: 18, date: '2026-01-26', description: 'Furniture Installment', category: 'Shopping', type: 'expense', amount: 340 },
  { id: 19, date: '2026-01-24', description: 'Fuel', category: 'Transport', type: 'expense', amount: 96 },
  { id: 20, date: '2026-01-19', description: 'Health Checkup', category: 'Health', type: 'expense', amount: 160 },
]

export const seedBudgets = [
  { category: 'Housing', limit: 1800 },
  { category: 'Food', limit: 500 },
  { category: 'Transport', limit: 220 },
  { category: 'Entertainment', limit: 320 },
  { category: 'Utilities', limit: 180 },
  { category: 'Shopping', limit: 380 },
]

export const seedNotifications = [
  { id: 1, title: 'Budget check-in', body: 'Food spend is moving faster than usual this month.', read: false, kind: 'warning' },
  { id: 2, title: 'Savings momentum', body: 'Your current savings rate is above last month.', read: false, kind: 'success' },
  { id: 3, title: 'Workspace synced', body: 'Your dashboard preferences are saved locally.', read: true, kind: 'info' },
]

export const seedStockWatchlist = ['AAPL', 'MSFT', 'NVDA', 'TSLA']

export const initialDashboardState = {
  transactions: seedTransactions,
  budgets: seedBudgets,
  role: 'admin',
  theme: 'pastel',
  activeTab: 'overview',
  goal: 4000,
  notifications: seedNotifications,
  stockWatchlist: seedStockWatchlist,
}
