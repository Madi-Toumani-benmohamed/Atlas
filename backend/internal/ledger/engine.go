// Package ledger replays exact events. Rationals preserve recurring quantities;
// rounding is only a presentation boundary, never a persisted financial value.
package ledger

import (
	"errors"
	"fmt"
	"math/big"
	"regexp"
	"sort"
	"strings"
	"time"
)

type Event struct {
	ID              string `json:"id,omitempty"`
	Order           int64  `json:"-"`
	Kind            string `json:"kind"`
	AccountID       string `json:"account_id"`
	TargetID        string `json:"target_account_id,omitempty"`
	AssetID         string `json:"asset_id,omitempty"`
	At              string `json:"occurred_at"`
	Quantity        string `json:"quantity,omitempty"`
	Price           string `json:"price,omitempty"`
	Amount          string `json:"amount,omitempty"`
	Fees            string `json:"fees,omitempty"`
	Cost            string `json:"cost,omitempty"`
	PriceSource     string `json:"price_source,omitempty"`
	PriceObservedAt string `json:"price_observed_at,omitempty"`
	FXToEUR         string `json:"fx_to_eur,omitempty"`
	FXSource        string `json:"fx_source,omitempty"`
	FXObservedAt    string `json:"fx_observed_at,omitempty"`
	ExchangeRate    string `json:"exchange_rate,omitempty"`
	Note            string `json:"note,omitempty"`
}
type Account struct {
	Currency string
	Archived bool
}
type Position struct {
	Quantity, Cost, CostEUR, Realized, RealizedEUR *big.Rat
	KnownCost, KnownEUR                            bool
}
type Book struct {
	KnownIncome   bool
	KnownFees     bool
	Cash          map[string]*big.Rat
	Positions     map[string]map[string]*Position
	ExternalEUR   *big.Rat
	KnownExternal bool
	Partial       bool
	IncomeEUR     *big.Rat
	FeesEUR       *big.Rat
}

var decimal = regexp.MustCompile(`^(0|[1-9][0-9]{0,35})(\.[0-9]{1,18})?$`)

func zero() *big.Rat              { return new(big.Rat) }
func copyRat(v *big.Rat) *big.Rat { return new(big.Rat).Set(v) }
func number(s string) (*big.Rat, error) {
	if s == "" {
		return zero(), nil
	}
	if !decimal.MatchString(s) {
		return nil, errors.New("invalid_decimal")
	}
	n, ok := new(big.Rat).SetString(s)
	if !ok {
		return nil, errors.New("invalid_decimal")
	}
	return n, nil
}

var fraction = regexp.MustCompile(`^[0-9]+/[1-9][0-9]*$`)

func quantityNumber(s string) (*big.Rat, error) {
	if !strings.Contains(s, "/") {
		return number(s)
	}
	if len(s) > 8192 || !fraction.MatchString(s) {
		return nil, errors.New("invalid_quantity")
	}
	n, ok := new(big.Rat).SetString(s)
	if !ok || n.Sign() < 0 {
		return nil, errors.New("invalid_quantity")
	}
	return n, nil
}
func add(a, b *big.Rat) *big.Rat { return new(big.Rat).Add(a, b) }
func sub(a, b *big.Rat) *big.Rat { return new(big.Rat).Sub(a, b) }
func mul(a, b *big.Rat) *big.Rat { return new(big.Rat).Mul(a, b) }
func div(a, b *big.Rat) *big.Rat { return new(big.Rat).Quo(a, b) }
func (b *Book) position(account, asset string) *Position {
	if b.Positions[account] == nil {
		b.Positions[account] = map[string]*Position{}
	}
	p := b.Positions[account][asset]
	if p == nil {
		p = &Position{zero(), zero(), zero(), zero(), zero(), true, true}
		b.Positions[account][asset] = p
	}
	return p
}

