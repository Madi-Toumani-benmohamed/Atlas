const zero = { exact: "0", display: "0.00", approximate: false };
// Empty, synthetic responses for identity-only browser/accessibility tests.
export function emptyResponse(path) {
  if (path === "/api/v1/summary")
    return {
      at: "2020-01-01T12:00:00Z",
      total_value_eur: zero,
      known_value_eur: zero,
      result_eur: null,
      external_flows_eur: zero,
      partial_history: false,
      missing_valuation: false,
      positions: [],
      consolidated_assets: [],
      cash: [],
      allocation_eur: {},
      operation_count: 0,
      recorded_income_eur: zero,
      recorded_fees_eur: zero,
      portfolio_values_eur: {},
      account_values_eur: {},
      daily_market_movers: [],
      uses_prior_date_observations: false,
    };
  if (
    path === "/api/v1/portfolios" ||
    path === "/api/v1/assets" ||
    path.endsWith("/accounts")
  )
    return { items: [], next_cursor: "" };
  if (path === "/api/v1/operations" || path === "/api/v1/prices")
    return { items: [] };
  return undefined;
}
