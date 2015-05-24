/* basic, non specific functions */

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

var cleanseHTML = function(str) {
    var elem = document.createElement("div");
    elem.textContent = str;
    return elem.innerHTML;
};

/* track pressed keys */

var pressedKeys = [];
window.addEventListener("keydown", function(e){
    if (pressedKeys.indexOf(e.keyCode) === -1) {
        pressedKeys.push(e.keyCode);
    }
});
window.addEventListener("keyup", function(e){
    if (pressedKeys.indexOf(e.keyCode) !== -1) {
        var index = pressedKeys.indexOf(e.keyCode);
        pressedKeys.splice(index, 1);
    }
});

/* convenience functions */
    
var makeMessageElem = function(data, type) {
    var elem = document.createElement("div");
    
    var bodyContent;
    
    if (data.mediaID) {
        var mediaURL = "/file/" + data.mediaID + "/" + data.mediaName;
        elem.dataset.mediaId = data.mediaID;
        
        if (data.mediaType.match(/^image\//gi)) { // image/*
            bodyContent = "<img src='" + mediaURL + "'>";
        } else if (data.mediaType.match(/^video\//gi)) { // video/*
            bodyContent = "<video controls src='" + mediaURL + "'></video>";
        } else if (data.mediaType.match(/^audio\//gi)) { // audio/*
            bodyContent = "<audio controls src='" + mediaURL + "'></audio>";
        } else {
            bodyContent = "<a target='_blank' href='" + mediaURL + "'>" + cleanseHTML(data.mediaName) + "</a>";
        }
    } else if (data.sticker) {
        bodyContent = "<img class='message_sticker' src='img/stickers/" + data.sticker + ".svg'>";
    } else {
        bodyContent = Autolinker.link(data.message);
    }

    elem.innerHTML = "<h3>" + data.nick + "</h3><p>" + bodyContent + "</p>";
    elem.classList.add("message");
    elem.classList.add("message-" + type);
    if (data.mediaID) {
        elem.classList.add("message-file");
    }
    return elem;
};

var makeJoinElem = function(data, action) {
    var elem = document.createElement("div");
    elem.innerHTML = "<p>" + cleanseHTML(data.nick) + " " + action + ".</p>";
    elem.classList.add("message");
    elem.classList.add("message-join");
    return elem;
};

var updateUsersList = function() {
    $(".userlist_list").innerHTML = "";
    abungoState.users.forEach(function(nick) {
        var elem = document.createElement("li");
        elem.classList.add("user");
        elem.textContent = nick;
        if (nick === abungoState.nick) {
            elem.classList.add("user-self");
        }
        $(".userlist_list").appendChild(elem);
    });
};

var updateTypingIndicators = function(nick, direction) {
    var methodName = ["remove", "add"][direction];
    var userElems = $$(".userlist_list li");
    each(userElems, function(elem) {
        if (elem.textContent === nick) {
            elem.classList[methodName]("typing");
        }
    });
};

var showNotification = function(nick, text) {
    if(window.Notification && Notification.permission !== "denied") {
        Notification.requestPermission(function(status) {
            if (status === "granted" && !document.hasFocus()) {
                var n = new Notification(nick + " on #" + abungoState.room, {
                    body: text,
                    icon: "/img/icon196.png"
                });
                window.addEventListener("focus", function(){
                    if (n) {
                        n.close();
                    }
                });
                n.addEventListener("click", function(){
                    window.focus();
                });
            }
        });
    }
};

var updateConnectionStatusIndicator = function(statusi) {
    var statuses = [{
        string: "Connected.", 
        classList: {
            action: "remove",
            class: "problem"
        }
    }, {
        string: "Reconnecting...",
        classList: {
            action: "add",
            class: "problem"
        }
    }];
    var status = statuses[statusi];
    var statusString = status.string;
    var classListMethod = status.classList.action;
    var classListClass = status.classList.class;
    
    loginButton.classList[classListMethod](classListClass);
    loginButton.textContent = statusString;
};

/* socket.io shenanigans */

var socket = io();
var abungoState = {};

socket.on("connected", function(data) {
    abungoState.connected = true;
    abungoState.connectedDate = new Date(data.date);
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
            userID: abungoState.userID
        });
    }
});

