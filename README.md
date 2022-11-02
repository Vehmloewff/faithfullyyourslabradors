# SyncJS

## First steps

1. Install dependencies: `npm install`
2. Start dev server: `npm run dev`
3. View in browser at http://localhost:3000

Learn more at: www.syncjs.dev/docs

## Changes Made

- Added MONGO_URI to the list of required env vars
- Fixed references to non-existent vars in `sync.css`
	- `--h1-family` -> `h1-font-family`
- Added $ argument to `_404` fn. This prevents a "cannot access $ before initialization" error

## Weird Require Error

```
Cannot find module ~/ ...
```

To fix, run:

```shell
rm -rf node_modules && yarn
```
