package ledger

import (
	"atlas.local/backend/internal/catalog"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"regexp"
	"sort"
	"time"
)

type Price struct {
	Number        *Value    `json:"value_number,omitempty"`
	ReferenceDate string    `json:"reference_date,omitempty"`
	ID            string    `json:"id"`
	AssetID       string    `json:"asset_id,omitempty"`
	Currency      string    `json:"currency"`
	Amount        string    `json:"value"`
	At            time.Time `json:"observed_at"`
	Source        string    `json:"source"`
	SourceType    string    `json:"source_type"`
}
type AccountInfo struct{ ID, PortfolioID, Name, Kind, Currency string }
type AssetInfo struct{ ID, Name, Kind, Symbol string }
type Data struct {
	PortfolioIDs []string
	Operations   []Operation
	Accounts     map[string]Account
	AccountInfo  map[string]AccountInfo
	Assets       map[string]AssetInfo
	Prices       []Price
}

func loadPrices(ctx context.Context, q queryer, owner string) ([]Price, error) {
	rows, err := q.QueryContext(ctx, "SELECT id,COALESCE(asset_id,''),currency,value,observed_at,source,source_type,COALESCE(reference_date::text,'') FROM price_observations WHERE user_id=$1 ORDER BY observed_at,created_at,id", owner)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Price{}
	for rows.Next() {
		var p Price
		if err = rows.Scan(&p.ID, &p.AssetID, &p.Currency, &p.Amount, &p.At, &p.Source, &p.SourceType, &p.ReferenceDate); err != nil {
			return nil, err
		}
		if n := observationNumber(p.Amount); n != nil {
			p.Number = valptr(n, 8)
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
func (s *Server) createPrice(w http.ResponseWriter, r *http.Request, owner string) {
	var in struct {
		AssetID    string `json:"asset_id"`
		Currency   string `json:"currency"`
		Amount     string `json:"value"`
		ObservedAt string `json:"observed_at"`
		Source     string `json:"source"`
	}
	if !decode(w, r, &in) {
		return
	}
	v, err := number(in.Amount)
	at, dateErr := time.Parse(time.RFC3339Nano, in.ObservedAt)
	if err != nil || v.Sign() <= 0 || dateErr != nil || at.After(time.Now()) || !regexp.MustCompile(`^[A-Z]{3}$`).MatchString(in.Currency) || !text(in.Source, 120) || (in.AssetID == "" && in.Currency == "EUR" && v.Cmp(big.NewRat(1, 1)) != 0) {
		fail(w, 422, "invalid_manual_observation")
		return
	}
	tx, err := s.DB.BeginTx(r.Context(), nil)
	if err != nil {
		dbFail(w, err)
		return
	}
	defer tx.Rollback()
	if in.AssetID != "" {
		var archived bool
		if err = tx.QueryRowContext(r.Context(), "SELECT archived FROM assets WHERE id=$1 AND user_id=$2 FOR SHARE", in.AssetID, owner).Scan(&archived); err != nil {
			dbFail(w, err)
			return
		}
		if archived {
			fail(w, 409, "asset_archived")
			return
		}
	}
	p := Price{ID: token(), AssetID: in.AssetID, Currency: in.Currency, Amount: in.Amount, At: at.UTC(), Source: in.Source, SourceType: "manual"}
	_, err = tx.ExecContext(r.Context(), "INSERT INTO price_observations(id,user_id,asset_id,currency,value,observed_at,source) VALUES($1,$2,NULLIF($3,''),$4,$5,$6,$7)", p.ID, owner, p.AssetID, p.Currency, p.Amount, p.At, p.Source)
	if err != nil {
		dbFail(w, err)
		return
	}
	if err = tx.Commit(); err != nil {
		dbFail(w, err)
		return
	}
	reply(w, 201, p)
}
func (s *Server) prices(w http.ResponseWriter, r *http.Request, owner string) {
	p, err := loadPrices(r.Context(), s.DB, owner)
	if err != nil {
		dbFail(w, err)
		return
	}
	at := time.Now().UTC()
	reply(w, 200, map[string]any{"items": p, "as_of": at, "asset_market_changes_percent": changesForPrices(p, at)})
}
func (s *Server) data(ctx context.Context, owner string) (*Data, error) {
	tx, err := s.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	d := &Data{AccountInfo: map[string]AccountInfo{}, Assets: map[string]AssetInfo{}}
	if d.Operations, err = loadOperations(ctx, tx, owner, true); err != nil {
		return nil, err
	}
	if d.Accounts, err = loadAccounts(ctx, tx, owner); err != nil {
		return nil, err
	}
	if d.Prices, err = loadPrices(ctx, tx, owner); err != nil {
		return nil, err
	}
	rows, err := tx.QueryContext(ctx, "SELECT id,portfolio_id,name,kind,currency FROM accounts WHERE user_id=$1", owner)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var a AccountInfo
		if err = rows.Scan(&a.ID, &a.PortfolioID, &a.Name, &a.Kind, &a.Currency); err != nil {
			rows.Close()
			return nil, err
		}
		d.AccountInfo[a.ID] = a
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	rows, err = tx.QueryContext(ctx, "SELECT id,name,kind,symbol FROM assets WHERE user_id=$1", owner)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var a AssetInfo
		if err = rows.Scan(&a.ID, &a.Name, &a.Kind, &a.Symbol); err != nil {
			rows.Close()
			return nil, err
		}
		d.Assets[a.ID] = a
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	rows, err = tx.QueryContext(ctx, "SELECT id FROM portfolios WHERE user_id=$1 ORDER BY id", owner)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id string
		if err = rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		d.PortfolioIDs = append(d.PortfolioIDs, id)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	return d, tx.Commit()
}
func (d *Data) quote(asset, currency string, at time.Time) *Price {
	var found *Price
	for i := range d.Prices {
		p := &d.Prices[i]
		if p.AssetID == asset && (asset != "" || p.Currency == currency) && !p.At.After(at) {
			found = p
		}
	}
	return found
}
func (d *Data) fx(currency string, at time.Time) (*big.Rat, *Price) {
	if currency == "EUR" {
		return big.NewRat(1, 1), nil
	}
	p := d.quote("", currency, at)
	if p == nil {
		return nil, nil
	}
	n := observationNumber(p.Amount)
	return n, p
}

type PositionView struct {
	AccountID     string            `json:"account_id"`
	PortfolioID   string            `json:"portfolio_id"`
	AssetID       string            `json:"asset_id"`
	Name          string            `json:"name"`
	Kind          string            `json:"kind"`
	Currency      string            `json:"currency"`
	Quantity      Value             `json:"quantity"`
	Cost          *Value            `json:"cost"`
	AverageCost   *Value            `json:"average_cost"`
	Realized      *Value            `json:"realized"`
	Unrealized    *Value            `json:"unrealized"`
	ValueEUR      *Value            `json:"value_eur"`
	Quote         *Price            `json:"quote"`
	FX            []*Price          `json:"fx_observations"`
	Quality       string            `json:"quality"`
	MarketChanges map[string]*Value `json:"market_changes_percent"`
}
type CashView struct {
	AccountID   string `json:"account_id"`
	PortfolioID string `json:"portfolio_id"`
	Name        string `json:"name"`
	Currency    string `json:"currency"`
	Amount      Value  `json:"amount"`
	ValueEUR    *Value `json:"value_eur"`
	FX          *Price `json:"fx_observation"`
}
type Summary struct {
	PortfolioAllocations map[string]PortfolioAllocation `json:"portfolio_allocations_eur"`
	Consolidated         []PositionView                 `json:"consolidated_assets"`
	Income               *Value                         `json:"recorded_income_eur"`
	Fees                 *Value                         `json:"recorded_fees_eur"`
	OldObservations      bool                           `json:"uses_prior_date_observations"`
	PortfolioValues      map[string]*Value              `json:"portfolio_values_eur"`
	AccountValues        map[string]*Value              `json:"account_values_eur"`
	Movers               []PositionView                 `json:"daily_market_movers"`
	At                   time.Time                      `json:"at"`
	Total                *Value                         `json:"total_value_eur"`
	Known                Value                          `json:"known_value_eur"`
	Result               *Value                         `json:"result_eur"`
	External             *Value                         `json:"external_flows_eur"`
	PartialHistory       bool                           `json:"partial_history"`
	Missing              bool                           `json:"missing_valuation"`
	Positions            []PositionView                 `json:"positions"`
	Cash                 []CashView                     `json:"cash"`
	Allocation           map[string]Value               `json:"allocation_eur"`
	Operations           int                            `json:"operation_count"`
}

func valptr(n *big.Rat, scale int) *Value { v := value(n, scale); return &v }
func (d *Data) calculate(at time.Time) (Summary, error) {
	es := events(d.Operations, at)
	b, err := Replay(es, d.Accounts)
	if err != nil {
		return Summary{}, err
	}
	out := Summary{At: at, Positions: []PositionView{}, Cash: []CashView{}, PartialHistory: b.Partial, Operations: len(es), Allocation: map[string]Value{}}
	total := zero()
	allocation := map[string]*big.Rat{}
	allocate := func(kind string, n *big.Rat) {
		if allocation[kind] == nil {
			allocation[kind] = zero()
		}
		allocation[kind].Add(allocation[kind], n)
	}
	ids := []string{}
	for id := range d.Accounts {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	for _, id := range ids {
		info := d.AccountInfo[id]
		cash := b.Cash[id]
		if cash == nil {
			cash = zero()
		}
		fx, fxObservation := d.fx(info.Currency, at)
		if fxObservation != nil && fxObservation.referenceDay() != at.UTC().Format("2006-01-02") {
			out.OldObservations = true
		}
		cv := CashView{AccountID: id, PortfolioID: info.PortfolioID, Name: info.Name, Currency: info.Currency, Amount: value(cash, 2), FX: fxObservation}
		if fx != nil || cash.Sign() == 0 {
			euros := zero()
			if fx != nil {
				euros = mul(cash, fx)
			}
			cv.ValueEUR = valptr(euros, 2)
			total.Add(total, euros)
			kind := "cash"
			if info.Kind == "savings" {
				kind = "savings"
			}
			allocate(kind, euros)
		} else {
			out.Missing = true
		}
		out.Cash = append(out.Cash, cv)
		assetIDs := []string{}
		for asset := range b.Positions[id] {
			assetIDs = append(assetIDs, asset)
		}
		sort.Strings(assetIDs)
		for _, assetID := range assetIDs {
			p := b.Positions[id][assetID]
			asset := d.Assets[assetID]
			view := PositionView{AccountID: id, PortfolioID: info.PortfolioID, AssetID: assetID, Name: asset.Name, Kind: asset.Kind, Currency: info.Currency, Quantity: value(p.Quantity, 8), Quality: "missing_price", MarketChanges: map[string]*Value{}, FX: []*Price{}}
			if p.KnownCost {
				view.Cost = valptr(p.Cost, 2)
				view.Realized = valptr(p.Realized, 2)
				if p.Quantity.Sign() > 0 {
					view.AverageCost = valptr(div(p.Cost, p.Quantity), 8)
				}
			}
			if p.Quantity.Sign() == 0 {
				view.ValueEUR = valptr(zero(), 2)
				view.Quality = "closed"
				out.Positions = append(out.Positions, view)
				continue
			}
			quote := d.quote(assetID, "", at)
			if quote != nil && quote.referenceDay() != at.UTC().Format("2006-01-02") {
				out.OldObservations = true
			}
			view.Quote = quote
			if quote == nil {
				out.Missing = true
			} else {
				amount, _ := number(quote.Amount)
				if quote.Currency == info.Currency && p.KnownCost {
					view.Unrealized = valptr(sub(mul(p.Quantity, amount), p.Cost), 2)
				}
				quoteFX, quoteFXObservation := d.fx(quote.Currency, at)
				if quoteFXObservation != nil {
					view.FX = append(view.FX, quoteFXObservation)
				}
				if fxObservation != nil && (quoteFXObservation == nil || fxObservation.ID != quoteFXObservation.ID) {
					view.FX = append(view.FX, fxObservation)
				}
				if quoteFX == nil {
					out.Missing = true
					view.Quality = "missing_fx"
				} else {
					euros := mul(mul(p.Quantity, amount), quoteFX)
					view.ValueEUR = valptr(euros, 2)
					total.Add(total, euros)
					allocate(asset.Kind, euros)
					view.Quality = "manual_dated"
					if fx != nil && p.KnownCost {
						view.Unrealized = valptr(sub(div(euros, fx), p.Cost), 2)
					}
				}
				view.MarketChanges = d.marketChanges(assetID, quote, at)
			}
			out.Positions = append(out.Positions, view)
		}
	}

	accountTotals := map[string]*big.Rat{}
	accountMissing := map[string]bool{}
	portfolioTotals := map[string]*big.Rat{}
	portfolioMissing := map[string]bool{}
	for _, id := range d.PortfolioIDs {
		portfolioTotals[id] = zero()
	}
	for id, info := range d.AccountInfo {
		accountTotals[id] = zero()
		if portfolioTotals[info.PortfolioID] == nil {
			portfolioTotals[info.PortfolioID] = zero()
		}
	}
	accumulate := func(id string, v *Value) {
		info := d.AccountInfo[id]
		if v == nil {
			accountMissing[id] = true
			portfolioMissing[info.PortfolioID] = true
			return
		}
		n, _ := new(big.Rat).SetString(v.Exact)
		accountTotals[id].Add(accountTotals[id], n)
		portfolioTotals[info.PortfolioID].Add(portfolioTotals[info.PortfolioID], n)
	}
	for _, cash := range out.Cash {
		accumulate(cash.AccountID, cash.ValueEUR)
	}
	for _, p := range out.Positions {
		accumulate(p.AccountID, p.ValueEUR)
	}
	out.AccountValues = map[string]*Value{}
	out.PortfolioValues = map[string]*Value{}
	for id, n := range accountTotals {
		out.AccountValues[id] = nil
		if !accountMissing[id] {
			out.AccountValues[id] = valptr(n, 2)
		}
	}
	for id, n := range portfolioTotals {
		out.PortfolioValues[id] = nil
		if !portfolioMissing[id] {
			out.PortfolioValues[id] = valptr(n, 2)
		}
	}
	out.PortfolioAllocations = allocatePortfolios(out, d.AccountInfo)
	d.consolidateAssets(&out, b, at)
	out.Movers = []PositionView{}
	for _, p := range out.Consolidated {
		if p.MarketChanges["day"] != nil {
			out.Movers = append(out.Movers, p)
		}
	}
	sort.SliceStable(out.Movers, func(i, j int) bool {
		a, _ := new(big.Rat).SetString(out.Movers[i].MarketChanges["day"].Exact)
		b, _ := new(big.Rat).SetString(out.Movers[j].MarketChanges["day"].Exact)
		return a.Cmp(b) > 0
	})
	if b.KnownIncome {
		out.Income = valptr(b.IncomeEUR, 2)
	}
	if b.KnownFees {
		out.Fees = valptr(b.FeesEUR, 2)
	}
	out.Known = value(total, 2)
	if !out.Missing {
		out.Total = valptr(total, 2)
	}
	if b.KnownExternal {
		out.External = valptr(b.ExternalEUR, 2)
	}
	if !out.Missing && b.KnownExternal && !b.Partial {
		out.Result = valptr(sub(total, b.ExternalEUR), 2)
	}
	for kind, n := range allocation {
		out.Allocation[kind] = value(n, 2)
	}
	sort.SliceStable(out.Positions, func(i, j int) bool {
		a, c := out.Positions[i].ValueEUR, out.Positions[j].ValueEUR
		if a == nil {
			return false
		}
		if c == nil {
			return true
		}
		x, _ := new(big.Rat).SetString(a.Exact)
		y, _ := new(big.Rat).SetString(c.Exact)
		return x.Cmp(y) > 0
	})
	return out, nil
}
func monthBefore(at time.Time) time.Time {
	y, m, d := at.Date()
	first := time.Date(y, m, 1, at.Hour(), at.Minute(), at.Second(), at.Nanosecond(), at.Location()).AddDate(0, -1, 0)
	last := first.AddDate(0, 1, 0).AddDate(0, 0, -1).Day()
	if d > last {
		d = last
	}
	return time.Date(first.Year(), first.Month(), d, at.Hour(), at.Minute(), at.Second(), at.Nanosecond(), at.Location())
}
func yearBefore(at time.Time) time.Time {
	y, m, d := at.Date()
	if m == time.February && d == 29 {
		d = 28
	}
	return time.Date(y-1, m, d, at.Hour(), at.Minute(), at.Second(), at.Nanosecond(), at.Location())
}
func (s *Server) summary(w http.ResponseWriter, r *http.Request, owner string) {
	at := time.Now().UTC()
	if raw := r.URL.Query().Get("at"); raw != "" {
		var err error
		at, err = time.Parse(time.RFC3339Nano, raw)
		if err != nil || at.After(time.Now()) {
			fail(w, 400, "invalid_date")
			return
		}
	}
	d, err := s.data(r.Context(), owner)
	if err != nil {
		dbFail(w, err)
		return
	}
	out, err := d.calculate(at)
	if err != nil {
		fail(w, 422, err.Error())
		return
	}
	reply(w, 200, out)
}

type TimelinePoint struct {
	At              time.Time `json:"at"`
	Value           *Value    `json:"value_eur"`
	Missing         bool      `json:"missing"`
	OldObservations bool      `json:"uses_prior_date_observations"`
}

// Select a valuation after replaying all owned accounts, including cross-portfolio transfers.
// This is not a performance calculation or a classification of perimeter flows.
func timelinePoint(summary Summary, portfolio string) TimelinePoint {
	point := TimelinePoint{At: summary.At.UTC(), Value: summary.Total, Missing: summary.Missing, OldObservations: summary.OldObservations}
	if portfolio == "" {
		return point
	}
	point.Value = summary.PortfolioValues[portfolio]
	if _, exists := summary.PortfolioValues[portfolio]; !exists {
		// Ownership is checked by the caller. A portfolio with no accounts has zero recorded value.
		point.Value = valptr(zero(), 2)
	}
	point.Missing = point.Value == nil
	point.OldObservations = false
	old := func(p *Price) bool { return p != nil && p.referenceDay() != summary.At.UTC().Format("2006-01-02") }
	for _, cash := range summary.Cash {
		if cash.PortfolioID == portfolio && old(cash.FX) {
			point.OldObservations = true
		}
	}
	for _, position := range summary.Positions {
		if position.PortfolioID != portfolio {
			continue
		}
		if old(position.Quote) {
			point.OldObservations = true
		}
		for _, fx := range position.FX {
			if old(fx) {
				point.OldObservations = true
			}
		}
	}
	return point
}

func (s *Server) timeline(w http.ResponseWriter, r *http.Request, owner string) {
	from, err := time.Parse(time.RFC3339Nano, r.URL.Query().Get("from"))
	if err != nil {
		fail(w, 400, "explicit_range_required")
		return
	}
	to, err := time.Parse(time.RFC3339Nano, r.URL.Query().Get("to"))
	if err != nil || to.Before(from) || to.After(time.Now()) || to.Sub(from) > 366*24*time.Hour {
		fail(w, 400, "range_must_fit_one_year")
		return
	}
	portfolio := r.URL.Query().Get("portfolio_id")
	if portfolio != "" {
		var owned bool
		if err := s.DB.QueryRowContext(r.Context(), "SELECT EXISTS(SELECT 1 FROM portfolios WHERE id=$1 AND user_id=$2)", portfolio, owner).Scan(&owned); err != nil {
			dbFail(w, err)
			return
		}
		if !owned {
			fail(w, 404, "not_found")
			return
		}
	}
	d, err := s.data(r.Context(), owner)
	if err != nil {
		dbFail(w, err)
		return
	}
	out := []TimelinePoint{}
	for at := from; !at.After(to); at = at.Add(24 * time.Hour) {
		summary, err := d.calculate(at)
		if err != nil {
			fail(w, 422, err.Error())
			return
		}
		out = append(out, timelinePoint(summary, portfolio))
	}
	reply(w, 200, map[string]any{"items": out, "resolution": "daily", "timezone": "UTC", "interpolation": false, "portfolio_id": portfolio, "metric": "valuation"})
}
func (s *Server) export(w http.ResponseWriter, r *http.Request, owner string) {
	tx, err := s.DB.BeginTx(r.Context(), &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		dbFail(w, err)
		return
	}
	defer tx.Rollback()
	payload, err := catalog.ReadExport(r.Context(), tx, owner)
	if err != nil {
		if errors.Is(err, catalog.ErrExportTooLarge) {
			fail(w, 413, err.Error())
		} else {
			dbFail(w, err)
		}
		return
	}
	ops, err := loadOperations(r.Context(), tx, owner, true)
	if err != nil {
		dbFail(w, err)
		return
	}
	prices, err := loadPrices(r.Context(), tx, owner)
	if err != nil {
		dbFail(w, err)
		return
	}
	rows, err := tx.QueryContext(r.Context(), "SELECT row_to_json(t) FROM (SELECT id,fingerprint,rows,confirmed,created_at FROM import_batches WHERE user_id=$1 ORDER BY created_at,id) t", owner)
	if err != nil {
		dbFail(w, err)
		return
	}
	imports := []json.RawMessage{}
	for rows.Next() {
		var raw []byte
		if err = rows.Scan(&raw); err != nil {
			rows.Close()
			dbFail(w, err)
			return
		}
		imports = append(imports, json.RawMessage(raw))
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		dbFail(w, err)
		return
	}
	payload["imports"] = imports
	if err = tx.Commit(); err != nil {
		dbFail(w, err)
		return
	}
	payload["format"] = "atlas-portfolio"
	payload["version"] = 1
	payload["exported_at"] = time.Now().UTC()
	ranks := []int64{}
	seen := map[int64]bool{}
	for _, op := range ops {
		if !seen[op.Order] {
			ranks = append(ranks, op.Order)
			seen[op.Order] = true
		}
	}
	sort.Slice(ranks, func(i, j int) bool { return ranks[i] < ranks[j] })
	rank := map[int64]int{}
	for i, n := range ranks {
		rank[n] = i + 1
	}
	type ExportOperation struct {
		Operation
		ReplayOrder int `json:"replay_order"`
	}
	exported := []ExportOperation{}
	for _, op := range ops {
		exported = append(exported, ExportOperation{op, rank[op.Order]})
	}
	payload["operations"] = exported
	payload["replay_ordering"] = "occurred_at, then replay_order; replay active operations only"
	payload["attributions"] = map[string]string{"ECB": "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html"}

	payload["prices"] = prices
	payload["number_encoding"] = "source decimal strings; exact rational computations"
	w.Header().Set("Content-Disposition", `attachment; filename="atlas-portfolio.json"`)
	reply(w, 200, payload)
}

func (p Price) referenceDay() string {
	if p.ReferenceDate != "" {
		return p.ReferenceDate
	}
	return p.At.UTC().Format("2006-01-02")
}
