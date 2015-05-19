var $ = function (selector) {
    return document.querySelector(selector);
};
var $$ = function (selector) {
    return document.querySelectorAll(selector);
};

var nick, room;

var connectionTime;

function encodeHTML(string) {
    var tempDiv = document.createElement("div");
    tempDiv.textContent = string;
    return tempDiv.innerHTML;
}

function decodeHTML(string) {
    var tempDiv = document.createElement("div");
    tempDiv.innerHTML = string;
    return tempDiv.textContent;
}

function addEmotes(string) {
    return string.replace(/:y:/g, "<img class='emote' src='img/emote/thumb.svg'>")
                  .replace(/:y1:/g, "<img class='emote med' src='img/emote/thumb.svg'>")
                  .replace(/:y2:/g, "<img class='emote big' src='img/emote/thumb.svg'>")
                  .replace(/:y3:/g, "<img class='emote huge' src='img/emote/thumb.svg'>")
                  .replace(/:gourd:/g, "<img class='emote' src='img/emote/gourd.svg'>")
                  .replace(/:gourd1:/g, "<img class='emote med' src='img/emote/gourd.svg'>")
                  .replace(/:gourd2:/g, "<img class='emote big' src='img/emote/gourd.svg'>")
                  .replace(/:gourd3:/g, "<img class='emote huge' src='img/emote/gourd.svg'>")
                  .replace(/:approve:/g, "<img class='emote huge' src='img/emote/seal.svg'>")
                  .replace(/HARFITT/g, "<span style='font-family: \"Comic Sans MS\", sans-serif; font-weight: 700; text-shadow: 0 1px 3px rgba(0, 0, 0, .5);'>\
<span style='color: red'>H</span>\
<span style='color: green'>A</span>\
<span style='color: blue'>R</span>\
<span style='color: yellow'>F</span>\
<span style='color: cyan'>I</span>\
<span style='color: orange'>T</span>\
<span style='color: purple'>T</span></span>");
}

if (localStorage.lastNick) {
    $("#nick_input").value = decodeHTML(localStorage.lastNick);
}

if (urlRoomName) {
    $("#chatroom").value = decodeURIComponent(urlRoomName);
    $("#chatroom").setAttribute("readonly", "true");
} else if (localStorage.lastRoom) {
    $("#chatroom").value = decodeHTML(localStorage.lastRoom);
} else {
    $("#chatroom").value = "yeya";
}

$("#nick_input").focus();

$("#nick_input").onkeydown = function (e) {
    if (e.which === 13) { // enter
        if (!$("#chatroom").getAttribute("readonly")) {
            $("#chatroom").focus();
        } else {
            chooseNick();
        }
    }
};

$("#chatroom").onkeydown = $("#enter").onclick = function (e) {
    if (e.which === 13 || e.which === 1) { // also accept 1 to make it work with enter button's onclick
        chooseNick();
    }
};

function chooseNick() {
    nick = encodeHTML($("#nick_input").value.substring(0, 100));
    room = encodeHTML($("#chatroom").value.toLowerCase().substring(0, 100));
    if (nick.split(" ").join("").length && room.split(" ").join("").length) {
        connectionTime = new Date().getTime();
        localStorage.lastNick = nick;
        localStorage.lastRoom = room;
        $("#welcome").style.opacity = "0";
        setTimeout(function () {
            $("#welcome").style.display = "none";
        }, 300);
        main();
    } else {
        alert("Choose a nickname and room");
        $("#nick_input").focus();
    }
}