// Check validates a request without inventing opening balances or price data.
func Check(e Event) error {
	switch e.Kind {
	case "deposit", "withdrawal", "buy", "sell", "transfer", "fee", "dividend", "staking", "interest", "opening_cash", "opening_position":
	default:
		return errors.New("unsupported_operation")
	}
	at, err := time.Parse(time.RFC3339Nano, e.At)
	if err != nil || at.After(time.Now()) {
		return errors.New("invalid_date")
	}
	for _, s := range []string{e.Price, e.Amount, e.Fees, e.Cost, e.FXToEUR, e.ExchangeRate} {
		if _, err = number(s); err != nil {
			return err
		}
	}
	q, qerr := quantityNumber(e.Quantity)
	if qerr != nil {
		return qerr
	}
	p, _ := number(e.Price)
	a, _ := number(e.Amount)
	f, _ := number(e.Fees)
	switch e.Kind {
	case "buy":
		if e.AssetID == "" || p.Sign() <= 0 || (q.Sign() <= 0 && a.Sign() <= 0) || a.Sign() > 0 && a.Cmp(f) <= 0 {
			return errors.New("invalid_trade")
		}
		if q.Sign() > 0 && a.Sign() > 0 && add(mul(q, p), f).Cmp(a) != 0 {
			return errors.New("inconsistent_total")
		}
	case "sell":
		if e.AssetID == "" || q.Sign() <= 0 || p.Sign() <= 0 || mul(q, p).Cmp(f) < 0 {
			return errors.New("invalid_trade")
		}
		if a.Sign() > 0 && sub(mul(q, p), f).Cmp(a) != 0 {
			return errors.New("inconsistent_total")
		}
	case "opening_position":
		if e.AssetID == "" || q.Sign() <= 0 || e.Amount != "" || e.Price != "" || f.Sign() != 0 {
			return errors.New("invalid_opening")
		}
	case "staking":
		if e.AssetID == "" || q.Sign() <= 0 || p.Sign() <= 0 || e.PriceSource == "" || !sameDayBefore(e.PriceObservedAt, e.At) || e.Amount != "" || f.Sign() != 0 {
			return errors.New("staking_price_required")
		}
	case "transfer":
		if e.TargetID == "" || e.TargetID == e.AccountID {
			return errors.New("invalid_transfer")
		}
		if e.AssetID != "" {
			if q.Sign() <= 0 || e.Amount != "" || f.Sign() != 0 {
				return errors.New("invalid_transfer")
			}
		} else if a.Sign() <= 0 || e.Quantity != "" || e.Price != "" {
			return errors.New("invalid_transfer")
		}
	default:
		if a.Sign() <= 0 || (e.AssetID != "" && e.Kind != "dividend") || e.Quantity != "" || e.Price != "" || f.Sign() != 0 {
			return errors.New("invalid_cash_event")
		}
	}
	if e.Kind != "buy" && e.Kind != "sell" && e.Kind != "transfer" && e.Fees != "" && f.Sign() != 0 {
		return errors.New("unexpected_fees")
	}
	if e.ExchangeRate != "" && (e.FXSource == "" || !sameDayBefore(e.FXObservedAt, e.At)) {
		return errors.New("exchange_rate_source_required")
	}
	if e.Cost != "" && e.Kind != "opening_position" {
		return errors.New("unexpected_cost")
	}
	if e.TargetID != "" && e.Kind != "transfer" {
		return errors.New("unexpected_target")
	}
	if e.ExchangeRate != "" && e.Kind != "transfer" {
		return errors.New("unexpected_exchange_rate")
	}
	if e.FXToEUR != "" {
		v, _ := number(e.FXToEUR)
		if v.Sign() <= 0 || e.FXSource == "" || !sameDayBefore(e.FXObservedAt, e.At) {
			return errors.New("invalid_fx_observation")
		}
	}
	return nil
}
func sameDayBefore(observed, at string) bool {
	o, err := time.Parse(time.RFC3339Nano, observed)
	if err != nil {
		return false
	}
	t, err := time.Parse(time.RFC3339Nano, at)
	return err == nil && !o.After(t) && o.UTC().Format("2006-01-02") == t.UTC().Format("2006-01-02")
}

