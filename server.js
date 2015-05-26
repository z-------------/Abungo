var fs = require("fs");
var express = require("express");
var app = express();
var socketio = require("socket.io");
var sass = require("node-sass");

var PORT = process.env.PORT || 3000;

/* make a list of emoji */

var stickers = [];
var STICKERS_DIRNAME = __dirname + "/public/img/stickers/";

function makeStickersList(filenames) {
    stickers.length = 0;
    filenames.forEach(function(filename) {
        stickers.push(filename.slice(0, -4));
    });
}

makeStickersList(fs.readdirSync(STICKERS_DIRNAME));

fs.watch(STICKERS_DIRNAME, function() {
    makeStickersList(fs.readdirSync(STICKERS_DIRNAME));
});

/* set up express */

app.use(express.static("public"));

app.set("views", __dirname + "/public");
app.set("view engine", "jade");

app.get("/", function(req, res) {
    res.render("index.jade", {
        stickers: stickers
    });
});

app.get("/:path.html", function(req, res) {
    res.render(req.params.path + ".jade", {
        stickers: stickers
    });
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
        res.append("Content-Type", type || "text/plain");
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
    
    /* delete files that have expired */
    
    setInterval(function() {
        Object.keys(files).forEach(function(mediaID) {
            var file = files[mediaID];
            var now = new Date();
            var delta = now - file.uploadedDate;
            console.log(mediaID, delta, 600000 - delta);
            if (delta > 600000) { // 10 minutes
                delete files[mediaID];
                console.log("deleted" + mediaID, files);
            }
        });
    }, 5000);
    
    /* socket messages (the actual stuff) */

    io.on("connection", function(socket){
        socket.emit("connected", {
            date: new Date()
        });
        
        console.log("new connection");
        
        socket.on("login", function(data){
            var nickTaken = false;
            
            if (rooms[data.room] && rooms[data.room].users.hasOwnProperty(data.nick)) {
                nickTaken = true;
            }
            
            if (!nickTaken) {
                if (!rooms[data.room]) {
                    rooms[data.room] = {
                        users: {}
                    };
                }
                
                var room = rooms[data.room];
                var userID = data.userID || ("" + new Date().getTime() + Math.round(Math.random() * 10000));
                room.users[data.nick] = {
                    socket: socket,
                    userID: userID,
                    nick: data.nick,
                    ip: socket.handshake.address
                };
                var user = room.users[data.nick];
                console.log("%s (%s) joined room '%s'", user.nick, user.ip, data.room);
                
                if (data.rejoin) {
                    socket.emit("login_rejoin_accepted", {
                        userID: userID,
                        nick: data.nick,
                        room: data.room,
                        users: Object.keys(room.users)
                    });
                } else {
                    socket.emit("login_accepted", {
                        userID: userID,
                        nick: data.nick,
                        room: data.room,
                        users: Object.keys(room.users)
                    });
                }
                
                Object.keys(room.users).forEach(function(userNick) {
                    var user = room.users[userNick];
                    user.socket.emit("user_joined", {
                        nick: data.nick
                    });
                });
                
                socket.on("message", function(data) {
                    //setTimeout(function(){
                    var isFile = !!data.upload;
                    var isSticker = !!data.sticker;
                    
                    var sendableMessageData = {
                        nick: user.nick,
                        messageID: data.messageID // for sender client use only
                    };
                    
                    if (isFile) {
                        var mediaID = "" + Math.round(Math.random() * 100000) + new Date().getTime();
                        files[mediaID] = {
                            file: data.upload,
                            type: data.type,
                            uploadedDate: new Date()
                        };
                        sendableMessageData.mediaID = mediaID;
                        sendableMessageData.mediaName = data.mediaName;
                        sendableMessageData.mediaType = data.type;
                        
                        console.log("%s (%s) sent file: %s (%s)", user.nick, user.ip, data.mediaName, data.type);
                    } else if (isSticker) {
                        sendableMessageData.sticker = data.sticker;
                        sendableMessageData.stickerSize = data.stickerSize;
                        
                        console.log("%s (%s) sent sticker '%s'", user.nick, user.ip, data.sticker);
                    } else {
                        sendableMessageData.message = data.message;
                        
                        console.log("%s (%s) said: %s", user.nick, user.ip, data.message);
                    }
                    
                    Object.keys(room.users).forEach(function(userNick) {
                        var user = room.users[userNick];
                        user.socket.emit("message_incoming", sendableMessageData);
                    });
                    //}, 2000);
                });
                
                socket.on("typing_start", function(data) {
                    Object.keys(room.users).forEach(function(userNick) {
                        var tuser = room.users[userNick];
                        tuser.socket.emit("typing_start", {
                            nick: user.nick
                        });
                    });
                });
                
                socket.on("typing_stop", function(data) {
                    Object.keys(room.users).forEach(function(userNick) {
                        var tuser = room.users[userNick];
                        tuser.socket.emit("typing_stop", {
                            nick: user.nick
                        });
                    });
                });
                
                socket.on("ping", function(data) {
                    socket.emit("pong");
                    user.lastPing = new Date();
                });
                var pingInterval = setInterval(function(){
                    if (room.users[data.nick] && room.users[data.nick].userID === user.userID) {
                        if (!user.lastPing) {
                            user.lastPing = new Date();
                        }
                        var delta = new Date() - user.lastPing;

                        if (delta > 30000) {
                            socket.disconnect();
                        }

                        console.log(data.nick, delta);
                    } else {
                        clearInterval(pingInterval);
                    }
                }, 5000);
                
                socket.on("disconnect", function() {
                    disconnectUser(room, user.nick);
                });
            } else {
                var nickTakenUser = rooms[data.room].users[data.nick];
                if (nickTakenUser.userID !== data.userID) {
                    socket.emit("login_rejected");
                    console.log("login rejected");
                }
            }
        });
        
        socket.on("login_resume", function(data) {
            var room = rooms[data.room];
            if (room && room.users && room.users.hasOwnProperty(data.nick) && room.users[data.nick].userID === data.userID) {
                room.users[data.nick].socket = socket;
            } else {
                socket.emit("login_resume_rejected");
            }
        });
    });
});