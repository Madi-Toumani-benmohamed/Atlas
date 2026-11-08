package ledger

import (
	"math/big"
	"time"
)

// Market changes compare observations in the same currency and at covered dates.
// They do not depend on holdings and do not measure a user's investment return.
func (d *Data) marketChanges(assetID string, quote *Price, at time.Time) map[string]*Value {
	out := map[string]*Value{"day": nil, "week": nil, "month": nil, "year": nil}
	if quote == nil || quote.AssetID != assetID || quote.referenceDay() != at.UTC().Format("2006-01-02") {
		return out
	}
	current, err := number(quote.Amount)
	if err != nil || current.Sign() <= 0 {
		return out
	}
	for period, oldAt := range map[string]time.Time{"day": at.AddDate(0, 0, -1), "week": at.AddDate(0, 0, -7), "month": monthBefore(at), "year": yearBefore(at)} {
		old := d.quote(assetID, "", oldAt)
		if old == nil || old.Currency != quote.Currency || old.referenceDay() != oldAt.UTC().Format("2006-01-02") {
			continue
		}
		previous, err := number(old.Amount)
		if err != nil || previous.Sign() <= 0 {
			continue
		}
		out[period] = valptr(mul(sub(div(current, previous), big.NewRat(1, 1)), big.NewRat(100, 1)), 2)
	}
	return out
}

// Grouping keeps this read-only projection linear in the number of observations.
func changesForPrices(prices []Price, at time.Time) map[string]map[string]*Value {
	groups := map[string][]Price{}
	for _, p := range prices {
		if p.AssetID != "" {
			groups[p.AssetID] = append(groups[p.AssetID], p)
		}
	}
	out := map[string]map[string]*Value{}
	for id, prices := range groups {
		d := Data{Prices: prices}
		out[id] = d.marketChanges(id, d.quote(id, "", at), at)
	}
	return out
}
