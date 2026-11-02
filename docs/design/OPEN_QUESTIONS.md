# Open Questions

Answer inline, or just reply "defaults are fine" for any you agree with. Each question shows the default I designed around.

## Account and risk

**Q1. Broker and account.** Which broker, account type (individual taxable, IRA, entity), options approval level, futures permission, and margin type (Reg-T or Portfolio Margin)?
*Default:* Interactive Brokers (a connector is already attached to your Claude account), taxable account, Reg-T margin to start, IBKR paper account for the paper phase.

**Q2. Risk appetite.** Largest peak-to-trough drawdown you would tolerate, target excess return over Fed funds, and typical buying-power use?
*Default:* 12% max drawdown, +4–8%/yr target, 25–40% buying power used (hard cap 50%).

**Q3. Naked vs defined risk.** May the fund sell naked (cash-secured) puts on indices and ETFs? Naked calls?
*Default:* Naked puts allowed on index/ETF with caps (10% notional per position, stress-tested). Naked calls never; bearish views use call credit spreads. NG and silver: spreads only.

**Q4. Instruments.** Index/ETF options in Phase 1 and futures options (/ES, /CL, /NG, /GC, /ZN) in Phase 2, or futures options from day one?
*Default:* Index/ETF first (better sizing granularity for $1M), futures options in Phase 2.

**Q5. Universe.** Add a Treasuries sleeve (TLT) as the recession hedge? Anything else to trade (copper, FX, Bitcoin, single stocks)?
*Default:* Add TLT. Copper, USD, USD/JPY and Bitcoin are watch-only signals.

**Q6. Liquidity needs and constraints.** Any planned withdrawals, other holdings to hedge, restricted tickers, or ESG exclusions?
*Default:* None.

**Q7. Taxes.** Is the account taxable? If yes, prefer Section 1256 products (SPX/XSP, futures options: 60% long-term / 40% short-term)?
*Default:* Taxable; prefer XSP/SPX for the US sleeve.

## Data and cost

**Q8. Data budget.** Which Massive (Polygon) plan do you have, and does it include options data? Willing to pay for a global CAPE source (Research Affiliates, Barclays, Siblis), or use a computed proxy?
*Default:* Free public sources + your Massive plan; global CAPE from a computed proxy until you choose a provider. US CAPE (Shiller) is free.

**Q9. Model and monthly budget.** **Decided 2026-11-02:** Run in Claude Code on your Claude Pro plan: no API charges. Claude Opus 5.5 with Pro-budget effort; if the weekly allowance does not fit, the fallbacks in `config/runtime.yaml` apply in your chosen order.

## Operations

**Q10. Automation.** Paper trading with per-ticket approval, then live with per-ticket approval. Should take-profit closes (buying back at 50% profit) ever execute automatically once live is proven?
*Default:* No automatic execution in this design; revisit after 3 months live.

**Q11. Cadence and notifications.** Weekly IC on Sunday evening with approvals Monday morning, plus a daily post-close check? Your time zone? Notify by email, Slack, or phone push?
*Default:* As described, US Eastern time, email summary + push for breaker events.

**Q12. Your own views.** Do you want to inject discretionary views ("PM view") that the committee must address? They would never bypass risk limits.
*Default:* Yes, as an optional input on the IC page.

**Q13. Stack and hosting.** **Decided 2026-11-02:** Claude Code cloud sessions and scheduled tasks for agent runs, GitHub Actions for code-only jobs, your Supabase project for the database. Details in `config/runtime.yaml`.
