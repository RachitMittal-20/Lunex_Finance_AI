import { useEffect, useMemo, useRef, useState } from 'react'
import { categoryMeta, initialDashboardState } from './data'
import { fetchAdvisor, fetchDashboardState, fetchMarket, fetchStocks, saveDashboardState } from './dashboard-api'
import {
  formatCompactMoney,
  formatMoney,
  hydrateDashboardState,
  monthLabel,
  navItems,
  serializeDashboardState,
  statCards,
} from './dashboard-utils'

function Icon({ path }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path}
    </svg>
  )
}

function App() {
  const [transactions, setTransactions] = useState(initialDashboardState.transactions)
  const [budgets, setBudgets] = useState(initialDashboardState.budgets)
  const [role, setRole] = useState(initialDashboardState.role)
  const [theme, setTheme] = useState(initialDashboardState.theme)
  const [activeTab, setActiveTab] = useState(initialDashboardState.activeTab)
  const [isLoading, setIsLoading] = useState(true)
  const [loaderExiting, setLoaderExiting] = useState(false)
  const [animationsReady, setAnimationsReady] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [apiStateReady, setApiStateReady] = useState(false)
  const [apiStatus, setApiStatus] = useState('Connecting to API')
  const [advisorLoading, setAdvisorLoading] = useState(false)
  const [advisorPrompt, setAdvisorPrompt] = useState('Where should I cut spending first?')
  const [advisorResponse, setAdvisorResponse] = useState(null)
  const [advisorPlanMode, setAdvisorPlanMode] = useState('balanced')
  const [marketLoading, setMarketLoading] = useState(false)
  const [marketSymbol, setMarketSymbol] = useState('AAPL')
  const [marketData, setMarketData] = useState(null)
  const [stockWatchlist, setStockWatchlist] = useState(initialDashboardState.stockWatchlist)
  const [stockLoading, setStockLoading] = useState(false)
  const [stockData, setStockData] = useState([])
  const [selectedStockSymbol, setSelectedStockSymbol] = useState(initialDashboardState.stockWatchlist[0])
  const [stockInput, setStockInput] = useState('')
  const [cashflowView, setCashflowView] = useState('all')
  const [barView, setBarView] = useState('absolute')
  const [goal, setGoal] = useState(initialDashboardState.goal)
  const [notifications, setNotifications] = useState(initialDashboardState.notifications)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    document.body.className = role === 'admin' ? 'role-admin' : 'role-viewer'
  }, [role])

  useEffect(() => {
    document.body.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    let ignore = false

    async function loadDashboardState() {
      try {
        const payload = await fetchDashboardState()
        if (ignore) return
        const hydrated = hydrateDashboardState(payload)
        setTransactions(hydrated.transactions)
        setBudgets(hydrated.budgets)
        setRole(hydrated.role)
        setTheme(hydrated.theme)
        setActiveTab(hydrated.activeTab)
        setGoal(hydrated.goal)
        setNotifications(hydrated.notifications)
        setStockWatchlist(hydrated.stockWatchlist)
        setSelectedStockSymbol(hydrated.stockWatchlist[0] ?? initialDashboardState.stockWatchlist[0])
        setApiStatus('Connected to API')
      } catch {
        if (ignore) return
        setApiStatus('API unavailable, using fallback data')
        setToast({ message: 'Could not reach the API. Showing fallback data.', tone: 'error' })
      } finally {
        if (!ignore) setApiStateReady(true)
      }
    }

    loadDashboardState()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!apiStateReady) return undefined
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        await saveDashboardState(
          serializeDashboardState({
            transactions,
            budgets,
            role,
            theme,
            activeTab,
            goal,
            notifications,
            stockWatchlist,
          }),
          controller.signal,
        )
        setApiStatus('Connected to API')
      } catch {
        if (controller.signal.aborted) return
        setApiStatus('Sync paused: API unavailable')
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [activeTab, apiStateReady, budgets, goal, notifications, role, stockWatchlist, theme, transactions])

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setLoaderExiting(true), 1400)
    const removeTimer = window.setTimeout(() => setIsLoading(false), 1840)
    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(removeTimer)
    }
  }, [])

  useEffect(() => {
    if (isLoading) return undefined
    let timer
    const frame = window.requestAnimationFrame(() => {
      timer = window.setTimeout(() => setAnimationsReady(true), 90)
    })
    return () => {
      window.cancelAnimationFrame(frame)
      if (timer) window.clearTimeout(timer)
    }
  }, [isLoading])

  useEffect(() => {
    let ignore = false
    const controller = new AbortController()

    setMarketLoading(true)
    fetchMarket(marketSymbol, controller.signal)
      .then((payload) => {
        if (!ignore) setMarketData(payload)
      })
      .catch(() => {
        if (!ignore) setMarketData(null)
      })
      .finally(() => {
        if (!ignore) setMarketLoading(false)
      })

    return () => {
      ignore = true
      controller.abort()
    }
  }, [marketSymbol])

  useEffect(() => {
    if (activeTab !== 'stocks') return undefined
    if (!stockWatchlist.length) {
      setStockData([])
      return undefined
    }

    let ignore = false
    const controller = new AbortController()
    setStockLoading(true)
    fetchStocks(stockWatchlist, controller.signal)
      .then((payload) => {
        if (!ignore) setStockData(payload.stocks ?? [])
      })
      .catch((error) => {
        if (!ignore) {
          setStockData([])
          addToast(error.message || 'Stock monitor could not load live quotes.', 'error')
        }
      })
      .finally(() => {
        if (!ignore) setStockLoading(false)
      })

    return () => {
      ignore = true
      controller.abort()
    }
  }, [activeTab, stockWatchlist])

  useEffect(() => {
    if (!stockWatchlist.length) return
    if (!stockWatchlist.includes(selectedStockSymbol)) {
      setSelectedStockSymbol(stockWatchlist[0])
    }
  }, [selectedStockSymbol, stockWatchlist])

  useEffect(() => {
    if (!apiStateReady) return
    if (activeTab !== 'advisor') return
    let ignore = false
    setAdvisorLoading(true)
    fetchAdvisor({ question: advisorPrompt })
      .then((payload) => {
        if (!ignore) setAdvisorResponse(payload)
      })
      .catch(() => {
        if (!ignore) {
          setAdvisorResponse({
            source: 'error',
            overview: 'Advisor could not be reached right now.',
            budgetSuggestion: 'Try again after the API is available.',
            cutSuggestion: 'No live recommendation available.',
            goalSuggestion: 'No goal guidance available right now.',
            actions: ['Retry the advisor request.', 'Check backend availability.', 'Verify your Gemini API key if needed.'],
            answer: 'Advisor unavailable.',
          })
        }
      })
      .finally(() => {
        if (!ignore) setAdvisorLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [activeTab, advisorPrompt, apiStateReady])

  const stats = useMemo(() => {
    const income = transactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
    const expenses = transactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
    const balance = income - expenses
    const savingsRate = income ? Math.round((balance / income) * 100) : 0
    return { income, expenses, balance, savingsRate }
  }, [transactions])

  const monthlySeries = useMemo(() => {
    const bucket = {}
    transactions.forEach((item) => {
      const key = item.date.slice(0, 7)
      if (!bucket[key]) bucket[key] = { income: 0, expenses: 0 }
      bucket[key][item.type === 'income' ? 'income' : 'expenses'] += item.amount
    })
    return Object.entries(bucket)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, value]) => ({ key, label: monthLabel(`${key}-01`), ...value }))
  }, [transactions])

  const expenseBreakdown = useMemo(() => {
    const grouped = {}
    transactions
      .filter((item) => item.type === 'expense')
      .forEach((item) => {
        grouped[item.category] = (grouped[item.category] ?? 0) + item.amount
      })
    const entries = Object.entries(grouped)
      .map(([category, amount]) => ({ category, amount, ...categoryMeta[category] }))
      .sort((a, b) => b.amount - a.amount)
    const total = entries.reduce((sum, item) => sum + item.amount, 0)
    return { items: entries.slice(0, 6), total }
  }, [transactions])

  const budgetInsights = useMemo(() => {
    return budgets.map((budget) => {
      const spent = transactions
        .filter((item) => item.type === 'expense' && item.category === budget.category)
        .reduce((sum, item) => sum + item.amount, 0)
      const progress = budget.limit ? Math.round((spent / budget.limit) * 100) : 0
      return {
        ...budget,
        spent,
        remaining: budget.limit - spent,
        progress,
      }
    })
  }, [budgets, transactions])

  const topBudgetRisk = budgetInsights
    .filter((item) => item.progress >= 80)
    .sort((a, b) => b.progress - a.progress)[0]

  const topExpenseCategory = expenseBreakdown.items[0]
  const savingsGoalProgress = goal > 0 ? Math.max(0, Math.min(100, Math.round((stats.balance / goal) * 100))) : 0
  const currentMonth = monthlySeries[monthlySeries.length - 1]
  const focusScore = Math.max(0, Math.min(100, Math.round((stats.savingsRate + (topBudgetRisk ? 100 - topBudgetRisk.progress : 88)) / 2)))
  const unreadCount = notifications.filter((item) => !item.read).length

  const addToast = (message, tone = 'success') => setToast({ message, tone })
  const pushNotification = (title, body, kind = 'info') =>
    setNotifications((current) => [{ id: Date.now(), title, body, kind, read: false }, ...current].slice(0, 8))

  const updateBudget = (category, value) => {
    setBudgets((current) =>
      current.map((item) => (item.category === category ? { ...item, limit: Number(value) || 0 } : item)),
    )
  }

  const pageTitle = navItems.find((item) => item.id === activeTab)?.label ?? 'Overview'
  const selectedStock = useMemo(
    () => stockData.find((item) => item.symbol === selectedStockSymbol) ?? stockData[0] ?? null,
    [selectedStockSymbol, stockData],
  )
  const stockSummary = useMemo(() => {
    if (!stockData.length) return { advancers: 0, decliners: 0, averageMove: 0 }
    return {
      advancers: stockData.filter((item) => item.change > 0).length,
      decliners: stockData.filter((item) => item.change < 0).length,
      averageMove: stockData.reduce((sum, item) => sum + item.percentChange, 0) / stockData.length,
    }
  }, [stockData])
  const toggleTheme = () => {
    setTheme((current) => (current === 'pastel' ? 'midnight' : 'pastel'))
    pushNotification('Theme updated', `Dashboard theme switched to ${theme === 'pastel' ? 'midnight' : 'pastel'} mode.`, 'info')
  }
  const markAllRead = () => setNotifications((current) => current.map((item) => ({ ...item, read: true })))
  const markNotificationRead = (id) =>
    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)))
  const requestAdvisor = async (promptOverride) => {
    const nextPrompt = promptOverride ?? advisorPrompt
    if (promptOverride) setAdvisorPrompt(promptOverride)
    setAdvisorLoading(true)
    try {
      const payload = await fetchAdvisor({ question: nextPrompt })
      setAdvisorResponse(payload)
      addToast('AI advisor updated.')
    } catch (error) {
      addToast(error.message || 'Advisor request failed.', 'error')
    } finally {
      setAdvisorLoading(false)
    }
  }
  const addStockSymbol = () => {
    const symbol = stockInput.trim().toUpperCase().replace(/[^A-Z.]/g, '')
    if (!symbol) return
    if (stockWatchlist.includes(symbol)) {
      setSelectedStockSymbol(symbol)
      setStockInput('')
      addToast('Symbol already exists in your watchlist.')
      return
    }
    const next = [...stockWatchlist, symbol].slice(-10)
    setStockWatchlist(next)
    setSelectedStockSymbol(symbol)
    setStockInput('')
    addToast(`${symbol} added to stock monitor.`)
  }
  const removeStockSymbol = (symbol) => {
    setStockWatchlist((current) => current.filter((item) => item !== symbol))
    addToast(`${symbol} removed from stock monitor.`)
  }

  return (
    <div className={`app-shell ${animationsReady ? 'motion-ready' : 'motion-hold'}`}>
      <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
        <Icon path={<><line x1="3" y1="7" x2="21" y2="7" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="17" x2="21" y2="17" /></>} />
      </button>
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="logo">
          <div className="logo-mark" aria-hidden="true">
            <svg viewBox="0 0 64 64" className="logo-mark-svg">
              <defs>
                <linearGradient id="lunexMarkGlow" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
                  <stop offset="100%" stopColor="#d8d1ff" stopOpacity="0.92" />
                </linearGradient>
              </defs>
              <path d="M14 44 L24 34 L32 38 L47 21" className="logo-line-back" />
              <path d="M14 44 L24 34 L32 38 L47 21" className="logo-line-front" />
              <path d="M42 21 H50 V29" className="logo-arrow" />
              <circle cx="14" cy="44" r="3" className="logo-node" />
              <circle cx="24" cy="34" r="3" className="logo-node" />
              <circle cx="32" cy="38" r="3" className="logo-node" />
              <circle cx="47" cy="21" r="3.4" className="logo-node accent" />
            </svg>
          </div>
          <div className="logo-copy">
            <div className="logo-text" aria-label="Lunex">
              <span className="logo-letter-main">L</span>
              <span className="logo-letter-trail">unex</span>
            </div>
            <p className="logo-sub">Finance workspace</p>
          </div>
        </div>

        <div className="nav-section-label">Workspace</div>
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(item.id)
              setSidebarOpen(false)
            }}
          >
            <span>{item.label}</span>
          </button>
        ))}

        <div className="role-switcher clay">
          <div className="role-label">Active Role</div>
          <select value={role} className="role-select" onChange={(event) => setRole(event.target.value)}>
            <option value="admin">Administrator</option>
            <option value="viewer">Viewer</option>
          </select>
          <div className={`role-pill ${role}`}>{role === 'admin' ? 'Full controls' : 'Read only mode'}</div>
          <button className="theme-switch" onClick={toggleTheme}>
            <span>{theme === 'pastel' ? 'Switch to midnight' : 'Switch to pastel'}</span>
            <strong>{theme === 'pastel' ? '🌙' : '☀️'}</strong>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar animate">
          <div>
            <p className="eyebrow">Lunex workspace</p>
            <h1 className="page-title">{pageTitle}</h1>
          </div>
          <div className="topbar-right">
            <div className="api-chip">{apiStatus}</div>
            <button className="notification-trigger" onClick={() => setNotificationsOpen((current) => !current)} aria-label="Open notifications">
              <span>Alerts</span>
              {unreadCount ? <strong>{unreadCount}</strong> : null}
            </button>
            <div className="date-chip">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
            <div className="avatar">LX</div>
          </div>
        </header>

        {notificationsOpen ? (
          <section className="notification-panel animate">
            <div className="notification-head">
              <div>
                <div className="chart-title">Notifications</div>
                <div className="chart-sub">{unreadCount ? `${unreadCount} unread updates` : 'Everything is caught up'}</div>
              </div>
              <button className="btn btn-ghost" onClick={markAllRead}>Mark all read</button>
            </div>
            <div className="notification-list">
              {notifications.map((item) => (
                <button key={item.id} className={`notification-item ${item.read ? 'read' : 'unread'} ${item.kind}`} onClick={() => markNotificationRead(item.id)}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </div>
                  {!item.read ? <span className="notification-dot" /> : null}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === 'overview' ? (
          <>
            <section className="hero-panel clay animate">
              <div className="hero-copy">
                <p className="eyebrow">Design polished finance workspace</p>
                <h2 className="hero-title">A softer, sharper command center for your everyday money decisions.</h2>
                <p className="hero-body">
                  Track cashflow, spot pressure points, and keep your savings momentum visible without losing the playful clay feel of the original concept.
                </p>
                <div className="hero-tags">
                  <span className="hero-tag">Balance {formatCompactMoney(stats.balance)}</span>
                  <span className="hero-tag">Top spend {topExpenseCategory?.category ?? 'None yet'}</span>
                  <span className="hero-tag">This month {currentMonth ? formatCompactMoney(currentMonth.expenses) : '$0'}</span>
                </div>
              </div>
              <div className="hero-score">
                <div className="hero-score-ring">
                  <span>{focusScore}</span>
                </div>
                <div className="hero-score-copy">
                  <strong>Focus score</strong>
                  <p>
                    {topBudgetRisk
                      ? `${topBudgetRisk.category} needs attention, but your savings trend is still holding up.`
                      : 'Spending is steady and your plan looks comfortably in control.'}
                  </p>
                </div>
              </div>
            </section>
            <section className="micro-actions animate">
              <button className="micro-pill" onClick={() => setActiveTab('budgets')}>Tune Budgets</button>
              <button className="micro-pill" onClick={() => setActiveTab('insights')}>View Insights</button>
            </section>
            <section className="cards-grid">
              {statCards.map((card, index) => (
                <article key={card.key} className={`sum-card c-${card.tone} animate d${index + 1}`}>
                  <div className="card-icon">{card.icon}</div>
                  <div className="card-label">{card.label}</div>
                  <div className="card-value">{card.key === 'savingsRate' ? `${stats.savingsRate}%` : formatMoney(stats[card.key])}</div>
                  <div className="card-delta">{card.key === 'expenses' ? 'Live spend tracking' : 'Synced with your ledger'}</div>
                </article>
              ))}
            </section>

            <section className="overview-grid">
              <article className="chart-card clay animate d1 overview-wide">
                <SectionHeader
                  title="Cashflow Trend"
                  subtitle="Rolling six-month view"
                  actions={(
                    <div className="chart-toggle">
                      <button className={`chart-pill ${cashflowView === 'all' ? 'active' : ''}`} onClick={() => setCashflowView('all')}>All</button>
                      <button className={`chart-pill ${cashflowView === 'income' ? 'active' : ''}`} onClick={() => setCashflowView('income')}>Income</button>
                      <button className={`chart-pill ${cashflowView === 'expenses' ? 'active' : ''}`} onClick={() => setCashflowView('expenses')}>Expenses</button>
                    </div>
                  )}
                />
                <LineChart data={monthlySeries} mode={cashflowView} />
              </article>

              <article className="chart-card clay animate d2 overview-wide">
                <SectionHeader title="Spending Breakdown" subtitle="Live category mix that updates with every transaction change" />
                <DonutChart data={expenseBreakdown} />
              </article>

              <article className="chart-card clay animate d3 focus-card overview-wide">
                <SectionHeader title="Savings Goal" subtitle="Track against your target" />
                <div className="goal-ring">
                  <div className="goal-ring-value">{savingsGoalProgress}%</div>
                  <div className="goal-ring-track">
                    <div className="goal-ring-fill" style={{ width: `${savingsGoalProgress}%` }} />
                  </div>
                </div>
                <div className="metric-row">
                  <div>
                    <div className="metric-label">Goal Target</div>
                    <div className="metric-value">{formatMoney(goal)}</div>
                  </div>
                  <input
                    className="goal-input"
                    type="number"
                    min="0"
                    step="100"
                    value={goal}
                    onChange={(event) => setGoal(Number(event.target.value) || 0)}
                  />
                </div>
                <p className="support-copy">
                  {stats.balance >= goal
                    ? 'You are already above the active savings goal. Nice work.'
                    : `${formatMoney(goal - stats.balance)} left to hit this milestone.`}
                </p>
              </article>

              <article className="chart-card clay animate d4 overview-wide">
                <SectionHeader
                  title="Market Pulse"
                  subtitle="Live quote and daily trend powered by Twelve Data"
                  actions={(
                    <div className="chart-toggle">
                      {['AAPL', 'MSFT', 'TSLA', 'BTC/USD'].map((symbol) => (
                        <button
                          key={symbol}
                          className={`chart-pill ${marketSymbol === symbol ? 'active' : ''}`}
                          onClick={() => setMarketSymbol(symbol)}
                        >
                          {symbol}
                        </button>
                      ))}
                    </div>
                  )}
                />
                <MarketPulseCard data={marketData} loading={marketLoading} />
              </article>
            </section>
          </>
        ) : null}

        {activeTab === 'stocks' ? (
          <section className="section-stack">
            <article className="chart-card clay animate d1">
              <SectionHeader title="Stock Monitor" subtitle="Simple live watchlist powered by Finnhub" />
              <div className="stock-topbar">
                <div className="stock-input-wrap">
                  <input
                    className="search-input"
                    value={stockInput}
                    onChange={(event) => setStockInput(event.target.value)}
                    onKeyDown={(event) => (event.key === 'Enter' ? addStockSymbol() : null)}
                    placeholder="Add symbol like AMZN"
                  />
                  <button className="btn btn-primary" onClick={addStockSymbol}>Add Symbol</button>
                </div>
                <div className="stock-toolbar-actions">
                  <span className="hero-tag">Finnhub Live</span>
                  <button className="btn btn-ghost" onClick={() => setStockWatchlist((current) => [...current])} disabled={stockLoading}>
                    {stockLoading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
              </div>
            </article>

            <div className="insights-grid animate d2">
              <article className="insight-card c-indigo">
                <div className="insight-tag">Watchlist</div>
                <div className="insight-headline">{stockWatchlist.length} symbols</div>
                <p className="insight-body">A clean watchlist for keeping live tabs on your selected names.</p>
              </article>
              <article className="insight-card c-mint">
                <div className="insight-tag">Advancers</div>
                <div className="insight-headline">{stockSummary.advancers}</div>
                <p className="insight-body">Names trading above the previous close inside the current snapshot.</p>
              </article>
              <article className="insight-card c-rose">
                <div className="insight-tag">Decliners</div>
                <div className="insight-headline">{stockSummary.decliners}</div>
                <p className="insight-body">Names currently below the previous close and worth reviewing.</p>
              </article>
              <article className="insight-card c-sun">
                <div className="insight-tag">Average Move</div>
                <div className="insight-headline">{formatSignedPercent(stockSummary.averageMove)}</div>
                <p className="insight-body">A quick read on how the overall watchlist is leaning right now.</p>
              </article>
            </div>

            <div className="stock-layout">
              <article className="chart-card clay animate d3">
                <SectionHeader title="Watchlist" subtitle="Select a symbol to inspect its live quote snapshot" />
                <div className="stock-watchlist">
                  {stockLoading ? <div className="empty-chart">Loading live stock quotes...</div> : null}
                  {!stockLoading && !stockData.length ? <div className="empty-chart">No stock data is available right now.</div> : null}
                  {stockData.map((item) => (
                    <div
                      key={item.symbol}
                      className={`stock-card ${selectedStockSymbol === item.symbol ? 'active' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedStockSymbol(item.symbol)}
                      onKeyDown={(event) => ((event.key === 'Enter' || event.key === ' ') ? setSelectedStockSymbol(item.symbol) : null)}
                    >
                      <div className="stock-card-head">
                        <div>
                          <strong>{item.symbol}</strong>
                          <span>{item.name}</span>
                        </div>
                        <button
                          className="stock-remove"
                          onClick={(event) => {
                            event.stopPropagation()
                            removeStockSymbol(item.symbol)
                          }}
                          aria-label={`Remove ${item.symbol}`}
                        >
                          ×
                        </button>
                      </div>
                      <div className="stock-card-price">{formatStockPrice(item.price, item.currency)}</div>
                      <div className={`stock-card-change ${item.change >= 0 ? 'positive' : 'negative'}`}>
                        {formatSignedMoney(item.change, item.currency)} • {formatSignedPercent(item.percentChange)}
                      </div>
                      <div className="stock-card-meta">
                        <span>{item.exchange}</span>
                        <span>{item.industry}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="chart-card clay animate d4">
                <SectionHeader title={selectedStock ? `${selectedStock.symbol} Snapshot` : 'Stock Snapshot'} subtitle="Live quote details with a clean intraday range monitor" />
                <StockDetailPanel item={selectedStock} />
              </article>
            </div>
          </section>
        ) : null}

        {activeTab === 'budgets' ? (
          <section className="section-stack">
            <div className="budget-grid">
              {budgetInsights.map((item, index) => (
                <article key={item.category} className={`budget-card clay animate d${(index % 4) + 1}`}>
                  <div className="budget-topline">
                    <div className="budget-chip" style={{ background: categoryMeta[item.category]?.bg, color: categoryMeta[item.category]?.color }}>
                      {categoryMeta[item.category]?.icon} {item.category}
                    </div>
                    <strong>{item.progress}%</strong>
                  </div>
                  <div className="budget-values">
                    <span>{formatMoney(item.spent)} spent</span>
                    <span>{formatMoney(item.limit)} cap</span>
                  </div>
                  <div className="goal-ring-track slim">
                    <div className={`goal-ring-fill ${item.progress > 100 ? 'danger' : ''}`} style={{ width: `${Math.min(item.progress, 100)}%` }} />
                  </div>
                  <label className="budget-field">
                    <span>Adjust limit</span>
                    <input
                      type="range"
                      min="0"
                      max="3000"
                      step="20"
                      value={item.limit}
                      onChange={(event) => updateBudget(item.category, event.target.value)}
                    />
                    <input
                      className="goal-input"
                      type="number"
                      value={item.limit}
                      onChange={(event) => updateBudget(item.category, event.target.value)}
                    />
                  </label>
                  <p className="support-copy">
                    {item.remaining >= 0
                      ? `${formatMoney(item.remaining)} remaining before the budget is fully used.`
                      : `${formatMoney(Math.abs(item.remaining))} over the budget. Time to tighten this category.`}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === 'insights' ? (
          <section className="section-stack">
            <div className="insights-grid animate">
              <article className="insight-card c-indigo">
                <div className="insight-tag">Top Category</div>
                <div className="insight-headline">{topExpenseCategory?.category ?? 'No data yet'}</div>
                <p className="insight-body">
                  {topExpenseCategory
                    ? `${formatMoney(topExpenseCategory.amount)} spent here, making it your largest expense bucket.`
                    : 'Add some transactions to generate category insights.'}
                </p>
              </article>
              <article className="insight-card c-rose">
                <div className="insight-tag">Budget Risk</div>
                <div className="insight-headline">{topBudgetRisk?.category ?? 'Looking healthy'}</div>
                <p className="insight-body">
                  {topBudgetRisk
                    ? `${topBudgetRisk.progress}% of the budget is already consumed in ${topBudgetRisk.category}.`
                    : 'No category is near its limit right now. Your plan is comfortably within range.'}
                </p>
              </article>
              <article className="insight-card c-mint">
                <div className="insight-tag">Momentum</div>
                <div className="insight-headline">{stats.savingsRate}% savings rate</div>
                <p className="insight-body">
                  {stats.savingsRate >= 20
                    ? 'You are above a strong benchmark for personal savings and can safely stretch to new goals.'
                    : 'Trim non-essential spend and channel extra income into the savings target to raise your cushion.'}
                </p>
              </article>
            </div>

            <article className="chart-card clay animate d2">
              <SectionHeader
                title="Income vs Expenses"
                subtitle="Monthly performance comparison"
                actions={(
                  <div className="chart-toggle">
                    <button className={`chart-pill ${barView === 'absolute' ? 'active' : ''}`} onClick={() => setBarView('absolute')}>Gross</button>
                    <button className={`chart-pill ${barView === 'net' ? 'active' : ''}`} onClick={() => setBarView('net')}>Net</button>
                  </div>
                )}
              />
              <BarChart data={monthlySeries} mode={barView} />
            </article>
          </section>
        ) : null}

        {activeTab === 'advisor' ? (
          <section className="section-stack">
            <article className="chart-card clay animate d1 advisor-hero">
              <SectionHeader title="AI Advisor" subtitle="Budget guidance, savings ideas, and spending reduction suggestions" />
              <div className="advisor-input-row">
                <input
                  className="search-input"
                  value={advisorPrompt}
                  onChange={(event) => setAdvisorPrompt(event.target.value)}
                  placeholder="Ask something like: How can I save $500 next month?"
                />
                <button className="btn btn-primary" onClick={requestAdvisor} disabled={advisorLoading}>
                  {advisorLoading ? 'Thinking...' : 'Ask Advisor'}
                </button>
              </div>
              <div className="advisor-meta">
                <span className="hero-tag">Source {advisorResponse?.source === 'gemini' ? 'Gemini' : 'Local fallback'}</span>
                <span className="hero-tag">Model {advisorResponse?.model ?? 'Not configured'}</span>
              </div>
              <div className="advisor-followups">
                {(advisorResponse?.followUps ?? []).map((item) => (
                  <button key={item} className="chart-pill" onClick={() => requestAdvisor(item)}>{item}</button>
                ))}
              </div>
            </article>

            <div className="insights-grid animate d2">
              <article className="insight-card c-indigo">
                <div className="insight-tag">Overview</div>
                <div className="insight-headline">Financial summary</div>
                <p className="insight-body">{advisorResponse?.overview ?? 'Open the advisor to generate a summary.'}</p>
              </article>
              <article className="insight-card c-rose">
                <div className="insight-tag">Cut Suggestion</div>
                <div className="insight-headline">Best place to trim</div>
                <p className="insight-body">{advisorResponse?.cutSuggestion ?? 'No suggestion yet.'}</p>
              </article>
              <article className="insight-card c-mint">
                <div className="insight-tag">Budget Goal</div>
                <div className="insight-headline">Suggested target</div>
                <p className="insight-body">{advisorResponse?.budgetSuggestion ?? 'No budget recommendation yet.'}</p>
              </article>
            </div>

            <article className="chart-card clay animate d3">
              <SectionHeader title="Advisor Response" subtitle="Actionable suggestions based on your current dashboard data" />
              <p className="advisor-answer">{advisorResponse?.answer ?? 'No advisor answer yet.'}</p>
              <div className="advisor-grid">
                <div className="advisor-panel">
                  <div className="donut-summary-label">Goal Guidance</div>
                  <p>{advisorResponse?.goalSuggestion ?? 'No goal guidance yet.'}</p>
                </div>
                <div className="advisor-panel">
                  <div className="donut-summary-label">Suggested Actions</div>
                  <div className="advisor-actions">
                    {(advisorResponse?.actions ?? []).map((item) => (
                      <div key={item} className="advisor-action-item">{item}</div>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <article className="chart-card clay animate d4">
              <SectionHeader
                title="AI Budget Plans"
                subtitle="Three levels of AI-generated budget tightening"
                actions={(
                  <div className="chart-toggle">
                    <button className={`chart-pill ${advisorPlanMode === 'conservative' ? 'active' : ''}`} onClick={() => setAdvisorPlanMode('conservative')}>Conservative</button>
                    <button className={`chart-pill ${advisorPlanMode === 'balanced' ? 'active' : ''}`} onClick={() => setAdvisorPlanMode('balanced')}>Balanced</button>
                    <button className={`chart-pill ${advisorPlanMode === 'aggressive' ? 'active' : ''}`} onClick={() => setAdvisorPlanMode('aggressive')}>Aggressive</button>
                  </div>
                )}
              />
              <div className="advisor-plan-grid">
                {((advisorResponse?.budgetPlans?.[advisorPlanMode]) ?? []).map((item) => (
                  <div key={`${advisorPlanMode}-${item.category}`} className="advisor-plan-card">
                    <div className="donut-summary-label">{item.category}</div>
                    <strong>{formatMoney(item.target)}</strong>
                    <p>{item.reason}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="chart-card clay animate d4">
              <SectionHeader title="Monthly AI Report" subtitle="A compact machine-generated read on this month" />
              <div className="advisor-report-grid">
                <div className="advisor-report-card">
                  <div className="donut-summary-label">Headline</div>
                  <strong>{advisorResponse?.monthlyReport?.headline ?? 'No report yet.'}</strong>
                </div>
                <div className="advisor-report-card">
                  <div className="donut-summary-label">Summary</div>
                  <p>{advisorResponse?.monthlyReport?.summary ?? 'No summary available.'}</p>
                </div>
                <div className="advisor-report-card">
                  <div className="donut-summary-label">Trend</div>
                  <p>{advisorResponse?.monthlyReport?.trend ?? 'No trend available.'}</p>
                </div>
                <div className="advisor-report-card">
                  <div className="donut-summary-label">Watchlist</div>
                  <p>{advisorResponse?.monthlyReport?.watchlist ?? 'No watchlist available.'}</p>
                </div>
              </div>
            </article>
          </section>
        ) : null}
      </main>

      {toast ? <div className={`toast ${toast.tone === 'error' ? 'error' : ''}`}>{toast.message}</div> : null}
      {isLoading ? <LoadingScreen exiting={loaderExiting} /> : null}
    </div>
  )
}

function LoadingScreen({ exiting }) {
  return (
    <div className={`loading-screen ${exiting ? 'is-exiting' : ''}`}>
      <div className="loading-card">
        <div className="loading-logo">LX</div>
        <p className="eyebrow">Preparing workspace</p>
        <h2>Loading Lunex</h2>
        <div className="loading-bar">
          <div className="loading-bar-fill" />
        </div>
        <div className="loading-dots">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ title, subtitle, actions }) {
  return (
    <div className="chart-header">
      <div>
        <div className="chart-title">{title}</div>
        <div className="chart-sub">{subtitle}</div>
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  )
}

function LineChart({ data, mode }) {
  if (!data.length) return <div className="empty-chart">Add more activity to plot your trend.</div>
  const [hovered, setHovered] = useState(null)

  const width = 640
  const height = 220
  const padding = { top: 18, right: 20, bottom: 26, left: 68 }
  const values = data.flatMap((item) => [item.income, item.expenses])
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const step = chartWidth / Math.max(data.length - 1, 1)
  const range = Math.max(max - min, 1)
  const mapY = (value) => height - padding.bottom - ((value - min) / range) * chartHeight
  const latest = data[data.length - 1]
  const previous = data[data.length - 2]
  const incomeDelta = latest && previous ? latest.income - previous.income : 0
  const expenseDelta = latest && previous ? latest.expenses - previous.expenses : 0
  const netFlow = latest ? latest.income - latest.expenses : 0
  const high = latest ? Math.max(latest.income, latest.expenses) : 0
  const low = latest ? Math.min(latest.income, latest.expenses) : 0
  const tickValues = [max, max - range * 0.25, max - range * 0.5, max - range * 0.75, min]

  const buildPath = (key) =>
    data
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${padding.left + index * step} ${mapY(point[key])}`)
      .join(' ')

  const buildAreaPath = (key) => {
    const line = data
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${padding.left + index * step} ${mapY(point[key])}`)
      .join(' ')
    return `${line} L ${padding.left + (data.length - 1) * step} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`
  }

  return (
    <div className="chart-module trading-chart">
      <div className="chart-metrics trading-metrics">
        <div className="chart-stat income premium">
          <span>Income line</span>
          <strong>{latest ? formatMoney(latest.income) : '$0'}</strong>
          <small>{incomeDelta >= 0 ? 'Up' : 'Down'} {formatMoney(Math.abs(incomeDelta))} vs previous month</small>
        </div>
        <div className="chart-stat expenses premium">
          <span>Expense line</span>
          <strong>{latest ? formatMoney(latest.expenses) : '$0'}</strong>
          <small>{expenseDelta >= 0 ? 'Up' : 'Down'} {formatMoney(Math.abs(expenseDelta))} vs previous month</small>
        </div>
        <div className="chart-stat net premium">
          <span>Net flow</span>
          <strong>{formatMoney(netFlow)}</strong>
          <small>{netFlow >= 0 ? 'Positive spread between income and expense' : 'Expenses are outpacing inflow'}</small>
        </div>
      </div>
      <div className="trade-strip">
        <div className="trade-chip">
          <span>Last</span>
          <strong>{latest?.label ?? '—'}</strong>
        </div>
        <div className="trade-chip">
          <span>High</span>
          <strong>{formatMoney(high)}</strong>
        </div>
        <div className="trade-chip">
          <span>Low</span>
          <strong>{formatMoney(low)}</strong>
        </div>
        <div className="trade-chip">
          <span>Spread</span>
          <strong>{formatMoney(Math.abs(incomeDelta - expenseDelta))}</strong>
        </div>
      </div>
      <div className="chart-frame">
        <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Income and expenses line chart">
          <defs>
            <linearGradient id="incomeArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f9f8a" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#2f9f8a" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="expenseArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8d5f78" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#8d5f78" stopOpacity="0" />
            </linearGradient>
          </defs>
          {tickValues.map((tick) => {
            const y = mapY(tick)
            return (
              <g key={tick}>
                <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="grid-line premium" />
                <text x={padding.left - 10} y={y + 4} textAnchor="end" className="value-tick">
                  {formatMoney(tick)}
                </text>
              </g>
            )
          })}
          {(mode === 'all' || mode === 'expenses') ? <path d={buildAreaPath('expenses')} className="area expenses" /> : null}
          {(mode === 'all' || mode === 'income') ? <path d={buildAreaPath('income')} className="area income" /> : null}
          {(mode === 'all' || mode === 'expenses') ? <path d={buildPath('expenses')} className="line expenses premium" /> : null}
          {(mode === 'all' || mode === 'income') ? <path d={buildPath('income')} className="line income premium" /> : null}
          {data.map((point, index) => (
            <g key={point.key}>
              {(mode === 'all' || mode === 'income') ? (
                <circle
                  cx={padding.left + index * step}
                  cy={mapY(point.income)}
                  r="4"
                  className={`dot income ${hovered?.key === point.key && hovered?.series === 'income' ? 'is-active' : ''}`}
                  onMouseEnter={() => setHovered({ key: point.key, series: 'income', label: point.label, value: point.income, x: padding.left + index * step, y: mapY(point.income) })}
                  onMouseLeave={() => setHovered(null)}
                />
              ) : null}
              {(mode === 'all' || mode === 'expenses') ? (
                <circle
                  cx={padding.left + index * step}
                  cy={mapY(point.expenses)}
                  r="4"
                  className={`dot expenses ${hovered?.key === point.key && hovered?.series === 'expenses' ? 'is-active' : ''}`}
                  onMouseEnter={() => setHovered({ key: point.key, series: 'expenses', label: point.label, value: point.expenses, x: padding.left + index * step, y: mapY(point.expenses) })}
                  onMouseLeave={() => setHovered(null)}
                />
              ) : null}
              <text x={padding.left + index * step} y={height - 6} textAnchor="middle" className="axis-label premium">{point.label}</text>
            </g>
          ))}
          {hovered ? (
            <g>
              <line x1={hovered.x} x2={hovered.x} y1={padding.top} y2={height - padding.bottom} className="hover-guide premium" />
              <line x1={padding.left} x2={width - padding.right} y1={hovered.y} y2={hovered.y} className="hover-guide premium horizontal" />
            </g>
          ) : null}
        </svg>
        {hovered ? (
          <div
            className={`chart-tooltip ${hovered.series}`}
            style={{ left: `${(hovered.x / width) * 100}%`, top: `${Math.max(8, (hovered.y / height) * 100 - 8)}%` }}
          >
            <strong>{hovered.label}</strong>
            <span>{hovered.series === 'income' ? 'Income' : 'Expenses'} {formatMoney(hovered.value)}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function DonutChart({ data }) {
  if (!data.items.length) return <div className="empty-chart">No expense data available yet.</div>
  const [isVisible, setIsVisible] = useState(false)
  const wrapRef = useRef(null)
  const radius = 64
  const circumference = 2 * Math.PI * radius
  let offset = 0
  const lead = data.items[0]
  const premiumPalette = {
    Housing: '#6f63c7',
    Food: '#2f9f8a',
    Transport: '#c58a3f',
    Entertainment: '#c46b8f',
    Health: '#4a8fbe',
    Utilities: '#7b73d1',
    Shopping: '#b67843',
    Salary: '#2f9f8a',
    Freelance: '#4a8fbe',
    Other: '#7e879d',
  }

  useEffect(() => {
    const node = wrapRef.current
    if (!node) return undefined

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.35 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={wrapRef} className={`donut-layout ${isVisible ? 'is-visible' : ''}`}>
      <div className="donut-visual">
        <svg className="donut-svg" viewBox="0 0 180 180">
          <circle cx="90" cy="90" r={radius} className="donut-base" />
          {data.items.map((item) => {
            const tone = premiumPalette[item.category] ?? item.color
            const length = (item.amount / data.total) * circumference
            const strokeDasharray = `${length} ${circumference - length}`
            const currentOffset = offset
            const percent = Math.round((item.amount / data.total) * 100)
            offset += length
            return (
              <circle
                key={item.category}
                cx="90"
                cy="90"
                r={radius}
                stroke={tone}
                strokeWidth="22"
                fill="none"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={-currentOffset}
                style={{
                  '--segment-length': length,
                  '--segment-gap': circumference - length,
                  '--segment-offset': -currentOffset,
                }}
                transform="rotate(-90 90 90)"
                strokeLinecap="round"
                className="donut-segment"
                aria-label={`${item.category} ${percent}%`}
              />
            )
          })}
        </svg>
        <div className="donut-center">
          <strong>{formatCompactMoney(data.total)}</strong>
          <span>Total spend</span>
        </div>
      </div>
      <div className="donut-details">
        <div className="donut-summary">
          <span className="donut-summary-label">Largest category</span>
          <strong>{lead.category}</strong>
          <p>
            {Math.round((lead.amount / data.total) * 100)}% of spend at {formatMoney(lead.amount)}.
          </p>
        </div>
        <div className="donut-legend">
          {data.items.map((item) => (
            <div key={item.category} className="donut-legend-item">
              <div className="donut-legend-copy">
                <div className="donut-legend-left">
                  <span className="legend-dot" style={{ background: premiumPalette[item.category] ?? item.color }} />
                  <span>{item.category}</span>
                </div>
                <strong>{Math.round((item.amount / data.total) * 100)}%</strong>
              </div>
              <div className="donut-track">
                <div
                  className="donut-track-fill"
                  style={{
                    width: `${Math.round((item.amount / data.total) * 100)}%`,
                    background: `linear-gradient(90deg, ${premiumPalette[item.category] ?? item.color}, color-mix(in srgb, ${premiumPalette[item.category] ?? item.color} 72%, white))`,
                  }}
                />
              </div>
              <span className="donut-value">{formatMoney(item.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function BarChart({ data, mode }) {
  if (!data.length) return <div className="empty-chart">Not enough data to compare months yet.</div>
  const [hovered, setHovered] = useState(null)

  const max = mode === 'net'
    ? Math.max(...data.map((item) => Math.abs(item.income - item.expenses)), 1)
    : Math.max(...data.flatMap((item) => [item.income, item.expenses]), 1)

  return (
    <div className="chart-module">
      <div className="chart-metrics compact">
        {data.map((item) => (
          <div key={item.key} className="mini-stat">
            <span>{item.label}</span>
            <strong>{mode === 'net' ? formatMoney(item.income - item.expenses) : formatMoney(item.income + item.expenses)}</strong>
          </div>
        ))}
      </div>
      <div className="bar-chart">
        {data.map((item) => (
          <div key={item.key} className="bar-group">
            <div className="bar-stack">
              {mode === 'absolute' ? (
                <>
                  <div
                    className={`bar income ${hovered?.key === item.key && hovered?.series === 'income' ? 'is-active' : ''}`}
                    style={{ height: `${(item.income / max) * 180}px` }}
                    onMouseEnter={() => setHovered({ key: item.key, series: 'income', label: item.label, value: item.income })}
                    onMouseLeave={() => setHovered(null)}
                  />
                  <div
                    className={`bar expenses ${hovered?.key === item.key && hovered?.series === 'expenses' ? 'is-active' : ''}`}
                    style={{ height: `${(item.expenses / max) * 180}px` }}
                    onMouseEnter={() => setHovered({ key: item.key, series: 'expenses', label: item.label, value: item.expenses })}
                    onMouseLeave={() => setHovered(null)}
                  />
                </>
              ) : (
                <div
                  className={`bar net ${hovered?.key === item.key ? 'is-active' : ''}`}
                  style={{ height: `${(Math.abs(item.income - item.expenses) / max) * 180}px` }}
                  onMouseEnter={() => setHovered({ key: item.key, series: 'net', label: item.label, value: item.income - item.expenses })}
                  onMouseLeave={() => setHovered(null)}
                />
              )}
            </div>
            {hovered?.key === item.key ? (
              <div className={`bar-tooltip ${hovered.series}`}>
                {hovered.series === 'net' ? `Net ${formatMoney(hovered.value)}` : `${hovered.series === 'income' ? 'Income' : 'Expenses'} ${formatMoney(hovered.value)}`}
              </div>
            ) : null}
            <div className="axis-label">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MarketPulseCard({ data, loading }) {
  if (loading) {
    return <div className="empty-chart">Loading market data...</div>
  }

  if (!data?.series?.length) {
    return <div className="empty-chart">Market data is unavailable right now. The app will use a fallback provider when possible.</div>
  }

  const width = 720
  const height = 220
  const padding = { top: 14, right: 12, bottom: 24, left: 18 }
  const prices = data.series.map((item) => item.close)
  const max = Math.max(...prices)
  const min = Math.min(...prices)
  const range = Math.max(max - min, 1)
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const step = chartWidth / Math.max(data.series.length - 1, 1)
  const mapY = (value) => height - padding.bottom - ((value - min) / range) * chartHeight
  const path = data.series
    .map((item, index) => `${index === 0 ? 'M' : 'L'} ${padding.left + index * step} ${mapY(item.close)}`)
    .join(' ')
  const area = `${path} L ${padding.left + (data.series.length - 1) * step} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`

  return (
    <div className="market-pulse">
      <div className="market-strip">
        <div className="trade-chip">
          <span>Symbol</span>
          <strong>{data.symbol}</strong>
        </div>
        <div className="trade-chip">
          <span>Price</span>
          <strong>{data.currency} {data.price.toFixed(2)}</strong>
        </div>
        <div className="trade-chip">
          <span>Change</span>
          <strong className={data.change >= 0 ? 'positive' : 'negative'}>
            {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)} ({data.percentChange >= 0 ? '+' : ''}{data.percentChange.toFixed(2)}%)
          </strong>
        </div>
        <div className="trade-chip">
          <span>Venue</span>
          <strong>{data.exchange || data.type || 'Market'}</strong>
        </div>
      </div>
      <div className="chart-frame market-frame">
        <svg className="chart-svg market-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${data.symbol} market trend`}>
          <defs>
            <linearGradient id="marketArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7b73d1" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#7b73d1" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + chartHeight * ratio
            return <line key={ratio} x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="grid-line premium" />
          })}
          <path d={area} className="area market" />
          <path d={path} className="line market premium" />
        </svg>
      </div>
    </div>
  )
}

function StockDetailPanel({ item }) {
  if (!item) {
    return <div className="empty-chart">Select a stock from the watchlist to inspect it.</div>
  }

  const range = Math.max(item.high - item.low, 0.01)
  const rangePosition = Math.min(100, Math.max(0, ((item.price - item.low) / range) * 100))

  return (
    <div className="stock-detail">
      <div className="stock-strip">
        <div className="trade-chip">
          <span>Price</span>
          <strong>{formatStockPrice(item.price, item.currency)}</strong>
        </div>
        <div className="trade-chip">
          <span>Change</span>
          <strong className={item.change >= 0 ? 'positive' : 'negative'}>
            {formatSignedMoney(item.change, item.currency)} ({formatSignedPercent(item.percentChange)})
          </strong>
        </div>
        <div className="trade-chip">
          <span>Open</span>
          <strong>{formatStockPrice(item.open, item.currency)}</strong>
        </div>
        <div className="trade-chip">
          <span>Prev Close</span>
          <strong>{formatStockPrice(item.previousClose, item.currency)}</strong>
        </div>
      </div>

      <div className="stock-panel">
        <div className="stock-company">
          <div className="donut-summary-label">Company</div>
          <strong>{item.name}</strong>
          <p>{item.exchange} • {item.industry}</p>
          <div className="stock-meta-grid">
            <div className="stock-meta-item">
              <span>Market Cap</span>
              <strong>{formatCompactMoney(item.marketCap * 1000000)}</strong>
            </div>
            <div className="stock-meta-item">
              <span>Country</span>
              <strong>{item.country || 'N/A'}</strong>
            </div>
            <div className="stock-meta-item">
              <span>Low</span>
              <strong>{formatStockPrice(item.low, item.currency)}</strong>
            </div>
            <div className="stock-meta-item">
              <span>High</span>
              <strong>{formatStockPrice(item.high, item.currency)}</strong>
            </div>
          </div>
        </div>

        <div className="stock-range-card">
          <div className="donut-summary-label">Intraday Range</div>
          <strong>{item.symbol}</strong>
          <p>The marker shows where the current price sits between the session low and high.</p>
          <div className="stock-range-track">
            <div className="stock-range-fill" style={{ width: `${rangePosition}%` }} />
            <div className="stock-range-marker" style={{ left: `${rangePosition}%` }} />
          </div>
          <div className="stock-range-values">
            <span>{formatStockPrice(item.low, item.currency)}</span>
            <span>{formatStockPrice(item.price, item.currency)}</span>
            <span>{formatStockPrice(item.high, item.currency)}</span>
          </div>
          <div className="stock-timestamp">Last update {formatTimestamp(item.timestamp)}</div>
          {item.website ? (
            <a className="stock-link" href={item.website} target="_blank" rel="noreferrer">
              Visit company site
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function formatStockPrice(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

function formatSignedMoney(value, currency = 'USD') {
  const amount = formatStockPrice(Math.abs(value || 0), currency)
  return `${value >= 0 ? '+' : '-'}${amount}`
}

function formatSignedPercent(value) {
  const amount = Number(value || 0).toFixed(2)
  return `${value >= 0 ? '+' : ''}${amount}%`
}

function formatTimestamp(value) {
  if (!value) return 'Unavailable'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value * 1000))
}

export default App
