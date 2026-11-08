package ledger

import "math/big"

// PortfolioAllocation exposes known values separately from a possibly missing total.
// Categories contain only valued components, using the existing global classification.
type PortfolioAllocation struct {
	OldObservations bool             `json:"uses_prior_date_observations"`
	Total           *Value           `json:"total_value_eur"`
	Known           Value            `json:"known_value_eur"`
	Missing         bool             `json:"missing_valuation"`
	Categories      map[string]Value `json:"by_kind_eur"`
}

func allocatePortfolios(summary Summary, accounts map[string]AccountInfo) map[string]PortfolioAllocation {
	known := map[string]*big.Rat{}
	categories := map[string]map[string]*big.Rat{}
	for portfolio := range summary.PortfolioValues {
		known[portfolio] = zero()
		categories[portfolio] = map[string]*big.Rat{}
	}
	add := func(portfolio, kind string, v *Value) {
		if v == nil {
			return
		}
		// Value.Exact is generated internally from big.Rat, never from request data.
		n, _ := new(big.Rat).SetString(v.Exact)
		known[portfolio].Add(known[portfolio], n)
		if categories[portfolio][kind] == nil {
			categories[portfolio][kind] = zero()
		}
		categories[portfolio][kind].Add(categories[portfolio][kind], n)
	}
	for _, cash := range summary.Cash {
		kind := "cash"
		if accounts[cash.AccountID].Kind == "savings" {
			kind = "savings"
		}
		add(cash.PortfolioID, kind, cash.ValueEUR)
	}
	for _, position := range summary.Positions {
		if position.Quality != "closed" {
			add(position.PortfolioID, position.Kind, position.ValueEUR)
		}
	}
	out := map[string]PortfolioAllocation{}
	for portfolio, amount := range known {
		entry := PortfolioAllocation{Total: summary.PortfolioValues[portfolio], Known: value(amount, 2), Missing: summary.PortfolioValues[portfolio] == nil, Categories: map[string]Value{}}
		entry.OldObservations = timelinePoint(summary, portfolio).OldObservations
		for kind, amount := range categories[portfolio] {
			entry.Categories[kind] = value(amount, 2)
		}
		out[portfolio] = entry
	}
	return out
}
