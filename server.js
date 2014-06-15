var express = require("express");
var app = express();
var bodyParser = require("body-parser")
var http = require("http").Server(app);
var io = require("socket.io")(http);
var fs = require("fs");

app.use(bodyParser.urlencoded());

var adminPassword = "default";

fs.readFile("adminpassword","utf8",function(err,content){
    if (err) {
        throw err;
    } else {
        adminPassword = content;
    }
});

app.get("/", function(req, res) {
    res.sendfile(__dirname + "/public/index.html");
});

app.get("/admin", function(req, res){
    var ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    res.sendfile(__dirname + "/admin/index.html");
})

app.post("/admin", function(req, res) {
    var ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    if (req.body.password === adminPassword) {
        res.sendfile(__dirname + "/admin/auth.html");
        console.log("someone at %s logged into admin dashboard",ip);
    } else {
        res.sendfile(__dirname + "/admin/index.html");
    }
});

app.get(/^(.+)$/, function(req, res) {
    res.sendfile(__dirname + "/public/" + req.params[0]);
});

Array.prototype.remove = function(index){return this.splice(index,1)};

var roomUsers = {};

var nickIdMap = {};
var clients = {};
var kickList = []; // a list of kicked ips

io.on("connection", function(socket){
    var ip = socket.handshake.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;
    var userNick;
    var userRoom;
    var clientId = socket.id;
    
    console.log("a user connected from %s", ip);
    
    socket.emit("try resume"); // tells the client to check if a nickname has already been chosen
    // useful when rejoining chat after idling (for example after computer sleeps)
    
    socket.on("disconnect", function(){
        if (userNick && userRoom) {
            clients[clientId] = undefined;
            roomUsers[userRoom].remove(roomUsers[userRoom].indexOf(userNick));
            io.to(userRoom).emit("user left", {
                nick: userNick,
                users: roomUsers[userRoom],
                time: new Date().toString()
            });
            console.log("%s (%s %s) disconnected", userNick, userRoom, ip);
        } else {
            console.log("user at (%s) disconnected", ip);
        }
    });
    
    socket.on("nick chosen", function(data){
        var nick = data.nick;
        var room = data.room;
        
        if (!roomUsers[room]) {
            roomUsers[room] = []; // create array for this room if it doesn't yet exist
        }
        
        console.log("user at %s chose nick '%s' and joined room '%s'", ip, nick, room);
        
        if (kickList.indexOf(ip) != -1) {
            socket.emit("still kicked");
        } else if (roomUsers[room].indexOf(nick) != -1) {
            socket.emit("kick","nick already in use");
            console.log("%s (%s %s) was kicked: nick already in use", nick, room, ip);
        } else { // nick is not taken and ip isnt on kicklist
            clients[clientId] = {
                socket: socket,
                ip: ip
            }
            
            userNick = nick;
            userRoom = room;
            
            nickIdMap[nick] = clientId;
            
            roomUsers[room].push(nick);
            
            socket.join(room);
            
            io.to(room).emit("user joined", {
                nick: nick,
                users: roomUsers[room],
                time: new Date().toString()
            });
            
            socket.on("chat message", function(msg){
                msg.time = new Date().toString();
                socket.broadcast.to(room).emit("chat message", msg);
                console.log("%s (%s %s): %s", nick, room, ip, msg.text);
            });
            
            socket.on("typing",function(){
                socket.broadcast.to(room).emit("typing", nick);
            });
            
            socket.on("stopped typing",function(){
                socket.broadcast.to(room).emit("stopped typing", nick);
            });
            
            socket.on("file share",function(data){
                var size = data.file.length;
                if (!(size > 20971520)) { // 20mb
                    data.time = new Date().toString();
                    socket.broadcast.to(room).emit("file share",data);
                    console.log("%s (%s %s) shared a file: %s", nick, room, ip, data.name);
                } else {
                    socket.emit("file too big");
                }
            });
        }
    });
    
    // admin commands
    socket.on("admin stop",function(){
        io.emit("server stopping");
        console.log("someone at %s executed admin command 'stop'",ip);
        process.exit();
    });
    
    socket.on("admin brainwash",function(){
        io.emit("brainwash");
        console.log("someone at %s executed admin command 'brainwash'",ip);
    });
    
    socket.on("admin list",function(){
        socket.emit("admin list",roomUsers);
        console.log("someone at %s executed admin command 'list'",ip);
    });
    
    socket.on("admin disconall",function(){
        var clientKeys = Object.keys(clients);
        var sockets = io.sockets.sockets;
        for (i=0; i<clientKeys.length; i++) {
            if (clientKeys[i] !== clientId) {
                clients[clientKeys[i]].socket.disconnect();
            }
        }
        console.log("someone at %s executed admin command 'disconall'",ip);
    });
    
    socket.on("admin chat",function(data){
        io.emit("chat message",{
            text: data.text,
            nick: "<pre>[console]</pre>",
            time: new Date().toString(),
            fromConsole: true
        });
        console.log("someone at %s sent message as console: '%s'",ip,data.text);
    });
});

http.listen(3000, function(){
    console.log("listening on *:3000");
});