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

var textifyHTML = function(str) {
    var elem = document.createElement("div");
    elem.innerHTML = str.replace(/<br>/gi, "\n");
    return elem.textContent;
};

var HTMLify = function(str) {
    return str.replace(/\n/gi, "<br>");
};

var dataURItoBlob = function(dataURI) { // by user Stoive on StackOverflow http://stackoverflow.com/a/5100158/3234159
    var byteString;
    if (dataURI.split(",")[0].indexOf("base64") >= 0) {
        byteString = atob(dataURI.split(",")[1]);
    } else {
        byteString = unescape(dataURI.split(",")[1]);
    }

    var mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];

    var ia = new Uint8Array(byteString.length);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ia], { type: mimeString });
};

var clamp = function(n, max){
    if (n <= max) return n;
    else return max
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
    
var makeMessageElem = function(data, type, scrollToBottom) {
    var elem = document.createElement("div");
    
    var bodyContent;
    
    var isFile = !!(data.mediaID || data.mediaUpload);
    var isSticker = !!data.sticker;
    var isMessage;
    
    if (isFile) {
        var mediaURL = (data.mediaID ? "/file/" + data.mediaID + "/" + data.mediaName : window.URL.createObjectURL(data.mediaUpload));
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
    } else if (isSticker) {
        bodyContent = "<img class='message_sticker message_sticker-" + data.stickerSize + "' src='img/stickers/" + data.sticker + ".svg'>";
    } else {
        isMessage = true;
        // replace inline stickers with image
        if (!abungoState.stickerNames) {
            abungoState.stickerNames = [].slice.call($$(".popup_popup-stickers_sticker")).map(function(elem) {
                return elem.getAttribute("title");
            });
        }
        var stickerNames = abungoState.stickerNames;
        var message = data.message;
        stickerNames.forEach(function(stickerName) {
            message = message.replace(new RegExp(":" + stickerName + ":|\\(" + stickerName + "\\)", "g"), "<img class='message_sticker message_sticker-small' src='img/stickers/" + stickerName + ".svg'>");
        });
        bodyContent = Autolinker.link(HTMLify(message));
    }

    elem.innerHTML = "<h3>" + data.nick + "</h3><p>" + bodyContent + "</p>";
    elem.classList.add("message");
    elem.classList.add("message-" + type);
    if (isFile) {
        elem.classList.add("message-file");
    }
    if (isSticker) {
        elem.classList.add("message-sticker");
    }
    if (type === "self") {
        elem.dataset.messageId = data.messageID;
        elem.classList.add("message-notdelivered");
    }
    messagesElem.appendChild(elem);
    if (scrollToBottom) {
        messagesElem.scrollTop = messagesElem.offsetHeight + messagesElem.scrollHeight;
    }
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

var isAtBottom = function() {
    return (messagesElem.scrollTop + messagesElem.offsetHeight === messagesElem.scrollHeight);
};

var makeMessageID = function() {
    return "" + Math.round(Math.random() * 100000) + new Date().getTime() + Math.round(Math.random() * 100000);
};

/* audio recorder functions from http://typedarray.org/from-microphone-to-wav-with-getusermedia-and-web-audio/ */

var mergeBuffers = function(channelBuffer, recordingLength) {
    var result = new Float32Array(recordingLength);
    var offset = 0;
    var lng = channelBuffer.length;
    for (var i = 0; i < lng; i++){
        var buffer = channelBuffer[i];
        result.set(buffer, offset);
        offset += buffer.length;
    }
    return result;
};

var interleave = function(leftChannel, rightChannel) {
    var length = leftChannel.length + rightChannel.length;
    var result = new Float32Array(length);

    var inputIndex = 0;

    for (var index = 0; index < length; ){
        result[index++] = leftChannel[inputIndex];
        result[index++] = rightChannel[inputIndex];
        inputIndex++;
    }
    return result;
};

var writeUTFBytes = function(view, offset, string) { 
    var lng = string.length;
    for (var i = 0; i < lng; i++){
        view.setUint8(offset + i, string.charCodeAt(i));
    }
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

var messagesElem;

socket.on("login_accepted", function(data) {
    abungoState.userID = data.userID;
    abungoState.nick = data.nick;
    abungoState.room = data.room;
    abungoState.users = data.users;
    
    console.log("login_accepted", data);
    
    messagesElem = $(".messages");
    var sendbarElem = $(".sendbar");
    var sendbarComposeInput = $(".sendbar_compose_input");
    var sendbarFileInput = $("#fileinput");
    
    var sidebarHideBtn = $("#sidebar_collapse");
    var sidebarLogoutBtn = $("#logout_button");
    
    loginButton.textContent = "Connected.";
    loginForm.classList.add("notouch");
    document.body.classList.add("loggedin");
    each($$(".notouch input"), function(elem) {
        elem.setAttribute("readonly", "true");
    });
    sendbarComposeInput.focus();
    
    document.title = abungoState.room + " - " + document.title;
    
    /* send messages */
    
    sendbarComposeInput.addEventListener("keydown", function(e){
        if (e.keyCode === 13 && !e.shiftKey) {
            e.preventDefault();
            if (this.textContent.length > 0) {
                var messageData = {
                    message: textifyHTML(this.innerHTML),
                    userID: abungoState.userID,
                    messageID: makeMessageID()
                };
                socket.emit("message", messageData);
                makeMessageElem(messageData, "self", isAtBottom());
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
        var type;
        
        if (data.nick === abungoState.nick) {
            type = "self";
            var messageElem = $(".message-notdelivered[data-message-id='" + data.messageID + "']");
            console.log(messageElem, data.messageID);
            messageElem.classList.remove("message-notdelivered");
        } else {
            type = "received";
            makeMessageElem(data, type, isAtBottom());
        }
        
        var notifText;
        if (data.mediaID) {
            notifText = "File: " + data.mediaName;
        } else if (data.sticker) {
            notifText = ":" + data.sticker + ":";
        } else {
            notifText = data.message;
        }
        showNotification(data.nick, notifText);
    });
    
    /* send files */
    
    // file input
    
    sendbarFileInput.addEventListener("change", function(){
        [].forEach.call(this.files, function(file) {
            if (file && file.size < 10000000) { // 10 mb
                var messageData = {
                    userID: abungoState.userID,
                    mediaUpload: file,
                    mediaType: file.type,
                    mediaName: file.name,
                    messageID: makeMessageID()
                };
                socket.emit("message", messageData);
                makeMessageElem(messageData, "self", isAtBottom());
            } else if (file) {
                alert("'" + file.name + "' is too big. You can only upload files less than 10 megabytes in size.");
            }
        });
    });
    
    // drag and drop
    
    window.addEventListener("dragover", function(e) {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    }, false);
    
    window.addEventListener("drop", function(e) {
        e.stopPropagation();
        e.preventDefault();

        var files = e.dataTransfer.files;
        
        [].forEach.call(files, function(file) {
            if (file && file.size < 10000000) { // 10 mb
                var messageData = {
                    userID: abungoState.userID,
                    mediaUpload: file,
                    mediaType: file.type,
                    mediaName: file.name,
                    messageID: makeMessageID()
                };
                socket.emit("message", messageData);
                makeMessageElem(messageData, "self", isAtBottom());
            } else if (file) {
                alert("'" + file.name + "' is too big. You can only upload files less than 10 megabytes in size.");
            }
        })
    }, false);
    
    /* send stickers */
    
    $(".popup_popup-stickers").addEventListener("mousedown", function(e) {
        if (e.target.classList.contains("popup_popup-stickers_sticker")) {
            var mousedownDate = new Date();
            
            e.target.onmouseup = function() {
                var mouseupDate = new Date();
                var delta = mouseupDate - mousedownDate;
                
                var sizesCount = 3;
                var maxTime = 2000;
                
                var size = Math.round((sizesCount - 1) * delta/maxTime);
                
                if (size <= 2) {
                    var messageData = {
                        userID: abungoState.userID,
                        sticker: e.target.getAttribute("title"),
                        stickerSize: size,
                        messageID: makeMessageID()
                    };
                    socket.emit("message", messageData);
                    makeMessageElem(messageData, "self", isAtBottom());
                }
            };
        }
    });
    
    /* photo booth */
    
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    
    (function() {
        var videoStream;
        
        $("label.button.popup-camera").addEventListener("click", function(e) {
            if (e.target === this) {
                var videoElem = $(".popup_popup-camera_preview");
                if (!videoElem.src || videoElem.src.length < 1) {
                    navigator.getUserMedia({ video: true }, function(stream) {
                        videoStream = stream;

                        videoElem.src = window.URL.createObjectURL(stream);
                        videoElem.onloadeddata = function(e) {
                            var dimensionCheckInterval = setInterval(function() {
                                if (videoElem.offsetWidth !== 0 && videoElem.offsetWidth !== 0) {
                                    clearInterval(dimensionCheckInterval);
                                    console.log("found dimensions", videoElem.offsetWidth, videoElem.offsetHeight);
                                    $(".popup_popup-camera").style.height = videoElem.offsetHeight + "px";
                                } else {
                                    console.log("waiting for dimensions");
                                }
                            });
                        };
                    }, function() {
                        alert("Please allow webcam access in order to use the photo booth.");
                    });
                } else if (this.classList.contains("popup-opened")) {
                    videoElem.removeAttribute("src");
                    videoStream.stop();
                }
            }
        });
    })();
    
    $(".popup_popup-camera label.button").addEventListener("click", function() {
        var videoElem = $(".popup_popup-camera_preview");
        if (videoElem.src && videoElem.src.length >= 1) {
            var canvas = document.createElement("canvas");
            var ctx = canvas.getContext("2d");
            canvas.width = videoElem.offsetWidth;
            canvas.height = videoElem.offsetHeight;
            ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);
            
            var dataURI = canvas.toDataURL();
            var blob = dataURItoBlob(dataURI);
            var now = new Date();
            
            var messageData = {
                userID: abungoState.userID,
                mediaUpload: blob,
                mediaType: "image/png",
                mediaName: "Abungo snap at " + now.toDateString() + " " + now.toTimeString() + ".png",
                messageID: makeMessageID()
            };
            socket.emit("message", messageData);
            makeMessageElem(messageData, "self", isAtBottom());
        }
    });
    
    /* record audio */
    
    (function() { // adapted from http://typedarray.org/from-microphone-to-wav-with-getusermedia-and-web-audio
        var audioStream;

        var leftchannel = [];
        var rightchannel = [];
        var recordingLength = 0;
        var sampleRate;
        var audioVolume = 0;
        
        var recordBtn = $(".popup_popup-voice_record");
        var volumeElem = $(".popup_popup-voice_volumecircle");
        
        var volumeInterval;
        
        recordBtn.addEventListener("click", function(e) {
            var that = this;
            
            if (!that.classList.contains("recording")) {
                navigator.getUserMedia({ audio: true }, function(stream) {
                    audioStream = stream;
                    
                    // create audio context
                    window.AudioContext = window.AudioContext || window.webkitAudioContext;
                    var context = new AudioContext();

                    // retrieve sample rate to be used for wav packaging
                    sampleRate = context.sampleRate;

                    // create gain node and analyser
                    var volume = context.createGain();
                    
                    var analyser = context.createAnalyser();
                    analyser.fftSize = 256;

                    // create audio node from stream
                    var audioInput = context.createMediaStreamSource(stream);

                    // connect nodes
                    audioInput.connect(volume);
                    volume.connect(analyser);
                    
                    var streamData = new Uint8Array(analyser.fftSize / 2);

                    // lower values result in lower latency. 
                    // higher values needed to avoid audio breakup and glitches
                    var bufferSize = 2048;
                    var recorder = context.createScriptProcessor(bufferSize, 2, 2);

                    recorder.onaudioprocess = function(e){
                        if (!stream.ended) {
                            var left = e.inputBuffer.getChannelData(0);
                            var right = e.inputBuffer.getChannelData(1);
                            // clone samples
                            leftchannel.push(new Float32Array(left));
                            rightchannel.push(new Float32Array(right));
                            recordingLength += bufferSize;
                            
                            // get volume
                            analyser.getByteFrequencyData(streamData);
                            var total = 0;
                            for (var i = 0; i < 80; i++) { // get the volume from the first 80 bins, else it gets too loud with treble
                                total += streamData[i];
                            }
                            audioVolume = total;
                        } else {
                            recorder.onaudioprocess = null;
                            audioVolume = 0;
                            clearInterval(volumeInterval);
                        }
                    };
                    
                    // volume display interval
                    volumeInterval = setInterval(function() {
                        if (recordBtn.classList.contains("recording")) {
                            var scale = audioVolume / 2000;
                            volumeElem.style.transform = "scale(" + scale + ")";
                        }
                    }, 50);

                    // connect recorder
                    volume.connect(recorder);
                    recorder.connect(context.destination);
                    
                    // add class
                    that.classList.add("recording");
                }, function() {
                    alert("Please allow microphone access in order to use the audio recorder.");
                });
            } else {
                // stop the stream
                audioStream.stop();
                
                // flatten left and right channels
                var leftBuffer = mergeBuffers(leftchannel, recordingLength);
                var rightBuffer = mergeBuffers(rightchannel, recordingLength);
                // interleave channels together
                var interleaved = interleave(leftBuffer, rightBuffer);

                // create buffer and view to create wav file
                var buffer = new ArrayBuffer(44 + interleaved.length * 2);
                var view = new DataView(buffer);

                // write wav container
                // riff chunk descriptor
                writeUTFBytes(view, 0, "RIFF");
                view.setUint32(4, 44 + interleaved.length * 2, true);
                writeUTFBytes(view, 8, "WAVE");
                // fmt subchunk
                writeUTFBytes(view, 12, "fmt ");
                view.setUint32(16, 16, true);
                view.setUint16(20, 1, true);
                // stereo
                view.setUint16(22, 2, true);
                view.setUint32(24, sampleRate, true);
                view.setUint32(28, sampleRate * 4, true);
                view.setUint16(32, 4, true);
                view.setUint16(34, 16, true);
                // data subchunk
                writeUTFBytes(view, 36, "data");
                view.setUint32(40, interleaved.length * 2, true);

                // write pcm samples
                var lng = interleaved.length;
                var index = 44;
                var volume = 1;
                for (var i = 0; i < lng; i++){
                    view.setInt16(index, interleaved[i] * (0x7FFF * volume), true);
                    index += 2;
                }

                // final blob
                var blob = new Blob([view], { type : "audio/wav" } );
                
                // clear the stuff
                leftchannel.length = 0;
                rightchannel.length = 0;
                recordingLength = 0;
                
                // send the blob
                var now = new Date();
                
                var messageData = {
                    userID: abungoState.userID,
                    mediaUpload: blob,
                    mediaType: "audio/wav",
                    mediaName: "Abungo audio at " + now.toDateString() + " " + now.toTimeString() + ".wav",
                    messageID: makeMessageID()
                };
                socket.emit("message", messageData);
                makeMessageElem(messageData, "self", isAtBottom());
                
                that.classList.remove("recording");
            }
        });
    })();
    
    /* user join/leave */
    
    socket.on("user_joined", function(data) {
        if (abungoState.users.indexOf(data.nick) === -1) {
            abungoState.users.push(data.nick);
        }
        messagesElem.appendChild(makeJoinElem(data, "joined", isAtBottom()));
    });
    
    socket.on("user_left", function(data) {
        abungoState.users.remove(data.nick);
        messagesElem.appendChild(makeJoinElem(data, "left", isAtBottom()));
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
    
    each($$("label.button.popup"), function(elem) {
        elem.addEventListener("click", function(e) {
            if (e.target === this) {
                if (!this.classList.contains("popup-opened")) {
                    each($$("label.button.popup-opened"), function(elemOpened) {
                        elemOpened.classList.remove("popup-opened");
                    });
                }
                this.classList.toggle("popup-opened");
            }
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