loginNickInput.focus();

/* try resume connection */

var tryReconnect = function() {
    if (abungoState && abungoState.userID && abungoState.nick && abungoState.room) {
        socket.emit("login_resume", {
            nick: abungoState.nick,
            userID: abungoState.userID,
            room: abungoState.room
        });
        console.log("sending login_resume");

        socket.on("login_resume_rejected", function() {
            console.log("login_resume_rejected");
            socket.emit("login", {
                nick: abungoState.nick,
                room: abungoState.room,
                userID: abungoState.userID,
                rejoin: true
            });
            console.log("sending login { rejoin: true }");
            socket.on("login_rejoin_accepted", function(data) {
                console.log("login_rejoin_accepted");
                abungoState.userID = data.userID;
                
                // update users list without removing Object.observe listener
                abungoState.users.length = 0;
                data.users.forEach(function(nick) {
                    abungoState.users.push(nick);
                });
                
                updateConnectionStatusIndicator(0);
            });
        });
    }
};

socket.on("connected", tryReconnect);

/* ping the server to determine connectivity (only for server-side; client uses socket.connected) */

(function(){
    socket.on("pong", function(data) {
        console.log("pong");
    });
    var ping = function() {
        socket.emit("ping");
        console.log("ping");
    };
    setInterval(ping, 5000);
})();

/* forming in a straight line */

