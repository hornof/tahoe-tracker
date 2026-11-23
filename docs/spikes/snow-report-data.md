# Spike: where the snow-report numbers come from

PRD issue #5. Spike run on 2026-11-22, Sunday evening Pacific time (about 9 PM PST), from a home connection. Time box about 45 minutes.

## Question

Where can tahoe-tracker get Northstar's, Heavenly's and Kirkwood's snow-report numbers reliably, and what does each source cost to build and keep working? The numbers wanted are the ones each resort's own snow report shows, and the time the report was updated. Later: Hope Valley weather and snow.

The page itself can't read another site, so the fetch runs outside it: a scheduled GitHub Action that writes a JSON file, or a Cloudflare Worker.

## Short answer

The resorts' own pages are the best value by a wide margin. All three Vail sites put the full snow report, a weather forecast and the lift and run status into the HTML as JSON objects (`FR.snowReportData`, `FR.forecasts`, `FR.TerrainStatusFeed`). The objects have the same names and the same fields on all three sites, so **one parser covers all three resorts**. A plain server-side request gets them. A proof-of-concept script of about 60 lines produced every number the PRD asks for.

No third-party source is free, covers all three resorts, and has an API open to a personal project. For weather and snow depth at Hope Valley, the free public APIs from the National Weather Service, CDEC and NRCS SNOTEL all work with no sign-up.

## What I tried, and what I saw

### 1. The resort snow-report pages

URLs (same path on all three hosts):

- `https://www.northstarcalifornia.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx`
- `https://www.skiheavenly.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx`
- `https://www.kirkwood.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx`

**Where the data is:** server-rendered into inline `<script>` tags as `FR.<name> = {...};` JSON objects. I found no separate JSON endpoint the page loads its snow data from. The page refers to `FR.digitalApiBaseUrl = 'https://digital.snow.com/api/'` and `https://ddo.vailresorts.com/api/orchestrators/DDO-In-Orchestrator`, but the snow report needs neither. The objects that matter:

`FR.snowReportData`, observed for Northstar:

```json
{
 "OverallSnowConditions": "Variable",
 "OvernightSnowfall":      {"Inches": "0",  "Centimeters": "0"},
 "TwentyFourHourSnowfall": {"Inches": "0",  "Centimeters": "0"},
 "FortyEightHourSnowfall": {"Inches": "0",  "Centimeters": "0"},
 "SevenDaySnowfall":       {"Inches": "48", "Centimeters": "121"},
 "BaseDepth":              {"Inches": "50", "Centimeters": "127"},
 "CurrentSeason":          {"Inches": "66", "Centimeters": "167"},
 "LastUpdatedText": "Updated November 22, 2026 at 6:31 AM PST"
}
```

Heavenly and Kirkwood had the same keys. Kirkwood: 48 h = 1 in, base 37 in, `OverallSnowConditions` empty, updated 11:32 AM PST. Heavenly: base 25 in, "Early Season", updated 7:02 AM PST.

Points to note:

- Numbers arrive as **strings** ("0", "48").
- The update time is **display text only** ("Updated November 22, 2026 at 6:31 AM PST"), with no ISO timestamp. The parser has to read the text and keep the PST/PDT label.
- `FR.snowReportSettings` differs by resort: Kirkwood shows acres, Heavenly hides lift and run counts. The data is the same either way; only what the resort's own page displays changes.

`FR.forecasts` (on the same page) carries the temperature: `CurrentTempStandard` (°F) and `CurrentTempMetric`, plus a 5-day `ForecastData` with highs and lows and expected day and night snowfall, and `HourlyForecastData`. I observed 28 °F at Northstar, 20 °F at Heavenly and 22 °F at Kirkwood. `CurrentUpdated` was `null`, so the forecast has no timestamp. `FR.weatherReportSettings.OpenSnowLocationId` (138, 135, 142) shows that Vail gets this weather from OpenSnow.

### 2. The lift and terrain status pages

Same hosts, path `/the-mountain/mountain-conditions/terrain-and-lift-status.aspx`. Also server-rendered, as `FR.TerrainStatusFeed`:

- Top-level keys: `Date` (a .NET date such as `"/Date(1795411560682)/"`), `ResortId` (Northstar 12, Heavenly 7, Kirkwood 9), `GroomingAreas`, `Lifts`, `ErrorDetails`, `IsSuccessful`.
- `Lifts[]`: `Id, Name, Status, Type, SortOrder, Mountain, WaitTimeInMinutes, Capacity, OpenTime, CloseTime`. `Status` is a number. `FR.LiftStatusFilters` on the same page lists Closed, Open, On-Hold, Scheduled, Unknown, and the open-source Liftie parser reads it as `0 closed, 1 open, 2 hold, 3 scheduled`.
- `GroomingAreas[].Trails[]`: `Id, Name, Difficulty, IsOpen, IsGroomed, TrailType, ...`.

Observed at about 9:30 PM: Northstar 0/19 lifts open, 36/108 runs open. Heavenly 0/27 lifts open, 8 "scheduled", 10/113 runs open. Kirkwood 0/13 lifts, 1/113 runs (Kirkwood hadn't opened for the season yet; OnTheSnow lists its projected opening as Dec 04). Lift counts at night are all "closed" or "scheduled". The run counts seem to hold the day's terrain. **Lift and run counts need a check during operating hours** before anyone relies on them. I couldn't do that check this evening.

No acres-open figure was found in the feed. Kirkwood's settings show acres on its page, but I didn't trace where that number comes from.

### 3. Do they answer a server-side request?

The sites sit behind Akamai with Bot Manager (cookies `_abck`, `bm_sz`, `ak_bmsc` are set). Results, same Kirkwood URL, from `ua_matrix.py`:

| User-Agent sent | Status | Bytes | Has `FR.snowReportData` |
|---|---|---|---|
| Python default (`Python-urllib/3.x`) | 200 | 432,232 | yes |
| `curl/8.7.1` | 200 | 432,232 | yes |
| `tahoe-tracker/0.1 (+https://tahoe-tracker.hornof.org; personal snow dashboard)` | 200 | 433,326 | yes |
| `node` | 200 | 1,868 | **no** |
| Chrome on macOS string | 200 | 1,868 | **no** |
| Firefox on macOS string | 200 | 1,868 | **no** |

The 1,868-byte answer comes from `server: AkamaiNetStorage` and reads "The system cannot process your request... Please reference the following support ID". It comes back with **status 200**. So:

- An honest, named user agent works. A faked browser user agent is the one that gets blocked, because the request doesn't look like a real browser in other ways. Don't fake one.
- **Check for the JSON object, not the status code.** A block, a layout change, and Vail's "waiting room" queue page all come back as 200 without the data. Liftie's Vail parser follows the waiting-room redirect to `waitingroom.snow.com`; that page is busiest when passes go on sale.
- Cloudflare Workers' `fetch` should set the `User-Agent` explicitly to the honest string.
- **Not tested: requests from GitHub's or Cloudflare's own servers.** Mine came from a home connection. Akamai can treat data-centre addresses differently. Liftie fetches these same pages from a server every minute and works, which is a good sign, but the first build card should run the fetch once from a real GitHub Action (and, if a Worker is chosen, from a Worker) before building the page.

### 4. robots.txt and terms of use

robots.txt is the same on all three (Northstar shown):

```
User-agent: *
Allow: /
Disallow: /404 /500 /cart /account/ /search/search-results /footer/alert   (one per line)
```

The report and lift pages are allowed.

Terms of use: the Vail Resorts Terms of Use appear on `https://www.kirkwood.com/policies?tc_1=1` (with the privacy policy). The parts that bear on this project:

- They grant a licence to "display, print, or download one copy of the Vail Resorts Content on any single computer for your personal, noncommercial use only", on condition that you "do not copy, post, distribute or transmit the Vail Resorts Content on any other website".
- The conduct list forbids interfering with or disrupting the sites. I found **no clause on robots, scraping or automated access**.
- Vail's marks (resort names and logos) may not be used without permission.

What follows, as a reading for a personal project and not legal advice: fetching a few times a day is low load, and robots.txt allows it. Republishing the numbers on a public page at tahoe-tracker.hornof.org goes beyond the "single computer" personal licence, at least on paper. Snowfall figures are facts more than content, but the page should avoid copying Vail text or logos, should link each resort's own report, and could be kept out of search engines (`noindex`) to stay clearly personal. **This is a call for Luke.**

### 5. Third-party sources

| Source | Covers all 3? | API for a personal project? | Cost and sign-up | Freshness observed | Notes |
|---|---|---|---|---|---|
| **Liftie** (liftie.info, open source, BSD-3-Clause) | Yes: `kirkwood`, `northstar`, `heavenly` are in the repo | Has `GET https://liftie.info/api/resort/<resort>`, but it **returned 403 with a Cloudflare "Just a moment..." challenge** to both curl and browser user agents | Free, no sign-up | n/a (blocked) | Lift status only, no snow numbers. Its Vail parser (`lib/tools/vail.js`) reads the same `FR.TerrainStatusFeed` this spike found, which confirms the approach and the status codes. Useful as a reference, not as a source. |
| **OpenSnow** | Yes | API is for "commercial partners" only, custom price by quote, API key, must show "Powered by OpenSnow" | Quote; sign-up | Kirkwood page loaded (Cloudflare, 200), data in a Nuxt payload that is hard to parse (`lifts_open`, `snow_depth`, `precip_snow` keys present) | robots.txt disallows `/publicapi`, `/widget/*`, `/mtn/*` and sets `Content-Signal: ai-train=no, use=reference`. Vail's own forecast is from OpenSnow anyway. |
| **OnTheSnow / Mountain News** | Yes | Partner API (`partner.docs.onthesnow.com`) for media and platforms, "contact us" | Fee-based; sign-up | Kirkwood page answered curl (nginx, 200). Embedded data had `last24`, `last48`, `base`, `updatedAt: 2026-11-20T16:13:18+00:00`, **two days older** than Kirkwood's own report (Nov 22, 11:32 AM) | Its data was stale and is in React server-component data that is awkward to parse. |
| **Weather Unlocked ski API** | Says 3,000+ ski areas; I didn't confirm these three | Free trial, then paid; the pricing page wasn't readable from here | Sign-up needed | Not tested (would need sign-up) | Its product is **mountain forecasts** (base, mid and top elevations, 4 times a day), not the resort's reported base, lifts or update time. |
| **SnoCountry** | Probably | No public API, pricing or terms found | Unknown; contact them | Not tested | A not-for-profit whose feed is resold to media and apps. |
| The Weather Company, Foreca, WorldWeatherOnline | Partly | Commercial APIs; WorldWeatherOnline advertises a small free tier, for forecasts only | Sign-up | Not tested | Forecasts, not resort reports. |

None of them beats the resort pages on cost, coverage or freshness for the numbers Luke asked for.

### 6. Weather and Hope Valley

**National Weather Service API** (`api.weather.gov`): free, no key, asks for a descriptive `User-Agent`. All four points answered 200 (`nws.py`):

| Place | Lat, lon used | NWS office / grid | Nearest observation station (latest obs) |
|---|---|---|---|
| Northstar | 39.2746, -120.1210 | REV 32,97 | KTRK Truckee-Tahoe (−1 °C at 04:55 UTC) |
| Heavenly | 38.9353, -119.9400 | REV 36,81 | LIB08, then KTVL South Lake Tahoe airport |
| Kirkwood | 38.6850, -120.0652 | STO 91,63 (the same grid Liftie uses) | OWNC1 Owens Camp |
| Hope Valley | 38.7700, -119.9300 | REV 35,73 | **HVSC1 "WRC at Hope Valley near Woodfords 4W"** (−3.28 °C at 04:45 UTC) |

The forecast endpoint gave text such as "Tonight: 13F Chance Light Snow then Partly Cloudy" for Hope Valley, with `updateTime`. `/points` sets `Cache-Control: max-age=86400`, so grid lookups can be stored once in config.

**Snow depth near Carson Pass and Hope Valley.** Both are free and need no key. Readings were taken the evening of 2026-11-22.

- **CDEC** (California DWR), `https://cdec.water.ca.gov/dynamicapp/req/JSONDataServlet?Stations=CAP&SensorNums=18,3&dur_code=H&Start=...&End=...` returns JSON rows (`stationId, SENSOR_NUM, sensorType, date, value, units`). Sensor 18 is snow depth and sensor 3 is snow water content. Hourly; the last reading was 20:00 PST.
  - CAP Caples Lake, 7,920 ft, 38.711, -120.042 (next to Kirkwood): depth **34 in**, SWE 2.77 in
  - BLK Blue Lakes, 7,990 ft, 38.608, -119.925: depth 26 in
  - HVN Heavenly Valley, 8,800 ft: depth 18 in
  - FRN Forni Ridge, 7,600 ft: depth 31 in
  - EBB (Ebbetts Pass): 39 in
- **NRCS SNOTEL** (AWDB REST API), `https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/data?stationTriplets=1051:CA:SNTL&elements=SNWD,WTEQ&duration=HOURLY&...`:
  - **1051 Burnside Lake**, 8,180 ft, 38.719, -119.894, the closest SNOTEL to Hope Valley: depth **28 in**, SWE 5.5 in at 21:00
  - 508 Hagans Meadow, 7,740 ft, 38.852, -119.937: 18 in
  - 462 Ebbetts Pass, 8,660 ft: 39 in
  - 697 Poison Flat, 7,730 ft: 24 in

The difference between successive hourly depth readings gives a measured new-snow figure. Sensors are noisy, though (settling, wind), so treat it as approximate.

## Options

### A. Resort pages, scheduled GitHub Action writes `data.json` (recommended)

An Action runs on a schedule, every 30–60 minutes from about 5 AM to 6 PM Pacific, and fetches 6 pages: snow report and lift status for 3 resorts. One parser extracts the three `FR.*` objects and writes one `data.json` for the static page.

- **Fit:** every number the PRD asks for. Temperature comes from `FR.forecasts` (which is OpenSnow data). The update time comes from the resort's own text.
- **Work:** small. The parser is about 60 lines (`vail_report.py` is a working proof). Add tests on saved HTML fixtures. The real work is error handling: detect the 1,868-byte Akamai page and the waiting room, keep the last good data, and show its age on the page.
- **Upkeep:** breaks if Vail renames the `FR.*` objects or tightens Akamai. When that happens it fails loudly (object missing), so it is easy to notice; Liftie's parser is a second set of eyes on the same markup. GitHub turns scheduled workflows off after 60 days without repository activity in a public repo, so the Action should commit `data.json` (or something else must keep the repo active). GitHub's cron can run late by several minutes, which is fine here.
- **Load and terms:** about 6 requests per run, a few dozen a day. robots.txt allows it. Terms caveat as in section 4.

### B. Resort pages through a Cloudflare Worker (on request or on a Cron Trigger)

The same parser in JavaScript in a Worker. Either it fetches on each page view, with caching, or a Cron Trigger fills KV.

- **Fit:** the same as A, and fresher on demand.
- **Work:** a little more than A: Worker config and a KV binding, though no secrets. Fetching on each view would multiply requests to Vail and tie the page's speed to Akamai's, so a cache of 15 minutes or more would be needed. Outbound requests come from Cloudflare's addresses, and **Akamai's view of them is untested**.
- **Upkeep:** the same parser risk as A, plus Worker deploys. No 60-day cron shutdown.

### C. A third-party API (OpenSnow, OnTheSnow, Weather Unlocked, SnoCountry)

- **Fit:** OnTheSnow's data was two days stale. Weather Unlocked is forecasts, not reports.
- **Work and cost:** sign-ups, commercial-partner gates, quotes or paid plans; attribution rules. Not a fit for a free personal page, and the spike didn't sign up for any.

### D. Liftie for lifts

Its API was behind a Cloudflare challenge (403), so it isn't usable server-side. Its open-source Vail parser is a good reference for option A.

### E. Weather and Hope Valley (add-on, any option)

NWS `api.weather.gov` for the forecast and the latest observation at HVSC1. CDEC CAP (Caples Lake) and SNOTEL 1051 (Burnside Lake) for measured snow depth. All free, keyless, JSON, and they answered on the first try. About a day of work to add to option A's Action.

## Recommendation

**Option A is clearly the best value for the effort:** a scheduled GitHub Action fetches the six Vail pages with an honest user agent, parses the three `FR.*` objects with one parser, and commits `data.json` to the static site. Add NWS and CDEC/SNOTEL to the same Action when Hope Valley comes. Before building the page, the first card should:

1. Run the fetch once from a real GitHub Action runner and confirm the pages answer as they did from home (the one untested risk).
2. Check the lift and run counts during operating hours.
3. Luke's calls, from his review of PR #6: personal use, no special handling for the terms; fetch once an hour; show what the resort's report shows.

## Files in the spike scratch folder (not for the repo)

- `probe.py`: fetches URLs with curl-like and browser user agents and prints status and headers.
- `ua_matrix.py`: the user-agent table in section 3.
- `extract.py`, `terrain.py`: pull and summarise the `FR.*` objects from saved pages.
- `vail_report.py`: the one-parser proof of concept for all three resorts.
- `nws.py`, `snow_stations.py`: NWS, CDEC and SNOTEL probes.
- `context.py`: prints text around a phrase in a saved page (used for the terms).
