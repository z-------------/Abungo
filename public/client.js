/* abungo object for storing Abungo-related stuff */

var abungo = {
    state: {}
};

(function() {
    abungo.constants = {
        MDL_MAPPING: {
            // MDL: HTML
            "_": "strong",
            "*": "em"
        },
        ATTACHMENT_PLUGIN_REQUIRED_KEYS: [
            "name", "icon", "id", "content",
            "onOpen", "onClose"
        ],

        classes: {
            ATTACHMENT_BAR: "sendbar_attach"
        }
    };

    abungo.messages = {};
    abungo.messages.send = function(content) {
        if (!abungo.state.nick || !abungo.state.room || !abungo.state.userID) {
            throw new Error("User isn't logged in");
            return;
        }
        if (!content || typeof content !== "object") {
            throw new Error("Message content missing");
            return;
        }

        var type;

        if (content.message) {
            type = "text";
        } else if (content.sticker && content.sticker.name) {
            type = "sticker";
        } else if (content.file) {
            type = "file";
        } else {
            throw new Error("Unknown message type");
            return;
        }

        if (type === "file") {
            if (content.file && content.file.size < 10000000) { // 10 mb
                var messageData = {
                    userID: abungo.state.userID,
                    mediaUpload: content.file,
                    mediaType: content.file.type,
                    mediaName: content.file.name,
                    messageID: makeMessageID()
                };
                socket.emit("message", messageData);
                makeMessageElem(messageData, "self", isAtBottom());
            } else if (file) {
                throw new Error("File (" + mediaName + ") is too big");
            }
        } else if (type === "sticker") {
            var stickerSize = content.sticker.size || 0;
            if (stickerSize <= 2) {
                var messageData = {
                    userID: abungo.state.userID,
                    sticker: content.sticker.name,
                    stickerSize: stickerSize,
                    messageID: makeMessageID()
                };
                socket.emit("message", messageData);
                makeMessageElem(messageData, "self", true);
            } else {
                throw new Error("Unsupported sticker size (" + stickerSize.toString() + ")");
            }
        } else if (type === "text") {
            var messageData = {
                message: textifyHTML(content.message),
                userID: abungo.state.userID,
                messageID: makeMessageID()
            };
            socket.emit("message", messageData);
            makeMessageElem(messageData, "self", true);
        }
    };

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

    var parseMDL = function(str) { // MarkDownLite (yeah, i just made that up)
        // formatting
        var lines = str.split("<br>");
        for (var j = 0; j < lines.length; j++) {
            for (var char in abungo.constants.MDL_MAPPING) {
                if (abungo.constants.MDL_MAPPING.hasOwnProperty(char)) {
                    var tagName = abungo.constants.MDL_MAPPING[char];

                    if (char === "*") {
                        char = "\\*"; // escape regex special chars
                    }

                    var matches = lines[j].match(new RegExp(char, "g")) || [];

                    for (var i = 0; i < matches.length; i += 2) {
                        if (matches[i] && matches[i+1]) { // pair of specified char
                            var pattern = new RegExp(char);
                            lines[j] = lines[j].replace(pattern, "<" + tagName + ">")
                                .replace(pattern, "</" + tagName + ">");
                        }
                    }
                }
            }
        }

        var string = lines.join("<br>");

        // inline stickers
        for (stickerName of abungo.constants.STICKER_NAMES) {
            string = string.replace(new RegExp(":" + stickerName + ":|\\(" + stickerName + "\\)", "g"), "<img class='message_sticker message_sticker-small' src='img/stickers/" + stickerName + ".svg'>");
        };

        return string;
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

    var throttle = function(type, name, obj) { // throttle function from MDN https://developer.mozilla.org/en-US/docs/Web/Events/resize
        var obj = obj || window;
        var running = false;
        var func = function() {
            if (running) { return; }
            running = true;
            requestAnimationFrame(function() {
                obj.dispatchEvent(new CustomEvent(name));
                running = false;
            });
        };
        obj.addEventListener(type, func);
    };

    /* track pressed keys */

    abungo.state.pressedKeys = [];
    window.addEventListener("keydown", function(e){
        if (abungo.state.pressedKeys.indexOf(e.keyCode) === -1) {
            abungo.state.pressedKeys.push(e.keyCode);
        }
    });
    window.addEventListener("keyup", function(e){
        if (abungo.state.pressedKeys.indexOf(e.keyCode) !== -1) {
            var index = abungo.state.pressedKeys.indexOf(e.keyCode);
            abungo.state.pressedKeys.splice(index, 1);
        }
    });

    /* convenience functions */

    var scrollToBottom = function() {
        messagesElem.scrollTop = messagesElem.offsetHeight + messagesElem.scrollHeight;
    };

    var makeMessageElem = function(data, type, scroll) {
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
            bodyContent = parseMDL(Autolinker.link(HTMLify(cleanseHTML(data.message))));
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
        if (scroll) {
            scrollToBottom();
        }
    };

    var makeJoinElem = function(data, action, scroll) {
        var elem = document.createElement("div");
        elem.innerHTML = "<p><strong>" + cleanseHTML(data.nick) + "</strong> " + action + ".</p>";
        elem.classList.add("message");
        elem.classList.add("message-join");
        messagesElem.appendChild(elem);
        if (scroll) {
            scrollToBottom();
        }
    };

    var updateUsersList = function() {
        $(".userlist_list").innerHTML = "";
        abungo.state.users.sort(function(a, b) {
            var aLower = a.toLowerCase();
            var bLower = b.toLowerCase();

            if (aLower < bLower || a === abungo.state.nick) return -1;
            if (aLower > bLower || b === abungo.state.nick) return 1;
            return 0;
        }).forEach(function(nick) {
            var elem = document.createElement("li");
            elem.classList.add("user");
            elem.textContent = nick;
            if (nick === abungo.state.nick) {
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
        if (!document.hasFocus() || !isAtBottom()) {
            if (window.Notification && Notification.permission !== "denied") {
                Notification.requestPermission(function(status) {
                    if (status === "granted") {
                        if (!abungo.state.hasOwnProperty("notifications")) {
                            abungo.state.notifications = [];
                        }

                        var n = new Notification(nick + " on #" + abungo.state.room, {
                            body: text,
                            icon: "/img/logo/icon196.png"
                        });
                        abungo.state.notifications.push(n);

                        window.addEventListener("focus", function() {
                            if (n) {
                                n.close();
                                abungo.state.notifications.remove(n);
                            }
                        });
                        n.addEventListener("click", function() {
                            window.focus();
                            scrollToBottom();
                            abungo.state.notifications.remove(n);
                        });
                    }
                });
            }
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

    var imageShrinkedDimensions = function(a, b, m) {
        if (a * b > m) {
            var k = a/b; // a = bk , b = a/k
            var A, B;
            // let ab = m
            // b^2 * k = m
            // b^2 = m/k
            B = Math.sqrt(m/k);
            // a = bk
            A = B * k;
            return [A, B];
        } else {
            return [a, b];
        }
    };

    var isMobile = function() {
        if (window.hasOwnProperty("isMobileCached")) {
            return window.isMobileCached;
        } else {
            var ismob = (navigator.userAgent.indexOf("Mobile") !== -1);
            window.isMobileCached = ismob;
            return ismob;
        }
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

    /* navigator.getUserMedia prefix support */

    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

    /* socket.io shenanigans */

    var socket = io();

    socket.on("connected", function(data) {
        abungo.state.connected = true;
        abungo.state.connectedDate = new Date(data.date);
    });

    /* login */

    var loginForm = $("#login")
    var loginNickInput = $("#login_nick");
    var loginRoomInput = $("#login_room");
    var loginButton = $("#login_button");

    loginNickInput.value = localStorage.getItem("abungo_nick") || "";
    loginRoomInput.value = localStorage.getItem("abungo_room") || "";

    loginForm.addEventListener("submit", function(e){
        e.preventDefault();
        if (this.checkValidity() && !this.classList.contains("notouch")) {
            socket.emit("login", {
                nick: loginNickInput.value,
                room: loginRoomInput.value,
                userID: abungo.state.userID
            });

            localStorage.setItem("abungo_nick", loginNickInput.value);
            localStorage.setItem("abungo_room", loginRoomInput.value);
        }
    });

    loginNickInput.focus();

    /* try resume connection */

    var tryReconnect = function() {
        if (abungo.state && abungo.state.userID && abungo.state.nick && abungo.state.room) {
            socket.emit("login_resume", {
                nick: abungo.state.nick,
                userID: abungo.state.userID,
                room: abungo.state.room
            });
            console.log("sending login_resume");

            socket.on("login_resume_rejected", function() {
                console.log("login_resume_rejected");
                socket.emit("login", {
                    nick: abungo.state.nick,
                    room: abungo.state.room,
                    userID: abungo.state.userID,
                    rejoin: true
                });
                console.log("sending login { rejoin: true }");
                socket.on("login_rejoin_accepted", function(data) {
                    console.log("login_rejoin_accepted");
                    abungo.state.userID = data.userID;

                    // update users list without removing Object.observe listener
                    abungo.state.users.length = 0;
                    data.users.forEach(function(nick) {
                        abungo.state.users.push(nick);
                    });

                    updateConnectionStatusIndicator(0);
                });
            });
        }
    };

    socket.on("connected", tryReconnect);

    /* ping the server to determine connectivity */

    (function(){
        var ping = function() {
            socket.emit("ping");
        };
        socket.on("pong", function(data) {
            abungo.state.lastPongDate = new Date();
        });
        setInterval(function() {
            ping();
            abungo.state.lastPingDate = new Date();
        }, 5000);
    })();

    /* forming in a straight line */

    var messagesElem;

    socket.on("login_accepted", function(data) {
        abungo.state.userID = data.userID;
        abungo.state.nick = data.nick;
        abungo.state.room = data.room;
        abungo.state.users = data.users;

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
        if (!isMobile()) {
            sendbarComposeInput.focus();
        }
        if (isMobile()) {
            document.body.classList.add("sidebarhidden");
        }

        document.title = abungo.state.room + " - " + document.title;

        if (localStorage.getItem("abungo_sidebar_hidden") === "true") {
            document.body.classList.add("sidebarhidden");
        }

        /* send messages */

        sendbarComposeInput.addEventListener("keydown", function(e){
            if (e.keyCode === 13 && !e.shiftKey) {
                e.preventDefault();
                if (this.textContent.length > 0) {
                    abungo.messages.send({
                        message: this.innerHTML
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
            var type;

            if (data.nick === abungo.state.nick) {
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
                    abungo.messages.send({
                        file: file
                    });
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
                    abungo.messages.send({
                        file: file
                    });
                } else if (file) {
                    alert("'" + file.name + "' is too big. You can only upload files less than 10 megabytes in size.");
                }
            })
        }, false);

        /* send stickers */

        $(".popup_popup-stickers").addEventListener("mousedown", function(e) {
            if (e.target.classList.contains("popup_popup-stickers_sticker")) {
                var mousedownDate = new Date();

                e.target.onmouseup = e.target.ontouchend = function() {
                    var mouseupDate = new Date();
                    var delta = mouseupDate - mousedownDate;

                    var sizesCount = 3;
                    var maxTime = 2000;

                    var size = Math.round((sizesCount - 1) * delta/maxTime);

                    if (size <= 2) {
                        abungo.messages.send({
                            sticker: {
                                name: e.target.getAttribute("title"),
                                size: size
                            }
                        });
                    }
                };
            }
        });

        /* photo booth */

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

                var dims = imageShrinkedDimensions(videoElem.offsetWidth, videoElem.offsetHeight, 1000 * 1000); // array [w, h]

                canvas.width = dims[0];
                canvas.height = dims[1];
                ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);

                var dataURI = canvas.toDataURL();
                var blob = dataURItoBlob(dataURI);
                var now = new Date();

                abungo.messages.send({
                    mediaUpload: blob,
                    mediaType: "image/png",
                    mediaName: "Abungo snap.png"
                });
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
            var volumeCircleElem = volumeElem.querySelector("circle");

            var volumeInterval;
            var VOLUME_CIRCLE_ORIG_RADIUS = 12;

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
                        var bufferSize = 1024;
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
                                var scale = audioVolume / 4000;
                                volumeCircleElem.setAttribute("r", VOLUME_CIRCLE_ORIG_RADIUS * scale);
                            }
                        }, 100);

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

                    abungo.messages.send({
                        mediaUpload: blob,
                        mediaType: "audio/wav",
                        mediaName: "Abungo audio.wav"
                    });

                    that.classList.remove("recording");
                }
            });
        })();

        /* user join/leave */

        socket.on("user_joined", function(data) {
            if (abungo.state.users.indexOf(data.nick) === -1) {
                abungo.state.users.push(data.nick);
            }
            makeJoinElem(data, "joined", isAtBottom());
        });

        socket.on("user_left", function(data) {
            abungo.state.users.remove(data.nick);
            makeJoinElem(data, "left", isAtBottom());
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

        Object.observe(abungo.state.users, function() {
            console.log("users list changed", abungo.state.users);
            updateUsersList();
        });
        updateUsersList();

        /* listen for unread count changes */

        if (!abungo.state.hasOwnProperty("notifications")) {
            abungo.state.notifications = [];
        }

        Object.observe(abungo.state.notifications, function() {
            var unreadCount = abungo.state.notifications.length;
            if (unreadCount > 0) {
                document.title = "[" + unreadCount + "] " + abungo.state.room + " - Abungo";
            } else {
                document.title = abungo.state.room + " - Abungo";
            }
        });

        /* scroll to bottom on resize if previously at bottom */

        throttle("resize", "sResize"); // s for sane
        throttle("scroll", "sScroll", messagesElem);
        abungo.state.wasAtBottom = true;
        messagesElem.addEventListener("sScroll", function() {
            if (isAtBottom()) {
                abungo.state.wasAtBottom = true;
            } else {
                abungo.state.wasAtBottom = false;
            }
        });
        window.addEventListener("sResize", function() {
            if (abungo.state.wasAtBottom) {
                scrollToBottom();
            }
            abungo.state.wasAtBottom = isAtBottom();
        });

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
            var className = "sidebarhidden";

            if (document.body.classList.contains(className)) {
                document.body.classList.remove(className);
                localStorage.setItem("abungo_sidebar_hidden", "false");
            } else {
                document.body.classList.add(className);
                localStorage.setItem("abungo_sidebar_hidden", "true");
            }
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
            if (!socket.connected || socket.disconnected || (abungo.state.lastPingDate - abungo.state.lastPongDate > 15000)) {
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

    /* add mobile class to body if on mobile device (not just small screen) */
    if (isMobile()) {
        document.body.classList.add("mobile");
    }

    /* add no-gum class to body if navigator.getUserMedia not supported (prefixed or otherwise) */
    if (!navigator.getUserMedia) {
        document.body.classList.add("no-gum");
    }
}());