socket.on("login_accepted", function(data) {
    abungoState.userID = data.userID;
    abungoState.nick = data.nick;
    abungoState.room = data.room;
    abungoState.users = data.users;
    
    console.log("login_accepted", data);
    
    var sendbarElem = $(".sendbar");
    var sendbarComposeInput = $(".sendbar_compose_input");
    var sendbarFileInput = $("#fileinput");
    var messagesElem = $(".messages");
    
    var sidebarHideBtn = $("#sidebar_collapse");
    var sidebarLogoutBtn = $("#logout_button");
    
    loginButton.textContent = "Connected.";
    loginForm.classList.add("notouch");
    document.body.classList.add("loggedin");
    each($$(".notouch input"), function(elem) {
        elem.setAttribute("readonly", "true");
    });
    sendbarComposeInput.focus();
    
    /* send messages */
    
    sendbarComposeInput.addEventListener("keydown", function(e){
        if (e.keyCode === 13 && !e.shiftKey) {
            e.preventDefault();
            if (this.textContent.length > 0) {
                socket.emit("message", {
                    message: this.innerHTML,
                    nick: abungoState.nick,
                    room: abungoState.room,
                    userID: abungoState.userID
                });
                this.innerHTML = "";
            }
        }
    });
    
    sendbarComposeInput.addEventListener("input", function() {
        var elems = this.querySelectorAll(":not(br)");
        each(elems, function(elem) {
            elem.outerHTML = elem.textContent;
        });
    });
    
    /* receive messages (including files and stickers) */
    
    socket.on("message_incoming", function(data) {
        var isAtBottom = (messagesElem.scrollTop + messagesElem.offsetHeight === messagesElem.scrollHeight);
        
        var type = "received";
        if (data.nick === abungoState.nick) {
            type = "self";
        }
        messagesElem.appendChild(makeMessageElem(data, type));
        
        var notifText = data.message;
        if (data.mediaID) {
            notifText = "File: " + data.mediaName;
        } else if (data.sticker) {
            notifText = ":" + data.sticker + ":";
        }
        showNotification(data.nick, notifText);
        
        if (isAtBottom) { // scroll to bottom if previously at bottom
            messagesElem.scrollTop = messagesElem.offsetHeight + messagesElem.scrollHeight;
        }
    });
    
    /* send files */
    
    sendbarFileInput.addEventListener("change", function(){
        var file = this.files[0];
        if (file && file.size < 10000000) { // 10 mb
            socket.emit("message", {
                nick: abungoState.nick,
                userID: abungoState.userID,
                room: abungoState.room,
                upload: file,
                type: file.type,
                mediaName: file.name
            });
        } else if (file) {
            alert("That file is too big. You can only upload files less than 10 megabytes in size.");
        }
    });
    
    /* send stickers */
    
    $(".popup_popup-stickers").addEventListener("click", function(e) {
        if (e.target.classList.contains("popup_popup-stickers_sticker")) {
            socket.emit("message", {
                nick: abungoState.nick,
                userID: abungoState.userID,
                room: abungoState.room,
                sticker: e.target.getAttribute("title")
            });
        }
    });
    
    /* user join/leave */
    
    socket.on("user_joined", function(data) {
        var isAtBottom = (messagesElem.scrollTop + messagesElem.offsetHeight === messagesElem.scrollHeight);
        
        if (abungoState.users.indexOf(data.nick) === -1) {
            abungoState.users.push(data.nick);
        }
        messagesElem.appendChild(makeJoinElem(data, "joined"));
        
        if (isAtBottom) { // scroll to bottom if previously at bottom
            messagesElem.scrollTop = messagesElem.offsetHeight + messagesElem.scrollHeight;
        }
    });
    
    socket.on("user_left", function(data) {
        var isAtBottom = (messagesElem.scrollTop + messagesElem.offsetHeight === messagesElem.scrollHeight);
        
        abungoState.users.remove(data.nick);
        messagesElem.appendChild(makeJoinElem(data, "left"));
        
        if (isAtBottom) { // scroll to bottom if previously at bottom
            messagesElem.scrollTop = messagesElem.offsetHeight + messagesElem.scrollHeight;
        }
    });
    
    /* send and receive typing status */
    
    (function(){
        var typingOld = false;
        sendbarComposeInput.addEventListener("keyup", function() {
            var typing;
            if (this.textContent.length > 0) {
                typing = true;
            } else {
                typing = false;
            }
            if (typing !== typingOld) {
                if (typing) {
                    socket.emit("typing_start");
                } else {
                    socket.emit("typing_stop");
                }
                typingOld = typing;
            }
        });
    })();
    
    socket.on("typing_start", function(data) {
        console.log("typing_start", data.nick);
        updateTypingIndicators(data.nick, 1);
    });
    
    socket.on("typing_stop", function(data) {
        console.log("typing_stop", data.nick);
        updateTypingIndicators(data.nick, 0);
    });
    
    /* update users list */
    
    Object.observe(abungoState.users, function() {
        console.log("users list changed", abungoState.users);
        updateUsersList();
    });
    updateUsersList();
    
    /* show/hide sendbar box-shadow */

    setInterval(function() {
        if (messagesElem.scrollTop === messagesElem.scrollHeight - messagesElem.offsetHeight) {
            sendbarElem.classList.remove("float");
        } else {
            sendbarElem.classList.add("float");
        }
    });
    
    /* show/hide sidebar */

    sidebarHideBtn.addEventListener("click", function() {
        document.body.classList.toggle("sidebarhidden");
    });

    /* logout button */
    
    sidebarLogoutBtn.addEventListener("click", function() {
        if (confirm("Are you sure you want to leave? Your chat history will be lost.")) {
            window.location.reload();
        }
    });
    
    /* popup buttons */
    
    each($$("label.button.popup svg"), function(elem) {
        elem.addEventListener("click", function(e) {
            var label = elem.parentElement;
            if (!label.classList.contains("popup-opened")) {
                each($$("label.button.popup-opened"), function(elemOpened) {
                    label.classList.remove("popup-opened");
                });
            }
            label.classList.toggle("popup-opened");
        });
    });
    
    /* send reconnect requests when socket conection lost */
    
    setInterval(function() {
        if (!socket.connected || socket.disconnected) {
            updateConnectionStatusIndicator(1);
            
            socket.connect(function() {
                tryReconnect();
            });
        } else {
            updateConnectionStatusIndicator(0);
        }
    }, 5000);
});

socket.on("login_rejected", function(data) {
    console.log("login_rejected");
    alert("That username is taken. Please choose another or join a different room.");
});

setInterval(function() {
    console.log("socket.connected", socket.connected);
}, 5000);