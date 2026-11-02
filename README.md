# Keryke

A news site that shows how outlets across the political spectrum cover the same story, with a
world map, Duolingo-style lessons and friend leaderboards. *Keryke* comes from the Greek for "herald".

## Run it

Double-click `index.html`. There is nothing to install.

Double-click `refresh-news.bat` to collect the latest headlines, then reload the page. It takes under a minute.

## The tabs

| Tab | What it does |
|---|---|
| Search | Finds stories, lessons, countries and data rankings together, plus live web results from GDELT |
| For You | Ranks stories by followed topics, countries and reading history, and says why each one appears |
| Main | Stories ranked by breadth of coverage, with blindspots and each side's headline |
| World | Selecting a country zooms in and shows its news and data. Selecting several finds news connecting them, filterable by topic. Dots mark war and security coverage |
| Learn | Politics, economics, social studies and history lessons with hearts, XP, streaks and five exercise types |
| Social | Twitter-style comments on news: posts, replies, likes, reposts, follows and notifications. Needs a server: see SETUP-COMMUNITY.md |
| Settings | Language, news editions, interests, theme and backups |

## How it works

- `tools/update-news.ps1` reads the RSS feeds in `tools/sources.json` and writes `data/news.js`.
  It stores headlines, short excerpts and links. Readers go to the publisher for the full article.
- `tools/update-world.ps1` rebuilds `data/world.js` from the World Bank and re-downloads the map, libraries and fonts.
- `js/engine.js` tags each article with topics and countries, groups matching headlines into stories and ranks them.
- Reading progress and preferences are kept in the browser's `localStorage`.
- Social uses Supabase when `js/config.js` is filled in, and a single-device preview otherwise (`js/social-backend.js`, `supabase/schema.sql`).

To add an outlet or correct a rating, edit `tools/sources.json` (`lean` runs from -2, left, to 2, right;
`null` keeps an outlet off the spectrum) and run the refresh.

## Known limits

- **Bias ratings are starter estimates.** They are not audited or licensed. See `#/about` in the app.
- **Lesson text is English only.** The interface is in English, Portuguese, Spanish and French.
- **News only updates when the refresh runs.** Automatic updates need hosting with a scheduled job.
- **Lesson progress stays in one browser,** even after signing in to Social.
- **Hotspot dots show coverage, not verified conflicts.** They count war and security stories in the collection.
- **Country connections are text matches.** They need one article to name both countries, and the archive builds up to 21 days as you refresh.
- **Map borders are Natural Earth's de facto lines,** which for example draw Crimea as part of Russia. Decide if that is acceptable before publishing.
- **Story matching is keyword based.** Expect some missed matches, an occasional wrong one and some off-topic stories.
- **Feeds change.** The refresh prints any outlet that returned nothing.
- **Check publishers' terms before going public.** Many feeds are licensed for personal, non-commercial use.

## Tests

`powershell -ExecutionPolicy Bypass -File tests\run-smoke.ps1` drives the real interface in headless Edge. See SETUP-COMMUNITY.md for the database test.
