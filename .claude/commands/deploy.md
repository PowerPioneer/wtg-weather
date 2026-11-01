Deploy `main` to the v2 production box, following `infra/CLAUDE.md` § "Deploying".
There is no image registry: compose builds from source on the box. Stop and ask
the user before any step that touches the live `wheretogoforgreatweather.com`
domain beyond this sequence (DNS, Caddy, bunny, `.env`).

1. **Right box, clean state.** `ssh root@51.15.37.62`, `cd /opt/wtg-weather`.
   `hostname` must be `wtg-weather-v2` — `51.159.164.178` is the old v1 box and
   never takes v2 code. Confirm `git status` is clean, the branch is `main`,
   no pipeline job is running (`ps -eo pid,cmd | grep "[b]in/wtg"`), and
   `df -h /opt/wtg-weather/pipeline/data` has room for two web images (~8 GB).
2. `git pull --ff-only`
3. API: `docker compose build api`; if migrations landed,
   `docker compose run --rm api alembic upgrade head` **before** `up`
   (`alembic current` shows what is pending); `docker compose up -d api`; wait
   for `healthy`.
4. Web: `./infra/scripts/build-web.sh` — never `docker compose build web`, or
   the country pages do not pre-render. Run it detached
   (`setsid nohup … > /var/log/wtg-build-web.log 2>&1 < /dev/null &`), wait for
   `build-web OK` and the pre-rendered page count, then `docker compose up -d web`.
   After a `wtg publish api-data` with no `web/` change, use `NO_CACHE=1`.
5. Check: both containers `healthy`; `/`, `/map`, a country page and `/login`
   return 200; the map paints in a browser.
6. `docker image prune -f` — every build leaves the previous images dangling
   (~3.6 GB per web build). Dangling only; rollback is a rebuild at the
   previous commit, not an old image.
