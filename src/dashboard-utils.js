import { initialDashboardState } from './data.js'

export const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'stocks', label: 'Stocks' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'insights', label: 'Insights' },
  { id: 'advisor', label: 'AI Advisor' },
]

export const statCards = [
  { key: 'balance', label: 'Net Balance', tone: 'indigo', icon: '◌' },
  { key: 'income', label: 'Income', tone: 'mint', icon: '↗' },
  { key: 'expenses', label: 'Expenses', tone: 'rose', icon: '↘' },
  { key: 'savingsRate', label: 'Savings Rate', tone: 'sun', icon: '%' },
]

export const formatMoney = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value)

export const formatCompactMoney = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)

export const monthLabel = (date) =>
  new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(`${date}T00:00:00`))

export const hydrateDashboardState = (payload) => ({
  transactions: payload.transactions ?? initialDashboardState.transactions,
  budgets: payload.budgets ?? initialDashboardState.budgets,
  role: payload.role ?? initialDashboardState.role,
  theme: payload.theme ?? initialDashboardState.theme,
  activeTab: payload.activeTab === 'transactions' ? initialDashboardState.activeTab : (payload.activeTab ?? initialDashboardState.activeTab),
  goal: payload.goal ?? initialDashboardState.goal,
  notifications: payload.notifications ?? initialDashboardState.notifications,
  stockWatchlist: payload.stockWatchlist ?? initialDashboardState.stockWatchlist,
})

export const serializeDashboardState = ({
  transactions,
  budgets,
  role,
  theme,
  activeTab,
  goal,
  notifications,
  stockWatchlist,
}) => ({
  transactions,
  budgets,
  role,
  theme,
  activeTab,
  goal,
  notifications,
  stockWatchlist,
})