function main() {
    var socket = io();

    socket.emit("nick chosen", {
        nick: nick,
        room: room
    });

    socket.on("try resume", function () {
        var now = new Date().getTime();
        if (nick && room && (now - connectionTime >= 20000)) { // connected to a room at least 20 seconds ago
            socket.emit("nick chosen", {
                nick: nick,
                room: room
            });
        }
    });

    var onlineUsers = [];
    var typingList = [];
    var unreadCount = 0;

    var windowIsFocused = true;
    var fileOptsOpened = false;

    Array.prototype.remove = function (element) {
        return this.splice(this.indexOf(element), 1);
    };

    HTMLElement.prototype.scrollBottom = function () {
        return this.scrollHeight - this.scrollTop - this.offsetHeight;
    };

    var autoLinkOptions = {
        callback: function (url) {
            return "<a href='" + url + "'>" + url + "</a>";
        }
    };

    window.onblur = function () {
        windowIsFocused = false;
    };

    window.onfocus = function () {
        windowIsFocused = true;
        unreadCount = 0;
        updateUnreadCount();
    };

    String.prototype.replaceVars = function (map) {
        var mapKeys = Object.keys(map);
        var returnVal = this;

        for (i = 0; i < mapKeys.length; i++) {
            returnVal = returnVal.split("%" + mapKeys[i] + "%").join(map[mapKeys[i]]);
        }

        return returnVal;
    };

    HTMLElement.prototype.remove = function () {
        this.parentElement.removeChild(this);
    };

    function writeListItem(nick, content, cssClass) {
        var wasAtBottom = $("#messages").scrollBottom() === 0;

        var liNode = document.createElement("li");
        liNode.innerHTML = ("<div class='message'>" + (cssClass === "self" ? "" : "<strong>%nick%</strong>") + "%content%</div>").replaceVars({
            nick: nick,
            content: content
        });
        liNode.setAttribute("class", cssClass);

        $("#messages").appendChild(liNode);

        if (wasAtBottom || cssClass === "self") {
            $("#messages").scrollTop = $("#messages").scrollHeight;
        }

        if ((!windowIsFocused || !wasAtBottom) && cssClass === "normal") {
            playSound("sound/message.ogg");
        }

        if (!windowIsFocused && cssClass === "normal") {
            unreadCount += 1;
            updateUnreadCount();
            
            if(window.Notification && Notification.permission !== "denied") {
                Notification.requestPermission(function(status) {
                    if (status === "granted") {
                        var n = new Notification(nick + " on #" + room, {
                            body: content,
                            icon: "/img/icon128.png"
                        });
                        window.addEventListener("focus", function(){
                            if (n) n.close();
                        });
                        n.addEventListener("click", function(){
                            window.focus();
                        });
                    }
                });
            }
        }

        if (cssClass.indexOf("typing") === -1) {
            moveTypersToBottom();
        } else {
            liNode.dataset.typer = nick;
        }
    }

    function playSound(url) {
        var audio = document.createElement("audio");
        audio.src = url;
        audio.play();
    }

    function updateOnlineUsers() {
        onlineUsers = onlineUsers.sort();
        $("#users").innerHTML = "<strong>Online</strong>: " + onlineUsers.join(", ");
    }

    function updateUnreadCount() {
        if (unreadCount > 0) {
            document.title = "Abungo [" + unreadCount.toString() + "]";
        } else {
            document.title = "Abungo";
        }
    }

    function updateTypingList() {
        var typers = Object.keys(typingList).sort();
        var typingElems = $$("li.typing");
        for (i = 0; i < typers.length; i++) {
            if (!$("li.typing[data-typer='" + typers[i] + "']")) {
                writeListItem(typers[i], " is typing", "normal typing");
            }
        }
        for (i = 0; i < typingElems.length; i++) {
            if (typers.indexOf(typingElems[i].dataset.typer) === -1) {
                typingElems[i].remove();
            }
        }
    }

    function moveTypersToBottom() {
        var typingElems = $$("li.typing");
        for (i = 0; i < typingElems.length; i++) {
            var typer = typingElems[i].dataset.typer;
            typingElems[i].remove();
            writeListItem(typer, " is typing", "normal typing old");
        }
    }

    function isMobile() {
        //return (navigator.userAgent.toLowerCase().indexOf("mobile") != -1);
        return (window.innerWidth <= 480 || navigator.userAgent.toLowerCase().indexOf("mobile") !== -1);
    }

    // actual script

    $("#m").focus();

    onlineUsers.push(nick);
    updateOnlineUsers();

    $("form").onsubmit = function (e) {
        e.preventDefault();
        var text = $("#m").value.substring(0, 10000);
        if ($("#m").value.split(" ").join("").length !== 0) {
            socket.emit("chat message", {
                text: text,
                nick: nick
            });
            socket.emit("stopped typing");
            writeListItem(nick, addEmotes(encodeHTML(text).autoLink(autoLinkOptions)), "self");
        }
        this.reset();
    };

    $("#m").onkeyup = function () {
        if ($("#m").value.length > 0) {
            socket.emit("typing");
        } else {
            socket.emit("stopped typing");
        }
    };

    function fileTooBig() {
        alert("The file you chose is too big. Choose a file less than 20mb in size.");
    }

    function handleFile(file) {
        if (file.size < 20971520) { // ~20mb
            var blobURL = URL.createObjectURL(file);
            socket.emit("file share", {
                file: file,
                nick: nick,
                name: file.name,
                type: file.type
            });

            if (file.type.indexOf("image/") !== -1) {
                writeListItem(nick, "<a href='" + blobURL + "'><img src='" + blobURL + "'></a>", "self");
            } else if (file.type.indexOf("video/") !== -1) {
                writeListItem(nick, "<video src='" + blobURL + "' controls></video><a href='" + blobURL + "'>" + file.name + "</a>", "self");
            } else if (file.type.indexOf("audio/") !== -1) {
                writeListItem(nick, "<audio src='" + blobURL + "' controls></audio><a href='" + blobURL + "'>" + file.name + "</a>", "self");
            } else {
                writeListItem(nick, "<a href='" + blobURL + "'>" + file.name + "</a>", "self");
            }

            closeFileOpts();
        } else {
            fileTooBig();
        }
    }

    $("#attach_file input[type=file]").onchange = function () {
        var files = this.files;

        var inc = files.length;
        while (inc) {
            handleFile(files[inc - 1]);
            inc--;
        }
    };

    document.body.addEventListener("dragover", function (e) {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    }, false);

    document.body.addEventListener("drop", function (e) {
        e.stopPropagation();
        e.preventDefault();

        var files = e.dataTransfer.files;

        var inc = files.length;
        while (inc) {
            handleFile(files[inc - 1]);
            inc--;
        }
    }, false);

    function closeFileOpts() {
        $("#fileoptions").classList.remove("opened");
        $("#fileoptions").classList.remove("booth");
        if (videoStream) {
            videoStream.stop();
        }
        fileOptsOpened = false;
    }

    function openFileOpts() {
        $("#fileoptions").classList.add("opened");
        fileOptsOpened = true;
    }

    $("#fileshare").onclick = function () {
        if (!isMobile()) {
            if (fileOptsOpened) {
                closeFileOpts();
            } else {
                openFileOpts();
            }
        } else {
            $("#fileoptions input[type=file]").click();
        }
    };

    var videoStream;

    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

    $("#take_photo").onclick = function () {
        $("#fileoptions").classList.add("booth");

        navigator.getUserMedia({
            video: true
        }, function (stream) {
            videoStream = stream;
            $("#photobooth video").src = URL.createObjectURL(videoStream);
        }, function () {
            alert("Please allow webcam access to use this feature");
        });
    };

    $("#photobooth input").onclick = function () {
        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext("2d");
        canvas.height = 300;
        canvas.width = 400;
        ctx.drawImage($("#photobooth video"), 0, 0, 400, 300);

        var dataURI = canvas.toDataURL();

        socket.emit("file share", {
            file: dataURI,
            nick: nick,
            name: "Abungo booth capture.png",
            type: "image/png"
        });

        videoStream.stop();

        writeListItem(nick, "<a href='" + dataURI + "'><img src='" + dataURI + "'></a>", "self");

        closeFileOpts();
    };

    socket.on("chat message", function (msg) {
        var text = msg.text;
        var sender = msg.nick;
        var type;

        msg.fromConsole === true ? type = "normal console" : type = "normal";

        writeListItem(sender, addEmotes(encodeHTML(text).autoLink(autoLinkOptions)), type);
    });

    socket.on("user joined", function (data) {
        var nick = data.nick;
        writeListItem(nick, " joined", "status");
        onlineUsers = data.users;
        updateOnlineUsers();
    });

    socket.on("user left", function (data) {
        var nick = data.nick;
        writeListItem(nick, " left", "status");
        onlineUsers = data.users;
        updateOnlineUsers();
    });

    socket.on("kick", function (reason) {
        alert("You have been kicked: " + reason);
        location.reload();
    });

    socket.on("still kicked", function () {
        alert("Please wait 5 minutes after getting kicked");
        history.back();
    });

    socket.on("typing", function (nick) {
        typingList[nick] = true;
        updateTypingList();
    });

    socket.on("stopped typing", function (nick) {
        delete typingList[nick];
        updateTypingList();
    });

    socket.on("server stopping", function () {
        alert("Server is stopping. Your messages will not be sent until the server is back online and you refresh the page.");
    });

    socket.on("file share", function (data) {
        var blobURL;
        if (typeof data.file == "string") {
            blobURL = data.file;
        } else {
            var blob = new Blob([data.file], {
                type: data.type
            });
            blobURL = URL.createObjectURL(blob);
        }

        if (data.type.indexOf("image/") != -1) {
            writeListItem(data.nick, "<a href='" + blobURL + "'><img src='" + blobURL + "'></a>", "normal");
        } else if (data.type.indexOf("video/") != -1) {
            writeListItem(data.nick, "<video src='" + blobURL + "' controls></video><a href='" + blobURL + "'>" + data.name + "</a>", "normal");
        } else if (data.type.indexOf("audio/") != -1) {
            writeListItem(data.nick, "<audio src='" + blobURL + "' controls></audio><a href='" + blobURL + "'>" + data.name + "</a>", "normal");
        } else {
            writeListItem(data.nick, "<a href='" + blobURL + "'>" + data.name + "</a>", "normal");
        }
    });

    socket.on("brainwash", function () {
        $("#messages").innerHTML = "";
    });

    socket.on("file too big", fileTooBig);

    $("#current_room").innerHTML = "<strong>Room</strong>: " + room;

    window.onbeforeunload = function () {
        socket.disconnect();
    }
}