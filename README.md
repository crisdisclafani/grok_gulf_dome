# Gulf Aquaculture — visitor dome concept

A local mirror of the live Kriswa interactive campus demo, with only one addition: the white elliptical Visitor Centre dome, its plaza, and a clickable gold hotspot.

- Open `app/index.html` through a static web server.
- Source: https://www.kriswa.net/demos/gulf_aquaculture/3/app/index.html
- Dome world position: `x=-175, z=60`, ground level `G=1.6`.
- The dome interior is intentionally not built yet.

## Checks

```sh
node --test tests/test_dome.mjs
```

Desktop and 390 px mobile browser checks and screenshots were produced with Playwright against the app served locally.
