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

var server = app.listen(PORT, function() {
    var host = server.address().address;
    var port = server.address().port;

    console.log("Abungo running on port %s", port);
    
    /* hey ho, let's go */
    
    var io = socketio(server);
    
    var rooms = {};
    var roomSockets = function(roomName) {
        var room = rooms[roomName];
        if (room) {
            var sockets = [];
            room.users.forEach(function(user) {
                sockets.push(user.socket);
            });
            return sockets;
        }
        return null;
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
                }
            }
            
            if (!nickTaken || userIDExists) {
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
                console.log("login accepted");
                
                socket.emit("login_accepted", {
                    userID: userID,
                    nick: data.nick,
                    room: data.room
                });
                
                socket.on("message", function(data) {
                    Object.keys(room.users).forEach(function(userNick) {
                        var user = room.users[userNick];
                        user.socket.emit("message_incoming", {
                            message: data.message,
                            nick: data.nick
                        });
                    });
                });
                
                socket.on("disconnect", function() {
                    delete room.users[data.nick];
                    Object.keys(room.users).forEach(function(userNick) {
                        var user = room.users[userNick];
                        user.socket.emit("user_left", {
                            nick: data.nick
                        });
                    });
                });
            } else {
                console.log("login rejected");
                socket.emit("login_rejected");
            }
        });
    });
});