# Spike: showing the Tahoe resort webcams on tahoe-tracker.hornof.org

Spike for PRD issue #5. Run on 2026-11-22, about 21:30 to 22:00 Pacific (night at the resorts, so the images were dark but the cams were up). No product code; test scripts stayed in the spike's scratch folder.

## Question

For each resort's mountain cams (Northstar, Heavenly, Kirkwood), can a page on another site (tahoe-tracker.hornof.org, static pages on Cloudflare) show them live? If not, can it show a still that is at most a few minutes old? What does each way cost to build and keep working? Also: can the Desolation Hotel Hope Valley YouTube cam be embedded later?

## Short answer

Yes to both, with no server. All ten resort cams are hosted by one company, Brownrice Internet, not by Vail. Brownrice's player pages, still images and HLS video streams all load from another site: no frame-blocking headers, no Referer check, and `Access-Control-Allow-Origin: *` on everything. A plain static page can iframe the Brownrice player (live video), or hot-link the stills with `<img>` (updated about every 2 minutes). The Hope Valley YouTube stream allows embedding.

The one real limit is the Vail Terms of Use, which forbid copying their content onto other sites. Embedding or hot-linking keeps the bytes coming from Brownrice; copying the stills to our own server (Worker or Action) is the clearer breach, and it is also more work. So the cheapest option is also the cleanest one.

## What I tried, and what I saw

### 1. The cams pages

Fetched `https://<host>/the-mountain/mountain-conditions/mountain-cams.aspx` on all three hosts, twice each: once with a full desktop-Chrome User-Agent string (and no other browser headers) and once with `curl/8.7.1`.

| Request | Result on all three hosts |
|---|---|
| Chrome UA, no other browser headers | `200`, but a 1,868-byte page from `Server: AkamaiNetStorage` saying "The system cannot process your request", with a support ID. This is Akamai bot protection catching a UA that claims Chrome without behaving like it. |
| `curl/8.7.1` UA | `200`, full page (292-308 KB). Sets Akamai Bot Manager cookies (`_abck`, `bm_sz`) and `TS...` cookies. |

Response headers on the real pages (all three identical):

```
x-frame-options: SAMEORIGIN, SAMEORIGIN
content-security-policy: frame-ancestors 'self' https://*.adobe.com https://*.navisperformance.com;
```

So the resort cams pages themselves can't be put in an iframe on another site. That doesn't matter, because the cams inside them are separate Brownrice iframes (below). It does mean anything that scrapes the resort pages sits behind Akamai Bot Manager and can break without warning. Nothing in the options below needs to fetch a resort page.

### 2. The cams

Each cams page holds a list of `<iframe src="//player.brownrice.com/embed/<name>" referrerpolicy="origin">`. Names from the page's `<h5>` titles:

| Resort | Cam (title on the resort page) | Brownrice name | Player (iframe) | Still (always current) | Still (direct file) |
|---|---|---|---|---|---|
| Northstar | Northstar Snow Stake | `northstarsnowstake` | `https://player.brownrice.com/embed/northstarsnowstake` | `https://player.brownrice.com/snapshot/northstarsnowstake` | `https://live4.brownrice.com/cam-images/northstarsnowstake.jpg` |
| Northstar | Northstar Mt. Pluto Summit | `northstarspluto` | `.../embed/northstarspluto` | `.../snapshot/northstarspluto` | `https://live9.brownrice.com/cam-images/northstarspluto.jpg` |
| Northstar | Northstar Mid-mountain Cam | `northstarmidmountain` | `.../embed/northstarmidmountain` | `.../snapshot/northstarmidmountain` | `https://live9.brownrice.com/cam-images/northstarmidmountain.jpg` |
| Northstar | Northstar Village | `northstarvillage` | `.../embed/northstarvillage` | `.../snapshot/northstarvillage` | `https://live5.brownrice.com/cam-images/northstarvillage.jpg` |
| Heavenly | Top of Dipper Cam | `heavenlydipper` | `.../embed/heavenlydipper` | `.../snapshot/heavenlydipper` | `https://live9.brownrice.com/cam-images/heavenlydipper.jpg` |
| Heavenly | Midstation at the Gondola | `heavenlymidstation` | `.../embed/heavenlymidstation` | `.../snapshot/heavenlymidstation` | `https://streamer2.brownrice.com/cam-images/heavenlymidstation.jpg` |
| Heavenly | Top of Tram | `heavenlytram` | `.../embed/heavenlytram` | `.../snapshot/heavenlytram` | `https://live9.brownrice.com/cam-images/heavenlytram.jpg` |
| Heavenly | East Peak | `heavenlyeastpeak` | `.../embed/heavenlyeastpeak` | `.../snapshot/heavenlyeastpeak` | `https://live7.brownrice.com/cam-images/heavenlyeastpeak.jpg` |
| Kirkwood | Cornice Cam | `kirkwoodcornice` | `.../embed/kirkwoodcornice` | `.../snapshot/kirkwoodcornice` | `https://live5.brownrice.com/cam-images/kirkwoodcornice.jpg` |
| Kirkwood | Red Cliffs Cam | `kirkwoodredcliffs` | `.../embed/kirkwoodredcliffs` | `.../snapshot/kirkwoodredcliffs` | `https://live7.brownrice.com/cam-images/kirkwoodredcliffs.jpg` |

