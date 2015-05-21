var fs = require("fs");
var express = require("express");
var app = express();
var socketio = require("socket.io");
var sass = require("node-sass");

var PORT = process.env.PORT || 3000;

/* set up express */

app.use(express.static("public"));

app.set("views", __dirname + "/public");
app.set("view engine", "jade");

app.get("/", function(req, res) {
    res.render("index.jade");
});

app.get("/:path.html", function(req, res) {
    res.render(req.params.path + ".jade");
});

app.get("/:path.css", function(req, res) {
    sass.render({
        file: __dirname + "/public/" + req.params.path + ".scss",
    }, function(err, result) {
        if (!err) {
            res.append("Content-Type", "text/css");
            res.send(result.css);
        } else {
            res.sendFile(__dirname + "/public" + req.originalUrl);
        }
    });
});

app.get("/file/:id/*", function(req, res) {
    var mediaID = req.params.id;
    if (files.hasOwnProperty(mediaID)) {
        var fileObject = files[mediaID];
        var file = fileObject.file;
        var type = fileObject.type;
        res.append("Content-Type", type);
        res.send(file);
    } else {
        res.status(404);
        res.send("<h1>Abungo</h1><p>The file you're looking for couldn't be found.</p>");
    }
});

var files = {};

var server = app.listen(PORT, function() {
    var host = server.address().address;
    var port = server.address().port;

    console.log("Abungo running on port %s", port);
    
    /* hey ho, let's go */
    
    var io = socketio(server);
    
    var rooms = {};
    
    var disconnectUser = function(room, nick) {
        var user = room.users[nick];
        if (user) {
            delete room.users[nick];
            Object.keys(room.users).forEach(function(userNick) {
                var rUser = room.users[userNick];
                rUser.socket.emit("user_left", {
                    nick: nick
                });
            });
            console.log("disconnected", nick);
        }
    };

    io.on("connection", function(socket){
        socket.emit("connected", {
            date: new Date()
        });
        
        console.log("new connection");
        
        socket.on("login", function(data){
            var nickTaken = false;
            var userIDExists = false;
            
            if (rooms[data.room] && rooms[data.room].users.hasOwnProperty(data.nick)) {
                nickTaken = true;
                if (rooms[data.room].users[data.nick].userID === data.userID) {
                    userIDExists = true;
                } else {
                    console.log("user id doesnt exist");
                }
            } else {
                console.log("user id doesnt exist");
            }
            
            if (!nickTaken && !userIDExists) {
                if (!rooms[data.room]) {
                    rooms[data.room] = {
                        users: {}
                    };
                }
                
                var room = rooms[data.room];
                var userID = "" + new Date().getTime() + Math.round(Math.random() * 10000);
                room.users[data.nick] = {
                    socket: socket,
                    userID: userID
                };
                var user = room.users[data.nick];
                console.log("login accepted");
                
                socket.emit("login_accepted", {
                    userID: userID,
                    nick: data.nick,
                    room: data.room,
                    users: Object.keys(room.users)
                });
                
                Object.keys(room.users).forEach(function(userNick) {
                    var user = room.users[userNick];
                    user.socket.emit("user_joined", {
                        nick: data.nick
                    });
                });
                
                socket.on("message", function(data) {
                    var isFile = !!data.upload;
                    
                    var sendableMessageData = {
                        nick: data.nick
                    };
                    
                    if (isFile) {
                        var mediaID = "" + Math.round(Math.random() * 100000) + new Date().getTime();
                        files[mediaID] = {
                            file: data.upload,
                            type: data.type
                        };
                        sendableMessageData.mediaID = mediaID;
                        sendableMessageData.mediaName = data.mediaName;
                        sendableMessageData.mediaType = data.type;
                    } else {
                        sendableMessageData.message = data.message;
                    }
                    
                    Object.keys(room.users).forEach(function(userNick) {
                        var user = room.users[userNick];
                        user.socket.emit("message_incoming", sendableMessageData);
                    });
                });
                
                socket.on("ping", function(data) {
                    socket.emit("pong");
                    user.lastPing = new Date();
                });
                var pingInterval = setInterval(function(){
                    if (room.users[data.nick]) {
                        if (!user.lastPing) {
                            user.lastPing = new Date();
                        }
                        var delta = new Date() - user.lastPing;

                        if (delta >= 30000) {
                            disconnectUser(room, data.nick);
                        }

                        console.log(data.nick, delta);
                    } else {
                        clearInterval(pingInterval);
                    }
                }, 10000);
                
                socket.on("disconnect", function() {
                    disconnectUser(room, data.nick);
                });
            } else {
                console.log("login rejected");
                socket.emit("login_rejected");
            }
        });
    });
});