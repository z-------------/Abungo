# Abungo

Simple chat app made with node.js and Socket.IO.

## Simple and anonymous

The server doesn't store any information about the users or keep logs. It simply relays the data from one client to the rest. 

Chat privately in chat rooms. The default room is "yeya".

## Responsive layout

The Abungo client is minimally designed and adapts to different screen sizes.

![Abungo on a PC](http://i.imgur.com/uHIjlEu.png)

![Abungo on a smartphone](http://i.imgur.com/BzgCj67.png)

## Admin dashboard

Abungo comes with a simple admin dashboard for chat moderation. It can be accessed at `http://localhost:3000/admin`.

Commands you can use:

+ `list` - lists all users by room
+ `brainwash` - clear users' screens
+ `disconall` - disconnect all users
+ `stop` - stop the server

Anything else will result in a chat message from "[console]".

A password is required to access admin tools. By default, the password is `default` and it can be changed by making an `adminpassword` file containing the new password in the Abungo directory. **It is not recommended to use the same password as your other accounts since Abungo is not encrypted**.

## Running Abungo

First, you'll need to download and install [node.js](http://nodejs.org) if you haven't already.

`cd` to the Abungo directory and install Socket.IO, Express and body-parser:

```bash
npm install socket.io
npm install express
npm install body-parser
```

After you have everything installed, run `node server` from the Abungo directory. Navigate to `http://localhost:3000` in your browser to see it in action.

You might also want to check it live at http://abungo.jit.su
