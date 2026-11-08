package ledger

import (
	"math/big"
	"testing"
	"time"
)

func TestPortfolioTimelineReplaysTransfersAcrossWholeLedger(t *testing.T) {
	d := Data{
		Accounts:    map[string]Account{"a": {Currency: "EUR"}, "b": {Currency: "EUR"}, "c": {Currency: "EUR"}},
		AccountInfo: map[string]AccountInfo{"a": {ID: "a", PortfolioID: "first", Currency: "EUR"}, "b": {ID: "b", PortfolioID: "second", Currency: "EUR"}, "c": {ID: "c", PortfolioID: "missing", Currency: "EUR"}},
		Assets:      map[string]AssetInfo{"asset": {ID: "asset", Kind: "stock"}},
	}
	for _, e := range []Event{
		{Kind: "deposit", AccountID: "a", Amount: "100", At: "2020-01-01T00:00:00Z"},
		{Kind: "opening_position", AccountID: "c", AssetID: "asset", Quantity: "1", At: "2020-01-01T00:00:00Z"},
		{Kind: "transfer", AccountID: "a", TargetID: "b", Amount: "40", At: "2020-01-02T00:00:00Z"},
	} {
		d.Operations = append(d.Operations, Operation{Event: e, Active: true})
	}
	for _, tc := range []struct{ date, first, second string }{
		{"2020-01-01T12:00:00Z", "100", "0"},
		{"2020-01-02T12:00:00Z", "60", "40"},
		{"2020-01-03T12:00:00Z", "60", "40"},
	} {
		t.Run(tc.date, func(t *testing.T) {
			at, _ := time.Parse(time.RFC3339, tc.date)
			summary, err := d.calculate(at)
			if err != nil {
				t.Fatal(err)
			}
			if !summary.Missing || summary.Total != nil {
				t.Fatal("fixture must have an unrelated unpriced holding")
			}
			for _, scope := range []struct{ id, want string }{{"first", tc.first}, {"second", tc.second}, {"empty", "0"}} {
				point := timelinePoint(summary, scope.id)
				if point.Value == nil || point.Missing || point.Value.Exact != scope.want || point.OldObservations {
					t.Fatalf("scope %s: %#v", scope.id, point)
				}
			}
			point := timelinePoint(summary, "missing")
			if !point.Missing || point.Value != nil {
				t.Fatal("missing scoped quote concealed")
			}
			point = timelinePoint(summary, "")
			if !point.Missing || point.Value != nil {
				t.Fatal("global behavior changed")
			}
		})
	}
}

func TestPortfolioTimelineQualityBelongsToSelectedScope(t *testing.T) {
	at, _ := time.Parse(time.RFC3339, "2020-01-03T12:00:00Z")
	old := &Price{At: at.Add(-24 * time.Hour)}
	today := &Price{At: at}
	reference := &Price{At: at, ReferenceDate: "2020-01-02"}
	for _, tc := range []struct {
		name      string
		cash      []CashView
		positions []PositionView
		want      bool
	}{
		{name: "other portfolio stale quote", positions: []PositionView{{PortfolioID: "other", Quote: old}}},
		{name: "selected stale quote", positions: []PositionView{{PortfolioID: "selected", Quote: old}}, want: true},
		{name: "selected same-day quote", positions: []PositionView{{PortfolioID: "selected", Quote: today}}},
		{name: "selected old position FX", positions: []PositionView{{PortfolioID: "selected", FX: []*Price{old}}}, want: true},
		{name: "selected old cash FX", cash: []CashView{{PortfolioID: "selected", FX: old}}, want: true},
		{name: "other portfolio cash FX", cash: []CashView{{PortfolioID: "other", FX: old}}},
		{name: "ECB reference day", cash: []CashView{{PortfolioID: "selected", FX: reference}}, want: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := Summary{At: at, PortfolioValues: map[string]*Value{"selected": valptr(big.NewRat(7, 2), 2)}, Cash: tc.cash, Positions: tc.positions, OldObservations: true}
			point := timelinePoint(s, "selected")
			if point.Value.Exact != "7/2" || point.Missing || point.OldObservations != tc.want {
				t.Fatalf("incorrect scoped quality: %#v", point)
			}
		})
	}
}

func TestTimelinePointsUseDeclaredUTCTimezone(t *testing.T) {
	at, err := time.Parse(time.RFC3339Nano, "2020-01-01T14:00:00.123456789+02:00")
	if err != nil {
		t.Fatal(err)
	}
	summary := Summary{At: at, PortfolioValues: map[string]*Value{"selected": valptr(big.NewRat(1, 1), 2)}}
	for _, scope := range []string{"", "selected"} {
		point := timelinePoint(summary, scope)
		if !point.At.Equal(at) {
			t.Fatal("normalization changed the valuation instant")
		}
		if got := point.At.Format(time.RFC3339Nano); got != "2020-01-01T12:00:00.123456789Z" {
			t.Fatalf("timezone UTC advertised but point encoded as %s", got)
		}
	}
}
