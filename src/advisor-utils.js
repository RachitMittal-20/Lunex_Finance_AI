import { formatMoney } from './dashboard-utils.js'

export const advisorSystemInstruction = `
You are Lunex AI Advisor, an elite financial guru built into a personal finance dashboard.

Your role:
- act like a sharp, disciplined personal finance strategist
- help the user improve spending habits, budget quality, savings consistency, and financial awareness
- speak with calm authority, clear reasoning, and practical realism

Your boundaries:
- do not claim to be a licensed financial advisor, tax advisor, or fiduciary
- do not suggest risky investing, debt, tax, or legal actions as certainties
- do not invent transactions, categories, trends, or goals that are not present in the dashboard data

Your style:
- concise, premium, analytical, and supportive
- direct but never judgmental
- emphasize leverage, tradeoffs, priorities, and realistic next actions
- prefer specific categories and numbers from the data whenever available

Decision rules:
- identify the biggest pressure points first
- prioritize sustainable budget cuts over extreme advice
- if the user has a savings goal, connect every recommendation back to that goal
- favor recommendations that are high-impact and low-disruption
- if income is strong but discretionary spending is drifting, say that clearly
- if the user is already doing well, acknowledge that and focus on optimization

Output rules:
- return valid JSON only
- keep explanations practical and grounded in the supplied dashboard context
- do not include markdown
`.trim()

export function buildAdvisorUserPrompt(context, question) {
  return `
Use the dashboard context and answer the user request as Lunex's financial guru.

Return JSON with exactly these top-level keys:
- overview
- budgetSuggestion
- cutSuggestion
- goalSuggestion
- actions
- followUps
- budgetPlans
- monthlyReport
- answer

Hard requirements:
- actions: array of exactly 3 short strings
- followUps: array of exactly 4 short user-facing prompt strings
- budgetPlans: object with keys conservative, balanced, aggressive
- each budget plan value: array of up to 3 objects with keys category, target, reason
- monthlyReport: object with keys headline, summary, trend, watchlist
- target values must be numbers, not strings
- answer must be a short paragraph
- mention concrete categories when possible
- if a category does not exist in the data, do not mention it

Dashboard context:
${JSON.stringify(context, null, 2)}

User question:
${question}
`.trim()
}

export function buildAdvisorContext({ transactions, budgets, goal }) {
  const income = transactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
  const expenses = transactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
  const balance = income - expenses
  const savingsRate = income ? Math.round((balance / income) * 100) : 0
  const months = [...new Set(transactions.map((item) => item.date.slice(0, 7)))].sort().slice(-3)

  const monthlySnapshot = months.map((month) => {
    const monthItems = transactions.filter((item) => item.date.startsWith(month))
    const monthIncome = monthItems.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
    const monthExpenses = monthItems.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
    return {
      month,
      income: monthIncome,
      expenses: monthExpenses,
      net: monthIncome - monthExpenses,
    }
  })

  const categorySpend = budgets.map((budget) => {
    const spent = transactions
      .filter((item) => item.type === 'expense' && item.category === budget.category)
      .reduce((sum, item) => sum + item.amount, 0)

    return {
      category: budget.category,
      limit: budget.limit,
      spent,
      overBy: Math.max(0, spent - budget.limit),
      remaining: budget.limit - spent,
    }
  })

  return {
    income,
    expenses,
    balance,
    savingsRate,
    goal,
    categorySpend,
    monthlySnapshot,
    recentTransactions: transactions.slice(0, 12),
  }
}

