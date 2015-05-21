var $ = function(selector) {
    if (document.querySelectorAll(selector).length > 1) {
        return document.querySelectorAll(selector);
    } else {
        return document.querySelector(selector);
    }
};

var $$ = function(selector) {
    return document.querySelectorAll(selector);
};

var each = function(list, func) {
    if (!Array.isArray(list)) {
        list = [].slice.call(list);
    }
    
    list.forEach(func);
};

Array.prototype.remove = function(elem) {
    var index = this.indexOf(elem);
    if (index !== -1) {
        return this.splice(index, 1);
    }
};

/* track pressed keys */

var pressedKeys = [];
window.addEventListener("keydown", function(e){
    pressedKeys.push(e.keyCode);
});
window.addEventListener("keyup", function(e){
    if (pressedKeys.indexOf(e.keyCode) !== -1) {
        var index = pressedKeys.indexOf(e.keyCode);
        pressedKeys.splice(index, 1);
    }
});

/* socket.io shenanigans */

var socket = io();
var socketInfo = {};

socket.on("connected", function(data) {
    socketInfo.connected = true;
    socketInfo.connectedDate = new Date(data.date);
});

/* login */

var loginForm = $("#login")
var loginNickInput = $("#login_nick");
var loginRoomInput = $("#login_room");
var loginButton = $("#login_button");

loginForm.addEventListener("submit", function(e){
    e.preventDefault();
    if (this.checkValidity() && !this.classList.contains("notouch")) {
        socket.emit("login", {
            nick: loginNickInput.value,
            room: loginRoomInput.value,
            userID: socketInfo.userID
        });
    }
});

socket.on("login_accepted", function(data) {
    socketInfo.userID = data.userID;
    socketInfo.nick = data.nick;
    socketInfo.room = data.room;
    socketInfo.users = data.users;
    
    console.log("login_accepted", data);
    
    loginButton.textContent = "Connected";
    loginForm.classList.add("notouch");
    each($$(".showonlogin"), function(elem) {
        elem.classList.add("visible");
    });
    
    /* send and receive messages */
    
    var makeMessageElem = function(data, type) {
        var elem = document.createElement("div");
        elem.innerHTML = "<h3>" + data.nick + "</h3><p>" + data.message + "</p>";
        elem.classList.add("message");
        elem.classList.add("message-" + type);
        return elem;
    };
    
    var makeJoinElem = function(data, action) {
        var elem = document.createElement("div");
        elem.innerHTML = "<p>" + data.nick + " " + action + ".</p>";
        elem.classList.add("message");
        elem.classList.add("message-join");
        return elem;
    };
    
    var sendbarComposeInput = $(".sendbar_compose_input");
    sendbarComposeInput.addEventListener("keydown", function(e){
        if (e.keyCode === 13 && !e.shiftKey) {
            e.preventDefault();
            socket.emit("message", {
                message: this.textContent,
                nick: socketInfo.nick,
                room: socketInfo.room,
                userID: socketInfo.userID
            });
            this.innerHTML = "";
        }
    });
    
    socket.on("message_incoming", function(data) {
        var type = "received";
        if (data.nick === socketInfo.nick) {
            type = "self";
        }
        $(".messages").appendChild(makeMessageElem(data, type));
    });
    
    socket.on("user_joined", function(data) {
        if (socketInfo.users.indexOf(data.nick) === -1) {
            socketInfo.users.push(data.nick);
        }
        $(".messages").appendChild(makeJoinElem(data, "joined"));
    });
    
    socket.on("user_left", function(data) {
        socketInfo.users.remove(data.nick);
        $(".messages").appendChild(makeJoinElem(data, "left"));
    });
    
    Object.observe(socketInfo.users, function() {
        socketInfo.users.sort();
        $("#users").innerHTML = "";
        socketInfo.users.forEach(function(nick) {
            var elem = document.createElement("li");
            elem.classList.add("user");
            elem.textContent = nick;
            if (nick === socketInfo.nick) {
                elem.classList.add("user-self");
            }
            $("#users").appendChild(elem);
        });
    });
});

socket.on("login_rejected", function(data) {
    console.log("login_rejected");
});