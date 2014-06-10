var socket = io();

var $ = function(selector){return document.querySelector(selector)};
var $$ = function(selector){return document.querySelectorAll(selector)};

var nick, room;

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

if (localStorage.lastNick) {
    $("#nick_input").value = decodeHTML(localStorage.lastNick);
}
if (localStorage.lastRoom) {
    $("#chatroom").value = decodeHTML(localStorage.lastRoom);
} else {
    $("#chatroom").value = "yeya";
}

$("#nick_input").focus();

$("#nick_input").onkeydown = function(e){
    if (e.which == 13) { // enter
        //chooseNick();
        $("#chatroom").focus();
    }
}

$("#chatroom").onkeydown = function(e){
    if (e.which == 13) {
        chooseNick();
    }
}

function chooseNick(){
    nick = encodeHTML($("#nick_input").value.substring(0,100));
    room = encodeHTML($("#chatroom").value.toLowerCase().substring(0,100));
    if (nick && room) {
        socket.emit("nick chosen",{
            nick: nick,
            room: room
        });
        localStorage.lastNick = nick;
        localStorage.lastRoom = room;
        $("#welcome").style.opacity = "0";
        setTimeout(function(){
            $("#welcome").style.display = "none";
        },300);
        main();
    } else {
        alert("Choose a nickname and room");
        $("#nick_input").focus();
    }
};

socket.on("try resume",function(){
    if (nick) {
        socket.emit("nick chosen",nick);
    }
})

