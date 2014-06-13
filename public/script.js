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
    if (nick.split(" ").join("").length && room.split(" ").join("").length) {
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
    var fileOptsOpened = false;
    
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
    
    function dataURItoBlob(dataURI) {
        var byteString;
        if (dataURI.split(',')[0].indexOf('base64') >= 0) {
            byteString = atob(dataURI.split(',')[1]);
        } else {
            byteString = unescape(dataURI.split(',')[1]);
        }
        var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
        var ab = new ArrayBuffer(byteString.length);
        var ia = new Uint8Array(ab);
        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        var bb = new BlobBuilder();
        bb.append(ab);
        return bb.getBlob(mimeString);
    }
    
    function isMobile() {
        //return (navigator.userAgent.toLowerCase().indexOf("mobile") != -1);
        return (window.innerWidth <= 480);
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
    
    function handleFile(file) {
        if (file.size < 20971520) { // ~20mb
            var blobURL = URL.createObjectURL(file);
            socket.emit("file share",{
                file: file,
                nick: nick,
                name: file.name,
                type: file.type
            });
            
            if (file.type.indexOf("image/") != -1) {
                writeListItem("<strong>"+nick+"</strong><a target='_blank' href='"+blobURL+"' target='_blank'><img src='"+blobURL+"'></a>","self",new Date().toString());
            } else if (file.type.indexOf("video/") != -1) {
                writeListItem("<strong>"+nick+"</strong><video src='"+blobURL+"' controls></video><a target='_blank' href='"+blobURL+"'>"+file.name+"</a>","self",new Date().toString());
            } else if (file.type.indexOf("audio/") != -1) {
                writeListItem("<strong>"+nick+"</strong><audio src='"+blobURL+"' controls></audio><a target='_blank' href='"+blobURL+"'>"+file.name+"</a>","self",new Date().toString());
            } else {
                writeListItem("<strong>"+nick+"</strong><a target='_blank' href='"+blobURL+"'>"+file.name+"</a>","self",new Date().toString());
            }
            
            closeFileOpts();
        } else {
            alert("The file you chose (" + file.name + ") is too big. Choose a file less than 20mb in size.");
        }
    }
    
    $("#attach_file input[type=file]").onchange = function(){
        var files = this.files;
        if (files && files.length > 0) {
            for (i=0; i<files.length; i++) {
                handleFile(files[i]);
            }
        }
    }
    
    document.body.addEventListener("dragover", function(e){
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    }, false);
    
    document.body.addEventListener("drop", function(e){
        e.stopPropagation();
        e.preventDefault();
        
        var files = e.dataTransfer.files;
        
        if (files && files.length > 0) {
            for (i=0; i<files.length; i++) {
                handleFile(files[i]);
            }
        }
    }, false);
    
    function closeFileOpts() {
        $("#fileoptions").classList.remove("opened");
        $("#fileoptions").classList.remove("booth");
        $("#filearrow").classList.remove("visible");
        fileOptsOpened = false;
    }
    
    function openFileOpts() {
        $("#fileoptions").classList.add("opened");
        $("#filearrow").classList.add("visible");
        fileOptsOpened = true;
    }
    
    $("#fileshare").onclick = function(){
        if (!isMobile()) {
            if (fileOptsOpened) {
                closeFileOpts();
            } else {
                openFileOpts();
            }
        } else {
            $("#fileoptions input[type=file]").click();
        }
    }
    
    var videoStream;
    
    $("#take_photo").onclick = function(){
        $("#fileoptions").classList.add("booth");
        
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
  
        navigator.getUserMedia({
            video: true
        }, function(stream) {
            videoStream = stream;
            $("#photobooth video").src = URL.createObjectURL(videoStream);
        }, function() {
            alert("Please allow webcam access to use this feature");
        });
    }
    
    $("#photobooth input").onclick = function(){
        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext("2d");
        canvas.height = 300;
        canvas.width = 400;
        ctx.drawImage($("#photobooth video"),0,0,400,300);
        
        var dataURI = canvas.toDataURL();
    
        socket.emit("file share",{
            file: dataURI,
            nick: nick,
            name: "Abungo booth capture.png",
            type: "image/png"
        });
        
        videoStream.stop();
        
        writeListItem("<strong>"+nick+"</strong><img src='"+dataURI+"'/>","self",new Date().toString());
        
        closeFileOpts();
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
    
    socket.on("file share", function(data){
        var blobURL;
        if (typeof data.file == "string") {
            blobURL = data.file;
        } else {
            var blob = new Blob([data.file],{type:data.type});
            blobURL = URL.createObjectURL(blob);
        }
        
        if (data.type.indexOf("image/") != -1) {
            writeListItem("<strong>"+nick+"</strong><a target='_blank' href='"+blobURL+"' target='_blank'><img src='"+blobURL+"'>"+data.name+"</a>","normal",new Date().toString());
        } else if (data.type.indexOf("video/") != -1) {
            writeListItem("<strong>"+nick+"</strong><video src='"+blobURL+"' controls></video><a target='_blank' href='"+blobURL+"'>"+data.name+"</a>","normal",new Date().toString());
        } else if (data.type.indexOf("audio/") != -1) {
            writeListItem("<strong>"+nick+"</strong><audio src='"+blobURL+"' controls></audio><a target='_blank' href='"+blobURL+"'>"+data.name+"</a>","normal",new Date().toString());
        } else {
            writeListItem("<strong>"+nick+"</strong><a target='_blank' href='"+blobURL+"'>"+data.name+"</a>","self",new Date().toString());
        }
    });
    
    socket.on("brainwash", function(){
        $("#messages").innerHTML = "";
    });
    
    $("#current_room").innerHTML = "<strong>Room</strong>: " + room;
    
    window.onbeforeunload = function(){
        socket.disconnect();
    }
}