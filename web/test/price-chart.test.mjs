import {test} from "node:test";
import assert from "node:assert/strict";
import {pricePlot,PRICE_CHART_LIMIT} from "../src/price-chart.ts";
const from="2020-01-01T12:00:00Z",to="2020-01-02T12:00:00Z",asOf="2020-01-10T12:00:00Z";
const row=(id,value,observed_at=from,currency="EUR",asset_id="a")=>({id,value,observed_at,currency,asset_id,source:"Synthetic test observation"});
test("SVG projection preserves exact tiny and large prices",()=>{
 const records=[row("min","1000000000000000000.000000000000000001"),row("max","1000000000000000000.000000000000000002",to)];
 const plot=pricePlot(records,"a","EUR",from,to,asOf);
 assert.equal(plot.state,"ready");assert.equal(plot.min,records[0].value);assert.equal(plot.max,records[1].value);
 assert.deepEqual(plot.points.map(p=>[p.x,p.y]),[[60,240],[940,50]]);
 assert.deepEqual(plot.points.map(p=>p.value),records.map(p=>p.value));
 const tiny=pricePlot([row("tiny","0.000000000000000001")],"a","EUR",from,to,asOf);
 assert.equal(tiny.points[0].value,"0.000000000000000001");assert.equal(tiny.points[0].y,145);
});
test("range filtering preserves nanoseconds and timezone offsets",()=>{
 const end="2020-01-01T12:00:00.000000001Z";
 const plot=pricePlot([row("one","1","2020-01-01T14:00:00+02:00"),row("two","2",end),row("outside","3","2020-01-01T12:00:00.000000002Z"),row("foreign","999",from,"EUR","other"),row("currency","777",from,"USD"),row("fx","0.5",from,"USD","")],"a","EUR",from,end,asOf);
 assert.equal(plot.state,"ready");assert.deepEqual(plot.points.map(p=>p.id),["one","two"]);
 assert.equal(plot.points[0].observed_at,"2020-01-01T14:00:00+02:00");
 assert.deepEqual(plot.points.map(p=>p.x),[60,940]);
});
test("empty, invalid and unavailable inputs never generate a zero series",()=>{
 assert.equal(pricePlot([],"a","EUR",from,to,asOf).state,"empty");
 assert.equal(pricePlot([row("usd","1",from,"USD")],"a","EUR",from,to,asOf).state,"empty");
 assert.equal(pricePlot([],"a","",from,to,asOf).code,"selection");
 for(const [start,end,now] of [[to,from,asOf],[from,"2022-01-02T12:00:00Z","2023-01-01T00:00:00Z"],[from,to,from]])assert.equal(pricePlot([],"a","EUR",start,end,now).code,"range");
 assert.equal(pricePlot([],"a","EUR","invalid",to,asOf).code,"time");
 assert.equal(pricePlot([],"a","EUR",from,to,undefined).code,"time");
 for(const value of ["0","-1","1e-18","0.0000000000000000001","9".repeat(37)])assert.equal(pricePlot([row("invalid",value)],"a","EUR",from,to,asOf).code,"observation");
});
test("constant and same-instant records remain observations without interpolation",()=>{
 const plot=pricePlot([row("first","5"),row("second","5")],"a","EUR",from,from,asOf);
 assert.equal(plot.state,"ready");assert.equal(plot.points.length,2);
 assert.deepEqual(plot.points.map(p=>[p.x,p.y]),[[500,145],[500,145]]);
});
test("dense ranges are rejected without sampling or altering source observations",()=>{
 const records=Array.from({length:PRICE_CHART_LIMIT+1},(_,i)=>row(String(i),"1"));
 assert.equal(pricePlot(records,"a","EUR",from,to,asOf).code,"limit");
 assert.equal(records.length,PRICE_CHART_LIMIT+1);
 const plot=pricePlot(records.slice(0,PRICE_CHART_LIMIT),"a","EUR",from,to,asOf);
 assert.equal(plot.state,"ready");assert.equal(plot.points.length,PRICE_CHART_LIMIT);
});
