package ledger

import (
	"math/big"
	"sort"
	"time"
)

// consolidateAssets groups one instrument across accounts without mixing currencies.
// EUR cost uses the recorded historical FX, never today's rate as acquisition FX.
func (d *Data) consolidateAssets(out *Summary, book *Book, at time.Time) {
	type aggregate struct {
		quantity, cost, realized, market     *big.Rat
		knownCost, knownRealized, knownValue bool
		view                                 PositionView
	}
	groups := map[string]*aggregate{}
	for _, view := range out.Positions {
		group := groups[view.AssetID]
		if group == nil {
			group = &aggregate{zero(), zero(), zero(), zero(), true, true, true, PositionView{AssetID: view.AssetID, Name: view.Name, Kind: view.Kind, Currency: "EUR", Quote: view.Quote, Quality: view.Quality, MarketChanges: view.MarketChanges, FX: []*Price{}}}
			groups[view.AssetID] = group
		}
		if len(group.view.MarketChanges) < len(view.MarketChanges) {
			group.view.MarketChanges = view.MarketChanges
		}
		p := book.Positions[view.AccountID][view.AssetID]
		group.quantity.Add(group.quantity, p.Quantity)
		if p.Quantity.Sign() > 0 {
			group.cost.Add(group.cost, p.CostEUR)
			group.knownCost = group.knownCost && p.KnownCost && p.KnownEUR
		}
		group.realized.Add(group.realized, p.RealizedEUR)
		group.knownRealized = group.knownRealized && p.KnownCost && p.KnownEUR
		if view.ValueEUR == nil {
			group.knownValue = false
		} else {
			n, _ := new(big.Rat).SetString(view.ValueEUR.Exact)
			group.market.Add(group.market, n)
		}
	}
	out.Consolidated = []PositionView{}
	for assetID, g := range groups {
		v := g.view
		v.Quantity = value(g.quantity, 8)
		v.Quote = d.quote(assetID, "", at)
		if g.quantity.Sign() == 0 {
			v.Quality = "closed"
		} else if v.Quote == nil {
			v.Quality = "missing_price"
		} else if !g.knownValue {
			v.Quality = "missing_fx"
		} else {
			v.Quality = "manual_dated"
		}
		if g.knownCost {
			v.Cost = valptr(g.cost, 2)
			if g.quantity.Sign() > 0 {
				v.AverageCost = valptr(div(g.cost, g.quantity), 8)
			}
		}
		if g.knownRealized {
			v.Realized = valptr(g.realized, 2)
		}
		if g.knownValue {
			v.ValueEUR = valptr(g.market, 2)
			if g.knownCost {
				v.Unrealized = valptr(sub(g.market, g.cost), 2)
			}
		}
		if v.Quote != nil {
			_, fx := d.fx(v.Quote.Currency, at)
			if fx != nil {
				v.FX = append(v.FX, fx)
			}
		}
		out.Consolidated = append(out.Consolidated, v)
	}
	sort.SliceStable(out.Consolidated, func(i, j int) bool {
		a, b := out.Consolidated[i], out.Consolidated[j]
		if a.ValueEUR == nil {
			return b.ValueEUR == nil && a.AssetID < b.AssetID
		}
		if b.ValueEUR == nil {
			return true
		}
		x, _ := new(big.Rat).SetString(a.ValueEUR.Exact)
		y, _ := new(big.Rat).SetString(b.ValueEUR.Exact)
		if x.Cmp(y) == 0 {
			return a.AssetID < b.AssetID
		}
		return x.Cmp(y) > 0
	})
}
