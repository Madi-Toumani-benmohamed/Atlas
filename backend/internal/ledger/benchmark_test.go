package ledger

import (
	"fmt"
	"math/big"
	"testing"
	"time"
)

// Synthetic engine profiles only: these are not a dashboard SLO or a claim
// about a user's actual history or target machine.
var replayBenchmarkBook *Book

func BenchmarkReplaySyntheticHistory(b *testing.B) {
	for _, trips := range []int{100, 1000, 5000} {
		for _, reverse := range []bool{false, true} {
			order := "ordered"
			if reverse {
				order = "reverse"
			}
			b.Run(fmt.Sprintf("trades_%d/%s", trips, order), func(b *testing.B) {
				start := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
				events := make([]Event, 0, 1+trips*2)
				events = append(events, Event{Kind: "deposit", AccountID: "synthetic-account", Amount: "1000000", At: start.Format(time.RFC3339Nano)})
				for i := 0; i < trips; i++ {
					events = append(events,
						Event{Kind: "buy", AccountID: "synthetic-account", AssetID: "synthetic-asset", Quantity: "1", Price: "100", Fees: "1", At: start.Add(time.Duration(i*2+1) * time.Second).Format(time.RFC3339Nano)},
						Event{Kind: "sell", AccountID: "synthetic-account", AssetID: "synthetic-asset", Quantity: "1", Price: "105", Fees: "1", At: start.Add(time.Duration(i*2+2) * time.Second).Format(time.RFC3339Nano)})
				}
				if reverse {
					for i, j := 0, len(events)-1; i < j; i, j = i+1, j-1 {
						events[i], events[j] = events[j], events[i]
					}
				}
				accounts := map[string]Account{"synthetic-account": {Currency: "EUR"}}
				book, err := Replay(events, accounts)
				if err != nil {
					b.Fatal(err)
				}
				position := book.Positions["synthetic-account"]["synthetic-asset"]
				if book.Cash["synthetic-account"].Cmp(big.NewRat(1000000+3*int64(trips), 1)) != 0 || position.Quantity.Sign() != 0 || position.Cost.Sign() != 0 || position.Realized.Cmp(big.NewRat(3*int64(trips), 1)) != 0 || book.FeesEUR.Cmp(big.NewRat(2*int64(trips), 1)) != 0 {
					b.Fatal("synthetic profile violates expected exact cash, quantity, cost, realized or fees")
				}
				b.ReportAllocs()
				b.ResetTimer()
				b.ReportMetric(float64(len(events)), "events/op")
				for i := 0; i < b.N; i++ {
					replayBenchmarkBook, err = Replay(events, accounts)
					if err != nil {
						b.Fatal(err)
					}
				}
			})
		}
	}
}
