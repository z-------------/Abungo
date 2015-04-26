# Abungo

Simple chat app made with node.js and Socket.IO.

## Simple and anonymous

The server doesn't store any information about the users or keep logs. It simply relays the data from one client to the rest. Users can chat privately in chat rooms. The default room is "yeya".

## Responsive layout

The Abungo client was designed with minimal design principles in mind and adapts to different screen sizes.

![Abungo on a PC](http://i.imgur.com/uHIjlEu.png)

![Abungo on a mobile device](http://i.imgur.com/BzgCj67.png)

## Direct room URLs

You can directly link to a specific room by going to `/room/[roomname]`. This pre-fills the "Room" field on the login page with the specified room.

## Admin dashboard

Abungo comes with a simple command-based admin dashboard for chat moderation. It can be accessed at `/admin` and looks like this:

![Abungo Admin Dashboard screenshot](http://i.imgur.com/zEb8OxJ.png)

Commands you can use:

+ `say <text>` - send a chat message globally (all rooms can see it)
+ `list` - lists all users
+ `brainwash` - clear users' screens
+ `disconall` - disconnect all users
+ `kick <room>:<nick>` - force a user to disconnect
+ `stop` - stop the server

A password is required to access the admin dashboard. By default, the password is `default` and it can be changed by creating a `.env` file (if it doesn't already exist) and changing the `ADMIN_PWD` value like so:

```
ADMIN_PWD=mysupersecurepassword
```

See [Running Abungo](#running-abungo) below for more details.

**It is not recommended to use the same password as your other accounts since the password will not be encrypted**.

## Running Abungo

First, you'll need to download and install [node.js](http://nodejs.org) if you haven't already.

If you want to use a `.env` file to set admin password and port, you will need to install [`foreman`](http://github.com/ddollar/foreman#readme).

`cd` to the Abungo directory and run `npm install` to install dependencies (`socket.io`, `express` and `body-parser`).

Once you have everything installed, run `foreman start` from the Abungo directory (if you don't have `foreman`, just do `node server.js`). Navigate to `http://localhost:3000` in your browser to see it in action.

You can change the port by creating a `.env` file (if it doesn't already exist) and changing the `PORT` value like so:

```
PORT=1337
```

---

You can check it out live at https://abungo.herokuapp.com