export function fallbackAdvisorCards(context) {
  const highestRisk = [...context.categorySpend].sort((a, b) => b.spent / Math.max(b.limit, 1) - a.spent / Math.max(a.limit, 1))[0]
  const highestCut = [...context.categorySpend].sort((a, b) => b.spent - a.spent)[0]
  const latestMonth = context.monthlySnapshot[context.monthlySnapshot.length - 1]
  const conservativePlans = context.categorySpend.slice(0, 3).map((item) => ({
    category: item.category,
    target: Math.max(0, Math.round(item.spent * 0.95)),
    reason: 'Small trim from recent spending with minimal disruption.',
  }))
  const balancedPlans = context.categorySpend.slice(0, 3).map((item) => ({
    category: item.category,
    target: Math.max(0, Math.round(item.spent * 0.88)),
    reason: 'Moderate reduction to improve monthly savings rate.',
  }))
  const aggressivePlans = context.categorySpend.slice(0, 3).map((item) => ({
    category: item.category,
    target: Math.max(0, Math.round(item.spent * 0.78)),
    reason: 'Stronger reset intended for short-term savings acceleration.',
  }))

  return {
    overview: `You are currently at a ${context.savingsRate}% savings rate with a balance of ${formatMoney(context.balance)}.`,
    budgetSuggestion: highestRisk
      ? `Review ${highestRisk.category}. It has used ${Math.round((highestRisk.spent / Math.max(highestRisk.limit, 1)) * 100)}% of its budget.`
      : 'Your budget profile looks stable right now.',
    cutSuggestion: highestCut
      ? `The easiest category to optimize is ${highestCut.category}, where you have spent ${formatMoney(highestCut.spent)}.`
      : 'No spending data is available yet.',
    goalSuggestion:
      context.balance >= context.goal
        ? `You are already above your current goal of ${formatMoney(context.goal)}.`
        : `You still need ${formatMoney(context.goal - context.balance)} to hit your active goal.`,
    actions: [
      'Reduce the highest discretionary category by 10 to 15 percent first.',
      'Keep salary and freelance income directed toward the goal before optional purchases.',
      'Review repeat transactions and subscriptions for quick savings wins.',
    ],
    followUps: [
      'Build me a conservative monthly budget.',
      'What is the fastest category to cut safely?',
      'How can I hit my savings goal sooner?',
      'Summarize this month in plain English.',
    ],
    budgetPlans: {
      conservative: conservativePlans,
      balanced: balancedPlans,
      aggressive: aggressivePlans,
    },
    monthlyReport: {
      headline: latestMonth ? `Monthly net is ${formatMoney(latestMonth.net)}.` : 'No monthly report available yet.',
      summary: latestMonth
        ? `The most recent month closed with ${formatMoney(latestMonth.income)} income and ${formatMoney(latestMonth.expenses)} expenses.`
        : 'There is not enough monthly data yet.',
      trend: highestRisk
        ? `${highestRisk.category} is the main budget pressure point right now.`
        : 'No major pressure point is visible right now.',
      watchlist: highestCut
        ? `Watch ${highestCut.category}, which remains the largest expense bucket at ${formatMoney(highestCut.spent)}.`
        : 'No watchlist items available.',
    },
  }
}

export function normalizeAdvisorResponse(payload, context) {
  const fallback = fallbackAdvisorCards(context)
  const cleanText = (value) => value
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\r/g, '')
    .trim()
  const objectToText = (value) => {
    if (!value || typeof value !== 'object') return ''

    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === 'string') return item
          if (typeof item === 'object') return objectToText(item)
          return String(item)
        })
        .filter(Boolean)
        .join(' • ')
    }

    return Object.entries(value)
      .map(([key, item]) => {
        if (Array.isArray(item)) {
          const nested = objectToText(item)
          return nested ? `${key}: ${nested}` : key
        }
        if (item && typeof item === 'object') {
          const nested = objectToText(item)
          return nested ? `${key}: ${nested}` : key
        }
        return `${key}: ${item}`
      })
      .filter(Boolean)
      .join(' • ')
  }
  const normalizeText = (value, fallbackValue) => {
    if (Array.isArray(value)) {
      const joined = value.filter(Boolean).join(' • ')
      return joined ? cleanText(joined) : fallbackValue
    }
    if (value && typeof value === 'object') {
      const joined = objectToText(value)
      return joined ? cleanText(joined) : fallbackValue
    }
    return typeof value === 'string' && value.trim() ? cleanText(value) : fallbackValue
  }
  const normalizePlan = (items, fallbackItems) => (
    Array.isArray(items) && items.length
      ? items.slice(0, 3).map((item, index) => ({
          category: item?.category || fallbackItems[index]?.category || 'Other',
          target: Number(item?.target ?? fallbackItems[index]?.target ?? 0),
          reason: normalizeText(item?.reason, fallbackItems[index]?.reason || 'Keep this category under control.'),
        }))
      : fallbackItems
  )

  return {
    overview: normalizeText(payload?.overview, fallback.overview),
    budgetSuggestion: normalizeText(payload?.budgetSuggestion, fallback.budgetSuggestion),
    cutSuggestion: normalizeText(payload?.cutSuggestion, fallback.cutSuggestion),
    goalSuggestion: normalizeText(payload?.goalSuggestion, fallback.goalSuggestion),
    actions: Array.isArray(payload?.actions) && payload.actions.length
      ? payload.actions.slice(0, 3).map((item, index) => normalizeText(item, fallback.actions[index] || fallback.actions[0]))
      : fallback.actions,
    followUps: Array.isArray(payload?.followUps) && payload.followUps.length
      ? payload.followUps.slice(0, 4).map((item, index) => normalizeText(item, fallback.followUps[index] || fallback.followUps[0]))
      : fallback.followUps,
    budgetPlans: {
      conservative: normalizePlan(payload?.budgetPlans?.conservative, fallback.budgetPlans.conservative),
      balanced: normalizePlan(payload?.budgetPlans?.balanced, fallback.budgetPlans.balanced),
      aggressive: normalizePlan(payload?.budgetPlans?.aggressive, fallback.budgetPlans.aggressive),
    },
    monthlyReport: {
      headline: normalizeText(payload?.monthlyReport?.headline, fallback.monthlyReport.headline),
      summary: normalizeText(payload?.monthlyReport?.summary, fallback.monthlyReport.summary),
      trend: normalizeText(payload?.monthlyReport?.trend, fallback.monthlyReport.trend),
      watchlist: normalizeText(payload?.monthlyReport?.watchlist, fallback.monthlyReport.watchlist),
    },
    answer: normalizeText(payload?.answer, fallback.overview),
  }
}