function main() {    
    var onlineUsers = [];
    var typingList = [];
    var unreadCount = 0;
    
    var windowIsFocused = true;
    
    Array.prototype.remove = function(element){return this.splice(this.indexOf(element),1)};
    
    HTMLElement.prototype.scrollBottom = function(){
        return this.scrollHeight - this.scrollTop - this.offsetHeight;
    }
    
    var autoLinkOptions = {
        callback: function(url) {
            return "<a href='"+url+"' target='_blank'>"+url+"</a>";
        }
    }
    
    window.onblur = function(){
        windowIsFocused = false;
    }
    
    window.onfocus = function(){
        windowIsFocused = true;
        unreadCount = 0;
        updateUnreadCount();
    }
    
    function writeListItem(html,type,time) {
        var wasAtBottom = $("#messages").scrollBottom() == 0; // boolean
        
        var liNode = document.createElement("li");
        liNode.innerHTML = "<div class='message'>" + html + "</div>";
        
        if (type == "self" || type == "status") {
            liNode.classList.add(type);
        } else {
            liNode.classList.add("normal");
        }
        if (type == "console") {
            liNode.classList.add("console");
        }
        if (type == "typing") {
            liNode.classList.add("typing");
        }
        
        $("#messages").appendChild(liNode);
        
        if (wasAtBottom || type == "self") {
            $("#messages").scrollTop = $("#messages").scrollHeight;
        }
        
        if ((!windowIsFocused || !wasAtBottom) && type != "status" && type != "typing" && type != "self") {
            playSound("sound/message.ogg");
        }
        
        if (!windowIsFocused && type != "status" && type != "typing" && type != "self") {
            unreadCount += 1;
            updateUnreadCount();
        }
        
        if (type != "typing") {
            updateTypingList();
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
            document.title = "Abungo [" + unreadCount.toString() + "]"
        } else {
            document.title = "Abungo";
        }
    }
    
    function updateTypingList() {
        var tListKeys = Object.keys(typingList).sort();
        var typings = $$("li.typing");
        for (i=0; i<typings.length;i++) {
            typings[i].parentElement.removeChild(typings[i]);
        }
        for (i=0; i<tListKeys.length; i++) {
            if (typingList[tListKeys[i]] == true) {
                writeListItem("<strong>" + tListKeys[i] + "</strong> is typing","typing", new Date().toString());
            }
        }
    }
    
    // actual script
    
    $("#m").focus();
    
    onlineUsers.push(nick);
    updateOnlineUsers();
    
    $("form").onsubmit = function(e){
        e.preventDefault();
        var text = $("#m").value.substring(0,10000);
        if ($("#m").value.split(" ").join("").length != 0) {
            socket.emit("chat message",{
                text: text,
                nick: nick
            });
            socket.emit("stopped typing");
            writeListItem("<strong>" + nick + "</strong>" + encodeHTML(text).autoLink(autoLinkOptions), "self", new Date().toString());
        }
        this.reset();
    }
    
    $("#m").onkeyup = function(){
        if ($("#m").value.length > 0) {
            socket.emit("typing");
        } else {
            socket.emit("stopped typing");
        }
    };
    
    $("#fileshare input[type=file]").onchange = function(){
        var file = this.files[0];
        if (file) {
            if (file.size < 2233076) { // ~2mb
                var reader = new FileReader();
                reader.onload = function() {
                    if (file.type.indexOf("image/") != -1) { // file is an image
                        var dataURI = this.result;
                        socket.emit("image share",{
                            file: dataURI,
                            nick: nick,
                            fileName: file.name
                        });
                        writeListItem("<strong>"+nick+"</strong><a href='"+dataURI+"' target='_blank'><img src='"+dataURI+"'/></a>","self",new Date().toString());
                    } else if (file.type.indexOf("audio/") != -1) {
                        var dataURI = this.result;
                        socket.emit("audio share",{
                            file: dataURI,
                            nick: nick,
                            fileName: file.name
                        });
                        writeListItem("<strong>"+nick+"</strong><audio controls src='"+dataURI+"'/></audio><a href='"+dataURI+"' target='_blank'>"+file.name+"</a>","self",new Date().toString());
                    } else {
                        var dataURI = this.result;
                        socket.emit("file share",{
                            file: dataURI,
                            nick: nick,
                            fileName: file.name
                        });
                        writeListItem("<strong>"+nick+"</strong><a href='"+dataURI+"' target='_blank'>"+file.name+"</a>","self",new Date().toString());
                    }
                }
                reader.readAsDataURL(file);
            } else {
                alert("The file you chose is too big. Choose a file less than 2mb in size.");
            }
        }
    }
    
    socket.on("chat message", function(msg){
        var text = msg.text;
        var sender = msg.nick;
        var time = msg.time;
        var type;
        
        msg.fromConsole == true ? type = "console" : type = null;
        
        writeListItem("<strong>"+sender+"</strong>" + encodeHTML(text).autoLink(autoLinkOptions), type, time);
    });
    
    socket.on("user joined", function(data){
        var nick = data.nick;                    
        writeListItem("<strong>"+nick+"</strong> joined", "status", data.time);
        onlineUsers = data.users;
        updateOnlineUsers();
    });
    
    socket.on("user left", function(data){
        var nick = data.nick;
        writeListItem("<strong>"+nick+"</strong> left", "status", data.time);
        onlineUsers = data.users;
        updateOnlineUsers();
    });
    
    socket.on("kick", function(reason){
        alert("You have been kicked: " + reason);
        if (reason != "nick already in use") {
            history.back();
        } else {
            location.reload();
        }
    });
    
    socket.on("still kicked",function(){
        alert("Please wait 5 minutes after getting kicked");
        history.back();
    });
    
    socket.on("typing", function(nick){
        typingList[nick] = true;
        updateTypingList();
    });
    
    socket.on("stopped typing",function(nick){
        typingList[nick] = false;
        updateTypingList();
    });
    
    socket.on("server stopping",function(){
        alert("Server is stopping. Your messages will not be sent until the server is back online and you refresh the page.");
    });
    
    socket.on("image share", function(data){
        writeListItem("<strong>"+data.nick+"</strong><a href='"+data.file+"' target='_blank'><img src='"+data.file+"'/></a>","normal",data.time);
    });
    
    socket.on("audio share", function(data){
        writeListItem("<strong>"+data.nick+"</strong><audio controls src='"+data.file+"'></audio><a href='"+data.file+"' target='_blank'>"+data.fileName+"</a>","normal",data.time);
    });
    
    socket.on("file share", function(data){
        writeListItem("<strong>"+data.nick+"</strong><a href='"+data.file+"' target='_blank'>"+data.fileName+"</a>","normal",data.time);
    });
    
    socket.on("brainwash", function(){
        $("#messages").innerHTML = "";
    });
    
    $("#current_room").innerHTML = "<strong>Room</strong>: " + room;
}