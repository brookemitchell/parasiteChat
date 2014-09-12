$(function() {
    var FADE_TIME = 150;
    var TYPING_TIMER_LENGTH = 400;
    var COLORS = [ "#e21400", "#91580f", "#f8a700", "#f78b00", "#58dc00", "#287b00", "#a8f07a", "#4ae8c4", "#3b88eb", "#3824aa", "#a700ff", "#d300e7" ];
    var session = OT.initSession(apiKey, sessionId);
    OT.setLogLevel(4);
    var messagesRef = new Firebase("https://parasite.firebaseio.com/");
    messagesRef.limit(10).once("value", function(snapshot) {
        snapshot.forEach(function(children) {
            addChatMessage(children.val(), {
                fade: false
            });
        });
    });
    var tokStyle = {
        buttonDisplayMode: "off",
        showSettingsButton: false,
        showMicButton: false
    };
    var TokSettings = function(name, resolution, audio) {
        this.insertMode = "append";
        this.frameRate = 15;
        this.width = 229;
        this.height = 136;
        this.name = name;
        this.resolution = resolution;
        this.style = tokStyle;
    };
    var $window = $(window);
    var $userNameInput = $(".userNameInput");
    var $messages = $(".messages");
    var $inputMessage = $(".inputMessage");
    var $loginPage = $(".login.page");
    var $chatPage = $(".chat.page");
    var socket = io();
    var userName;
    var userNameList;
    var numUsers;
    var stairNumber;
    var connected = false;
    var typing = false;
    var lastTypingTime;
    var $currentInput = $userNameInput.focus();
    var audioContext = null;
    var analyser = null;
    var meter = null;
    var inputVol = null;
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContext();
    var getMic = function() {
        try {
            navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
            navigator.getUserMedia({
                audio: true,
                video: true
            }, gotStream, didntGetStream);
        } catch (e) {
            alert("getUserMedia threw exception :" + e);
        }
    };
    var volumeAudioProcess = function() {
        var array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        inputVol = getAverageVolume(array);
        if (stairNumber) {
            $("#meter" + stairNumber).attr("value", inputVol);
        }
    };
    function didntGetStream() {
        alert("Stream generation failed.");
    }
    function gotStream(stream) {
        var mediaStreamSource = audioContext.createMediaStreamSource(stream);
        meter = createAudioMeter(audioContext);
        mediaStreamSource.connect(meter);
    }
    function createAudioMeter(audioContext) {
        var javascriptNode = audioContext.createScriptProcessor(4096);
        javascriptNode.connect(audioContext.destination);
        javascriptNode.onaudioprocess = volumeAudioProcess;
        analyser = audioContext.createAnalyser();
        analyser.smoothingTimeConstant = .3;
        analyser.fftSize = 2048;
        analyser.connect(javascriptNode);
        return analyser;
    }
    function getAverageVolume(array) {
        var values = 0;
        var average;
        var length = array.length;
        for (var i = 0; i < length; i++) {
            values += array[i];
        }
        average = Math.round(values / length);
        return average;
    }
    function addParticipantsMessage(data) {
        var message = "";
        if (data.numUsers === 1) {
            message += "There is currently 1 user";
        } else {
            message += "There are currently " + data.numUsers + " users";
        }
        log(message);
    }
    function setUserName() {
        userName = cleanInput($userNameInput.val().trim());
        if (userName) {
            $loginPage.fadeOut();
            $chatPage.show();
            $loginPage.off("click");
            $currentInput = $inputMessage.focus();
            socket.emit("add user", userName);
        }
    }
    function sendMessage() {
        var message = $inputMessage.val();
        message = cleanInput(message);
        if (message && connected) {
            $inputMessage.val("");
            addChatMessage({
                userName: userName,
                message: message
            });
            socket.emit("new message", message);
        }
    }
    function log(message, options) {
        var $el = $("<li>").addClass("log").text(message);
        addMessageElement($el, options);
    }
    function addChatMessage(data, options) {
        var $typingMessages = getTypingMessages(data);
        options = options || {};
        if ($typingMessages.length !== 0) {
            options.fade = false;
            $typingMessages.remove();
        }
        var $userNameDiv = $('<span class="userName"/>').text(data.userName).css("color", getUserNameColor(data.userName));
        var $messageBodyDiv = $('<span class="messageBody">').text(data.message);
        var typingClass = data.typing ? "typing" : "";
        var $messageDiv = $('<li class="message"/>').data("userName", data.userName).addClass(typingClass).append($userNameDiv, $messageBodyDiv);
        addMessageElement($messageDiv, options);
    }
    function addChatTyping(data) {
        data.typing = true;
        data.message = "is typing";
        addChatMessage(data);
    }
    function removeChatTyping(data) {
        getTypingMessages(data).fadeOut(function() {
            $(this).remove();
        });
    }
    function addMessageElement(el, options) {
        var $el = $(el);
        if (!options) {
            options = {};
        }
        if (typeof options.fade === "undefined") {
            options.fade = true;
        }
        if (typeof options.prepend === "undefined") {
            options.prepend = false;
        }
        if (options.fade) {
            $el.hide().fadeIn(FADE_TIME);
        }
        if (options.prepend) {
            $messages.prepend($el);
        } else {
            $messages.append($el);
        }
        $messages[0].scrollTop = $messages[0].scrollHeight;
    }
    function cleanInput(input) {
        return $("<div/>").text(input).text();
    }
    function updateTyping() {
        if (connected) {
            if (!typing) {
                typing = true;
                socket.emit("typing");
            }
            lastTypingTime = new Date().getTime();
            setTimeout(function() {
                var typingTimer = new Date().getTime();
                var timeDiff = typingTimer - lastTypingTime;
                if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
                    socket.emit("stop typing");
                    typing = false;
                }
            }, TYPING_TIMER_LENGTH);
        }
    }
    function getTypingMessages(data) {
        return $(".typing.message").filter(function(i) {
            return $(this).data("userName") === data.userName;
        });
    }
    function getUserNameColor(userName) {
        var hash = 7;
        for (var i = 0; i < userName.length; i++) {
            hash = userName.charCodeAt(i) + (hash << 5) - hash;
        }
        var index = Math.abs(hash % COLORS.length);
        return COLORS[index];
    }
    $window.keydown(function(event) {
        if (!(event.ctrlKey || event.metaKey || event.altKey)) {
            $currentInput.focus();
        }
        if (event.which === 13) {
            if (userName) {
                sendMessage();
                socket.emit("stop typing");
                typing = false;
            } else {
                setUserName();
            }
        }
    });
    $inputMessage.on("input", function() {
        updateTyping();
    });
    $loginPage.click(function() {
        $currentInput.focus();
    });
    $inputMessage.click(function() {
        $inputMessage.focus();
    });
    $(".vidBox").hover(function() {
        $(this).css("background", "#53BF5C");
        socket.emit("hoverOn", this.id.charAt(4));
    }, function() {
        $(this).css("background", "snow");
        socket.emit("hoverOff", this.id.charAt(4));
    });
    socket.on("login", function(data) {
        connected = true;
        var message = "Welcome to Parasite Chat " + data.userName + ".";
        log(message, {
            prepend: true
        });
        addParticipantsMessage(data);
        userNameList = data.userNameList;
        console.log(userName);
        console.log(userNameList);
        stairNumber = userNameList.indexOf(userName);
        console.log(stairNumber);
        session.connect(token, function(error) {
            getMic();
            var settings = new TokSettings(userName, "320x240");
            var publisher = OT.initPublisher("user" + stairNumber, settings);
            session.publish(publisher);
        });
    });
    socket.on("new message", function(data) {
        addChatMessage(data);
    });
    socket.on("user joined", function(data) {
        log(data.userName + " joined");
        addParticipantsMessage(data);
        userNameList = data.userNameList;
        console.log(userNameList);
        $(".usersNum").hide().fadeIn(FADE_TIME * 2).html(data.numUsers);
    });
    socket.on("user left", function(data) {
        log(data.userName + " left");
        addParticipantsMessage(data);
        removeChatTyping(data);
        $(".usersNum").hide().fadeIn(FADE_TIME * 2).html(data.numUsers);
    });
    socket.on("typing", function(data) {
        addChatTyping(data);
    });
    socket.on("stop typing", function(data) {
        removeChatTyping(data);
    });
    socket.on("user hovOn", function(data) {
        $("#user" + data).css("background", "red");
    });
    socket.on("user hovOff", function(data) {
        $("#user" + data).css("background", "15C4C4D5");
    });
    socket.on("userVol", function(array) {
        $("#meter" + array[0]).attr("value", array[1]);
    });
    socket.on("servInputVol", function(vol) {
        $("#meter-1").attr("vadafue", vol);
    });
    session.on("streamCreated", function(event) {
        var joinerName = event.stream.name;
        var setttings;
        console.log(joinerName + " joined");
        var idToReplace = userNameList.indexOf(joinerName);
        console.log("user:" + idToReplace + " will be added");
        if (joinerName == "Host") {
            settings = new TokSettings(joinerName, "640x480", true);
            session.subscribe(event.stream, "serverVidBox", settings);
            console.log("adding to server box");
        } else {
            settings = new TokSettings(joinerName, "320x240", false);
            console.log(settings);
            session.subscribe(event.stream, "user" + idToReplace, settings);
            console.log("adding to user box");
        }
    });
});