Notes:
- Every cam is Brownrice. No Roundshot, Prism, HDRelay, YouTube or Vail-hosted cams were on these three pages.
- Kirkwood's page lists "Red Cliffs Cam" twice, both pointing at `kirkwoodredcliffs` (a duplicate on Vail's page, so Kirkwood has two distinct cams).
- The `liveN.brownrice.com` host behind each cam is not stable. The same cam came back on different hosts within minutes (`kirkwoodcornice`'s player script came from live6, live8p and live5 on three fetches; `heavenlymidstation` on live2, live3 and live6). So hard-code only `player.brownrice.com/embed/<name>` and `player.brownrice.com/snapshot/<name>`; never the `liveN` / `cam-images` URLs.
- The HLS playlist per cam is `https://<server>:444/<name>/<name>.stream/main_playlist.m3u8`, but the server moves too (see above).

### 3. Can the player go in an iframe on another site?

`player.brownrice.com/embed/<name>`, fetched for all ten cams, with no Referer and with `Referer: https://tahoe-tracker.hornof.org/`: all `200`, same body either way, and no `X-Frame-Options` or `Content-Security-Policy` header at all. `Access-Control-Allow-Origin: *`.

The embed page loads a script from `https://liveN.brownrice.com/?sn=<name>&em=1&...&framed=true`. I fetched it with four Referers (none, tahoe-tracker, the Brownrice player, kirkwood.com): identical `200` each time. The script has its own allow-list check: it reads `document.referrer`, and if the cam's `allowed_urls` is set and the parent page isn't on it, it shows a "webcam-protected" poster and an alert "This web site is not allowed to embed this webcam". For all ten cams, `allowed_urls = ""`, so the check is off today. The owner can turn it on per cam at any time, and then an iframe on tahoe-tracker would stop playing.

Other things in the player script that matter:
- `defaultPausetime = 600`: the live player pauses itself after 10 minutes of playing. A page left open all day would need a click (or a reload) to resume.
- It autoplays muted, and shows a live viewer count.
- It loads Google Analytics (`G-ZMDJMNVFHZ`) inside the iframe.

#### Autoplay is set per cam, by Brownrice (checked 2026-11-24, card #22)

Why some cams play on arrival and others need a click on the play button: autoplay is a per-cam setting on Brownrice's side, `autostart` in each cam's player script. The player takes no override from the page that embeds it, so tahoe-tracker can't turn it on.

- Autoplay on: Mid Mountain, Top of Dipper, Top of Tram, Cornice, Red Cliffs.
- Autoplay off (needs a click): Village, Snow Stake, Pluto, Mid Station, East Peak.

Since card #22 the home page shows Mid Mountain for Northstar (it showed Village), so all three home-page cams autoplay. The cams in the resort views stay as they are. The only workaround is our own video player on the raw stream (option C below), which is fragile and a grey area under the terms.

Real-browser check: a test page served from `http://127.0.0.1:8765` (a foreign origin) in the Claude desktop browser pane loaded the Kirkwood Cornice player in an iframe and it played live ("LIVE", 89 viewers). The Hope Valley YouTube iframe loaded its player too.

### 4. Direct still images

- `https://player.brownrice.com/snapshot/<name>`: `200 image/jpeg`, `Access-Control-Allow-Origin: *`, no `Last-Modified`, no `ETag`, no `Cache-Control`. Its bytes match the current `cam-images/<name>.jpg` exactly (same SHA-1), so it serves the latest still; it is the stable URL to use.
- `https://<server>/cam-images/<name>.jpg`: `200 image/jpeg`, has `Last-Modified` and `ETag`, `Access-Control-Allow-Origin: *`.
- Referer check: none. With no Referer, with `Referer: https://tahoe-tracker.hornof.org/`, with the player's URL and with kirkwood.com, the snapshot came back `200` with identical bytes.
- Sizes: mostly 1920x1080, 45-200 KB at night. The Northstar Snow Stake still is 3840x2160 (about 200 KB).
- Python's TLS store rejected `streamer2.brownrice.com` (incomplete certificate chain); `curl` (macOS keychain) accepted it and got `200`. Browsers loaded it fine. A Worker would need a check here; the `snapshot` URL avoids that host.
- Real-browser check: two `<img>` tags on the 127.0.0.1 test page loaded the snapshot and a cam-images JPEG (3840x2160 and 1920x1080).

How often they update: across two rounds 150 s apart, every still changed (new bytes). Then I polled each `cam-images` JPEG's `Last-Modified` every 30 s for about 7 minutes (times GMT, 2026-11-23):

| Cam | Last-Modified values seen |
|---|---|
| northstarsnowstake | 05:36:33, 05:38:29, 05:40:33, 05:42:33 |
| northstarspluto | 05:36:32, 05:38:32, 05:40:39, 05:42:33 |
| northstarmidmountain | 05:36:31, 05:38:31, 05:40:38, 05:42:32 |
| northstarvillage | 05:36:35, 05:38:36, 05:40:56, 05:42:47 |
| heavenlydipper | 05:36:19, 05:38:19, 05:40:26, 05:42:20 |
| heavenlymidstation | 05:35:36, 05:37:44, 05:39:52, 05:42:00 |
| heavenlytram | 05:36:20, 05:38:20, 05:40:27, 05:42:21 |
| heavenlyeastpeak | 05:36:23, 05:38:22, 05:40:23, 05:42:29 |
| kirkwoodcornice | 05:36:29, 05:38:29, 05:40:28, 05:42:29 |
| kirkwoodredcliffs | 05:36:27, 05:38:28, 05:40:29, 05:42:34 |

So the stills refresh about every 2 minutes, which meets "at most a few minutes old" with no server.

### 5. HLS streams from another site

Each `main_playlist.m3u8`, fetched with `Origin: https://tahoe-tracker.hornof.org`, returned `200 application/vnd.apple.mpegurl` and `Access-Control-Allow-Origin: *`. On the 127.0.0.1 test page, hls.js 1.5.17 played the Heavenly Top of Dipper stream in our own `<video>` element (1920x1080). Stream bitrates from the playlists run from about 0.2 Mbit/s (Northstar Village) to 4.4 Mbit/s (Northstar Snow Stake).

Using the HLS URL directly skips Brownrice's 10-minute pause and Google Analytics, but the URL's server moves between `liveN` hosts, so the page would have to read it from the player script first, which is brittle. Not worth it for a first version.

### 6. Bot protection, for a Worker or GitHub Action

- Resort sites (`www.*.com`): Akamai Bot Manager. Blocked a spoofed Chrome UA; let `curl/8.7.1` through. I didn't test from Cloudflare or GitHub IP ranges. Assume it can start blocking at any time.
- Brownrice (`player.brownrice.com`, `liveN.brownrice.com`): plain Apache or Express, no bot protection seen, no 403 for `curl`. A Worker or Action fetching snapshots would work today.

### 7. Hope Valley / Desolation Hotel (YouTube)

- `https://desolationhotel.com/hope-valley/live-stream` ("Snow Cam" in the site's menu) embeds `https://www.youtube.com/embed/live_stream?channel=UCcdgoCyjN0TFSXycjkridBQ`.
- That channel's current live video is `4A9UuHdpvw0`, titled "Live Leaf Cam - Desolation Hotel Hope Valley".
- YouTube oEmbed for `https://www.youtube.com/watch?v=4A9UuHdpvw0`: `200` with an iframe (YouTube's oEmbed answers 401 for a video whose embedding is off; not observed here). The watch page shows `"playableInEmbed": true` and `isLiveContent: true`. `https://www.youtube.com/embed/4A9UuHdpvw0` has no `X-Frame-Options`.
- Embed with the channel form (`embed/live_stream?channel=...`), as the hotel does, not with the video ID: the ID changes whenever the stream restarts (and the "Leaf Cam" title suggests the hotel renames it per season).

### 8. Terms of use

- Vail Resorts Terms of Use (linked from every cams page, `/policies?tc_1=4`): "Vail Resorts Content" covers "text, graphics, video, audio, or other content provided by Vail Resorts or its partners". The licence is for "personal, noncommercial use only", provided you "do not copy, post, distribute or transmit the Vail Resorts Content on any other website". Nothing addresses framing, linking or webcams specifically.
- Brownrice Terms of Service (`brownrice.com/pop_tos`): nothing about third parties embedding or reusing cam streams. Their embed script has a per-cam allow-list feature, off for all ten cams.
- YouTube: embedding is allowed by the owner's setting (oEmbed 200); YouTube's own terms permit use of the embedded player.

Reading: hot-linking or iframing keeps the content on Brownrice's servers and only frames it; that is a grey area, low risk for a personal, non-commercial page. Copying stills to our own storage (a Worker cache, a GitHub Action committing JPEGs, R2) is "copy, post ... on any other website", which the terms forbid. Not legal advice; a flag for Luke.

## Options

| Option | Matches the request | Work to build | Work to keep working | Main risk |
|---|---|---|---|---|
| A. Iframe the Brownrice players (live) | Best: live video, all ten cams, plus Hope Valley via YouTube iframe | Small: a static HTML grid of `<iframe src="https://player.brownrice.com/embed/<name>">`. An hour or two. | Near zero. Update the cam list if Vail adds or renames cams. | Ten live players at once is heavy (up to ~15 Mbit/s if all play) and each pauses after 10 min. Breaks if Brownrice turns on `allowed_urls` for these cams. |
| B. Hot-linked stills, refreshed by the page | Good: every still at most ~2-3 min old | Small: `<img src="https://player.brownrice.com/snapshot/<name>?t=<now>">`, re-set every 60-120 s with a few lines of JS. An hour or two. | Near zero. | Brownrice could add a Referer check on snapshots (none today). |
| A+B. Stills grid, click a cam to open its live player | Best fit for a laptop dashboard: light at rest, live on demand | A and B together, half a day | Near zero | Same as A and B |
| C. Our own player on the HLS streams (hls.js) | Live, our own controls, no 10-min pause, no GA | Medium: parse each cam's player script for the current server, then hls.js | Ongoing: breaks whenever Brownrice changes its script or moves servers | Brittle; relies on undocumented internals |
| D. Cloudflare Worker that proxies or caches stills | Same as B | Medium: a Worker, cron trigger, R2 or cache, plus a route | Some: a deployed service, secrets, logs | Copies Vail content onto our site (terms); Brownrice TLS chain issue on one host. Buys nothing over B today. |
| E. Scheduled GitHub Action copying stills into the repo or Pages | Worse: Actions cron runs at best every 5 min and often late; stills 5-15 min old | Medium | Ongoing: repo bloat from JPEG commits, Actions minutes | Same terms problem as D; staler than B |

## Recommendation

Build A+B, with no server: a grid of hot-linked `player.brownrice.com/snapshot/<name>` stills refreshed every minute or two, where clicking a cam swaps in (or opens) its `player.brownrice.com/embed/<name>` live iframe. Add Hope Valley later as a `youtube.com/embed/live_stream?channel=UCcdgoCyjN0TFSXycjkridBQ` iframe. This is clearly the best value: it meets "live if possible" and "a still at most a few minutes old" on a plain static Cloudflare page, it's a few hours of work, it needs no upkeep beyond the cam list, and it doesn't copy Vail's content onto our site.

If only one is wanted, B alone is the safest base: light, always fresh, and it degrades well. Keep D (Worker) in reserve for the day Brownrice adds a Referer check on stills; it's an afternoon's work then, not now.

Worth a line in the TDD:
- Use only the `player.brownrice.com/embed/` and `/snapshot/` URLs; never the `liveN` hosts.
- Show a "last updated" time per still. The snapshot URL has no `Last-Modified`, so the page can only show when it last fetched; good enough.
- Handle a broken image (cam offline) with a placeholder.
- A test that fetches each snapshot URL and checks for `200 image/jpeg` would catch a renamed or removed cam early.
