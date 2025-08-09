
# Drawing Guess-Off — Client

Static site that connects to the real-time server.

## Configure server URL

Edit `client/config.js`:

```js
const SERVER_URL = "https://your-server.onrender.com"; // put your Render/Heroku URL
```

## Run locally (static)

Just open `client/index.html` in a browser **after** starting the server locally.

## Deploy to GitHub Pages

1) Create a new GitHub repo and push the whole project.
2) In GitHub, go to **Settings → Pages → Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: **main** (or default) and folder **/client**
3) The site will be available at https://YOUR_USER.github.io/YOUR_REPO
4) Make sure `config.js` points to your live server URL.
