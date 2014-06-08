# Abungo

Simple chat app made with node.js and Socket.IO.

## Simple and anonymous

The server doesn't store any information about the users or keep logs. It simply relays the data from one client to the rest.

## Responsive layout

The Abungo client is minimally designed and adapts to different screen sizes.

![Abungo on a PC](http://i.imgur.com/sCtiSAx.png)

![Abungo on a smartphone](http://i.imgur.com/rDmaM1q.png)

## Running Abungo

First, you'll need to download and install [node.js](http://nodejs.org) if you haven't already.

`cd` to the Abungo directory and install Socket.IO and Express:

```bash
npm install --save socket.io
npm install --save express

# save option automatically adds the package to package.json
```

After you have everything installed, run `node server` from the Abungo directory. Navigate to `http://localhost:3000` in your browser to see it in action.
