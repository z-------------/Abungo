var app = require("express")();
var http = require("http").Server(app);
var io = require("socket.io")(http);

app.get("/", function(req, res) {
    res.sendfile(__dirname + "/public/index.html");
});

app.get(/^(.+)$/, function(req, res) {
    res.sendfile(__dirname + "/public/" + req.params[0]);
});

Array.prototype.remove = function(index){return this.splice(index,1)};

function timeString() {
    var date = new Date();
    var hours = date.getHours().toString();
    var minutes = date.getMinutes().toString();
    var seconds = date.getSeconds().toString();
    
    if (minutes.length == 1) {
        minutes = "0" + minutes;
    }
    if (seconds.length == 1) {
        seconds = "0" + seconds;
    }
    
    return "[" + hours + ":" + minutes + ":" + seconds + "] ";
}

var connectedUsers = [];
var nickIdMap = {};
var clients = {};
var kickList = []; // a list of kicked ips

io.on("connection", function(socket){
    var ip = socket.request.connection.remoteAddress;
    var userNick;
    var clientId = socket.id;
    
    console.log(timeString() + "a user connected from " + ip);
    
    socket.on("disconnect", function(){
        if (userNick) {
            clients[clientId] = undefined;
            connectedUsers.remove(connectedUsers.indexOf(userNick));
            io.emit("user left", {
                nick: userNick,
                users: connectedUsers,
                time: new Date().toString()
            });
            console.log(timeString() + userNick + " (" + ip + ") disconnected");
        } else {
            console.log(timeString() + "user at (" + ip + ") disconnected");
        }
    });
    
    socket.on("nick chosen", function(nick){
        console.log(timeString() + "user at " + ip + " chose nick '" + nick + "'");
        if (kickList.indexOf(ip) != -1) {
            socket.emit("still kicked");
        } else if (connectedUsers.indexOf(nick) != -1) {
            socket.emit("kick","nick already in use");
            console.log(timeString() + nick + " (" + ip + ") was kicked: nick already in use");
        } else { // nick is not taken and ip isnt on kicklist
            clients[clientId] = {
                socket: socket,
                ip: ip
            }
            
            userNick = nick;
            connectedUsers.push(nick);
            nickIdMap[nick] = clientId;
            
            io.emit("user joined", {
                nick: nick,
                users: connectedUsers,
                time: new Date().toString()
            });
            
            socket.on("chat message", function(msg){
                msg.time = new Date().toString();
                socket.broadcast.emit("chat message", msg);
                console.log(timeString() + msg.nick + " (" + ip + "): " + msg.text);
            });
            
            socket.on("typing",function(){
                socket.broadcast.emit("typing", nick);
            });
            
            socket.on("stopped typing",function(){
                socket.broadcast.emit("stopped typing",nick);
            });
            
            socket.on("image share",function(data){
                data.time = new Date().toString();
                socket.broadcast.emit("image share",data);
                console.log(timeString() + data.nick + " shared an image: " + data.fileName);
            });
            
            socket.on("audio share",function(data){
                data.time = new Date().toString();
                socket.broadcast.emit("audio share",data);
                console.log(timeString() + data.nick + " shared audio: " + data.fileName);
            });
            
            socket.on("file share",function(data){
                data.time = new Date().toString();
                socket.broadcast.emit("file share",data);
                console.log(timeString() + data.nick + " shared a file: " + data.fileName);
            });
        }
    });
});

http.listen(3000, function(){
    console.log("listening on *:3000");
});


// listen for admin commands
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', function (text) {
    if (text.indexOf("kick:") == 0) {
        var userNick = text.substring("kick: ".length).replace("\n","");
        var userId = nickIdMap[userNick];
        var userIp = clients[userId].ip;
        clients[userId].socket.emit("kick","King Jimmy has spoken");
        
        kickList.push(userIp);
        setTimeout(function(){
            kickList.remove(this.indexOf(userIp));
        },300000);
        
        console.log(userNick + " was kicked: King Jimmy has spoken");
    } else if (text.indexOf("stop") == 0) {
        io.emit("server stopping");
        process.exit();
    } else if (text.indexOf("brainwash") == 0) {
        io.emit("brainwash");
    } else {
        io.emit("chat message", {
            text: text,
            nick: "<pre>[console]</pre>",
            time: new Date().toString(),
            fromConsole: true
        })
    }
});