func Replay(input []Event, accounts map[string]Account) (*Book, error) {
	b := &Book{KnownIncome: true, KnownFees: true, Cash: map[string]*big.Rat{}, Positions: map[string]map[string]*Position{}, ExternalEUR: zero(), KnownExternal: true, IncomeEUR: zero(), FeesEUR: zero()}
	events := append([]Event(nil), input...)
	sort.SliceStable(events, func(i, j int) bool {
		a, _ := time.Parse(time.RFC3339Nano, events[i].At)
		c, _ := time.Parse(time.RFC3339Nano, events[j].At)
		if !a.Equal(c) {
			return a.Before(c)
		}
		return events[i].Order < events[j].Order
	})
	for _, e := range events {
		if err := Check(e); err != nil {
			return nil, fmt.Errorf("%s: %w", e.ID, err)
		}
		account, ok := accounts[e.AccountID]
		if !ok {
			return nil, errors.New("unknown_account")
		}
		if b.Cash[e.AccountID] == nil {
			b.Cash[e.AccountID] = zero()
		}
		q, qerr := quantityNumber(e.Quantity)
		if qerr != nil {
			return nil, qerr
		}
		price, _ := number(e.Price)
		amount, _ := number(e.Amount)
		fees, _ := number(e.Fees)
		cost, _ := number(e.Cost)
		fx := big.NewRat(1, 1)
		knownFX := true
		if account.Currency != "EUR" {
			if e.FXToEUR == "" {
				knownFX = false
			} else {
				fx, _ = number(e.FXToEUR)
			}
		} else if e.FXToEUR != "" {
			v, _ := number(e.FXToEUR)
			if v.Cmp(fx) != 0 {
				return nil, errors.New("eur_fx_must_be_one")
			}
		}
		cash := b.Cash[e.AccountID]
		switch e.Kind {
		case "deposit", "withdrawal", "opening_cash", "fee", "dividend", "interest":
			switch e.Kind {
			case "deposit":
				cash.Add(cash, amount)
				if knownFX {
					b.ExternalEUR.Add(b.ExternalEUR, mul(amount, fx))
				} else {
					b.KnownExternal = false
				}
			case "withdrawal":
				cash.Sub(cash, amount)
				if knownFX {
					b.ExternalEUR.Sub(b.ExternalEUR, mul(amount, fx))
				} else {
					b.KnownExternal = false
				}
			case "opening_cash":
				cash.Add(cash, amount)
				b.Partial = true
				b.KnownExternal = false
			case "fee":
				cash.Sub(cash, amount)
				if knownFX {
					b.FeesEUR.Add(b.FeesEUR, mul(amount, fx))
				} else {
					b.KnownFees = false
				}
			default:
				cash.Add(cash, amount)
				if knownFX {
					b.IncomeEUR.Add(b.IncomeEUR, mul(amount, fx))
				} else {
					b.KnownIncome = false
				}
			}
		case "buy", "sell", "opening_position", "staking":
			p := b.position(e.AccountID, e.AssetID)
			switch e.Kind {
			case "buy":
				if q.Sign() == 0 {
					q = div(sub(amount, fees), price)
				} else {
					amount = add(mul(q, price), fees)
				}
				cash.Sub(cash, amount)
				p.Quantity.Add(p.Quantity, q)
				p.Cost.Add(p.Cost, amount)
				if knownFX {
					p.CostEUR.Add(p.CostEUR, mul(amount, fx))
				} else {
					p.KnownEUR = false
				}
				if knownFX {
					b.FeesEUR.Add(b.FeesEUR, mul(fees, fx))
				} else if fees.Sign() > 0 {
					b.KnownFees = false
				}
			case "sell":
				if p.Quantity.Cmp(q) < 0 {
					return nil, errors.New("insufficient_quantity")
				}
				share := div(q, p.Quantity)
				removed := mul(p.Cost, share)
				removedEUR := mul(p.CostEUR, share)
				proceeds := sub(mul(q, price), fees)
				p.Quantity.Sub(p.Quantity, q)
				p.Cost.Sub(p.Cost, removed)
				p.CostEUR.Sub(p.CostEUR, removedEUR)
				p.Realized.Add(p.Realized, sub(proceeds, removed))
				if knownFX {
					p.RealizedEUR.Add(p.RealizedEUR, sub(mul(proceeds, fx), removedEUR))
				} else {
					p.KnownEUR = false
				}
				cash.Add(cash, proceeds)
				if knownFX {
					b.FeesEUR.Add(b.FeesEUR, mul(fees, fx))
				} else if fees.Sign() > 0 {
					b.KnownFees = false
				}
			case "opening_position":
				p.Quantity.Add(p.Quantity, q)
				if e.Cost == "" {
					p.KnownCost = false
					p.KnownEUR = false
				} else {
					p.Cost.Add(p.Cost, cost)
					if knownFX {
						p.CostEUR.Add(p.CostEUR, mul(cost, fx))
					} else {
						p.KnownEUR = false
					}
				}
				b.Partial = true
				b.KnownExternal = false
			case "staking":
				cost = mul(q, price)
				p.Quantity.Add(p.Quantity, q)
				p.Cost.Add(p.Cost, cost)
				if knownFX {
					p.CostEUR.Add(p.CostEUR, mul(cost, fx))
					b.IncomeEUR.Add(b.IncomeEUR, mul(cost, fx))
				} else {
					b.KnownIncome = false
					p.KnownEUR = false
				}
			}
		case "transfer":
			target, ok := accounts[e.TargetID]
			if !ok {
				return nil, errors.New("unknown_target")
			}
			rate := big.NewRat(1, 1)
			if target.Currency != account.Currency {
				rate, _ = number(e.ExchangeRate)
				if rate.Sign() <= 0 {
					return nil, errors.New("explicit_exchange_rate_required")
				}
			} else if e.ExchangeRate != "" {
				v, _ := number(e.ExchangeRate)
				if v.Cmp(rate) != 0 {
					return nil, errors.New("invalid_exchange_rate")
				}
			}
			if e.AssetID != "" {
				source := b.position(e.AccountID, e.AssetID)
				dest := b.position(e.TargetID, e.AssetID)
				if source.Quantity.Cmp(q) < 0 {
					return nil, errors.New("insufficient_quantity")
				}
				share := div(q, source.Quantity)
				removed := mul(source.Cost, share)
				removedEUR := mul(source.CostEUR, share)
				source.Quantity.Sub(source.Quantity, q)
				source.Cost.Sub(source.Cost, removed)
				source.CostEUR.Sub(source.CostEUR, removedEUR)
				dest.Quantity.Add(dest.Quantity, q)
				dest.Cost.Add(dest.Cost, mul(removed, rate))
				dest.CostEUR.Add(dest.CostEUR, removedEUR)
				dest.KnownCost = dest.KnownCost && source.KnownCost
				dest.KnownEUR = dest.KnownEUR && source.KnownEUR
			} else {
				cash.Sub(cash, add(amount, fees))
				if b.Cash[e.TargetID] == nil {
					b.Cash[e.TargetID] = zero()
				}
				b.Cash[e.TargetID].Add(b.Cash[e.TargetID], mul(amount, rate))
				if knownFX {
					b.FeesEUR.Add(b.FeesEUR, mul(fees, fx))
				} else if fees.Sign() > 0 {
					b.KnownFees = false
				}
			}
		}
		if cash.Sign() < 0 {
			return nil, errors.New("insufficient_cash")
		}
	}
	return b, nil
}

// Value contains an exact rational plus a decimal rounded only for rendering.
type Value struct {
	Exact       string `json:"exact"`
	Display     string `json:"display"`
	Approximate bool   `json:"approximate"`
}

func value(n *big.Rat, scale int) Value {
	display := n.FloatString(scale)
	v, _ := new(big.Rat).SetString(display)
	return Value{n.RatString(), display, v.Cmp(n) != 0}
}
