var express = require("express");
var app = express();
var bodyParser = require("body-parser")
var http = require("http").Server(app);
var io = require("socket.io")(http);
var fs = require("fs");

var packageJSON = require("./package.json");

app.use(bodyParser.urlencoded());

function log(str,vars) {
    var args = arguments;
    for (i=1; i<args.length; i++) {
        str = str.replace("%s",args[i]);
    }
    console.log(str);
    for (i=0; i<adminList.length; i++) {
        adminList[i].emit("admin log",str);
    }
}

var adminPassword = "default";

fs.readFile(process.cwd() + "/adminpassword","utf8",function(err,content){
    if (!err) {
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
        log("someone at %s logged into admin dashboard",ip);
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
var adminList = []; // a list of sockets that are connected from the admin dashboard

io.on("connection", function(socket){
    var ip = socket.handshake.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;
    var userNick;
    var userRoom;
    var clientId = socket.id;
    
    log("a user connected from %s", ip);
    
    socket.emit("try resume"); // tells the client to check if a nickname has already been chosen
    // useful when rejoining chat after idling (for example after computer sleeps)
    
    socket.on("disconnect", function(){
        if (userNick && userRoom) {
            delete clients[clientId];
            roomUsers[userRoom].remove(roomUsers[userRoom].indexOf(userNick));
            if (roomUsers[userRoom].length == 0) {
                delete roomUsers[userRoom];
            }
            io.to(userRoom).emit("user left", {
                nick: userNick,
                users: roomUsers[userRoom],
                time: new Date().toString()
            });
            io.to(userRoom).emit("stopped typing", userNick);
            log("%s (%s %s) disconnected", userNick, userRoom, ip);
        } else {
            log("user at (%s) disconnected", ip);
        }
    });
    
    socket.on("nick chosen", function(data){
        var nick = data.nick;
        var room = data.room;
        
        if (!roomUsers[room]) {
            roomUsers[room] = []; // create array for this room if it doesn't yet exist
        }
        
        log("user at %s chose nick '%s' and joined room '%s'", ip, nick, room);
        
        if (kickList.indexOf(ip) != -1) {
            socket.emit("still kicked");
        } else if (roomUsers[room].indexOf(nick) != -1 && nickIdMap[room + ":" + nick]) {
            socket.emit("kick","nick already in use");
            log("%s (%s %s) was kicked: nick already in use", nick, room, ip);
        } else { // nick is not taken and ip isnt on kicklist
            clients[clientId] = {
                socket: socket,
                ip: ip
            }
            
            userNick = nick;
            userRoom = room;
            
            nickIdMap[room + ":" + nick] = clientId;
            
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
                log("%s (%s %s): %s", nick, room, ip, msg.text);
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
                    log("%s (%s %s) shared a file: %s", nick, room, ip, data.name);
                } else {
                    socket.emit("file too big");
                }
            });
        }
    });
    
    socket.on("i am admin",function(){
        adminList.push(socket);
        
        // admin commands
        socket.on("admin stop",function(){
            io.emit("server stopping");
            log("admin at %s executed command 'stop'",ip);
            process.exit();
        });
        
        socket.on("admin brainwash",function(){
            io.emit("brainwash");
            log("admin at %s executed command 'brainwash'",ip);
        });
        
        socket.on("admin list",function(){
            socket.emit("admin list",roomUsers);
            log("admin at %s executed command 'list'",ip);
        });
        
        socket.on("admin disconall",function(){
            var clientKeys = Object.keys(clients);
            for (i=0; i<clientKeys.length; i++) {
                if (clientKeys[i] !== clientId) {
                    clients[clientKeys[i]].socket.disconnect();
                }
            }
            log("admin at %s executed command 'disconall'",ip);
        });
        
        socket.on("admin chat",function(data){
            io.emit("chat message",{
                text: data.text,
                nick: "<pre>[console]</pre>",
                time: new Date().toString(),
                fromConsole: true
            });
            log("admin at %s sent message as console: '%s'",ip,data.text);
        });
        
        socket.on("kick",function(data){
            var reason = data.reason;
            var kickeeNick = data.nick;
            var kickeeRoom = data.room;
            var kickeeId = nickIdMap[kickeeRoom + ":" + kickeeNick];
            if (clients[kickeeId]) {
                var kickeeSocket = clients[kickeeId].socket;
                kickeeSocket.emit("kick",reason);
                kickeeSocket.disconnect();
                log("admin at %s executed command 'kick %s:%s'",ip,kickeeRoom,kickeeNick);
            } else {
                log("admin at %s tried to kick %s (%s) but user wasn't found",ip,kickeeNick,kickeeRoom);
            }
        });
    });
});

log("Abungo v%s started",packageJSON.version);

http.listen(3000, function(){
    log("listening on *:3000");
});