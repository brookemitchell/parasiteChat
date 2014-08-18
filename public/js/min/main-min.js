$(function() {
    var FADE_TIME = 150;
    var TYPING_TIMER_LENGTH = 400;
    var COLORS = [ "#e21400", "#91580f", "#f8a700", "#f78b00", "#58dc00", "#287b00", "#a8f07a", "#4ae8c4", "#3b88eb", "#3824aa", "#a700ff", "#d300e7" ];
    var session = OT.initSession(apiKey, sessionId);
    OT.setLogLevel(2);
    var messagesRef = new Firebase("https://parasite.firebaseio.com/");
    messagesRef.limit(10).once("value", function(snapshot) {
        snapshot.forEach(function(children) {
            addChatMessage(children.val(), {
                fade: false
            });
        });
    });
    var $window = $(window);
    var $userNameInput = $(".userNameInput");
    var $messages = $(".messages");
    var $inputMessage = $(".inputMessage");
    var $loginPage = $(".login.page");
    var $chatPage = $(".chat.page");
    var userName;
    var userNameList;
    var numUsers;
    var stairNumber;
    var connected = false;
    var typing = false;
    var lastTypingTime;
    var $currentInput = $userNameInput.focus();
    var defaultSettings = {
        insertMode: "append",
        width: 200,
        height: 150,
        subscribeToAudio: true,
        subscribeToVideo: true
    };
    var publishSettings = defaultSettings;
    var subscribeSettings = defaultSettings;
    var socket = io();
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
        publishSettings.name = stairNumber + ": " + userName;
        session.connect(token, function(error) {
            var publisher = OT.initPublisher("user" + stairNumber), publishSettings;
            session.publish(publisher);
        });
    });
    socket.on("new message", function(data) {
        addChatMessage(data);
    });
    socket.on("user joined", function(data) {
        log(data.userName + " joined");
        addParticipantsMessage(data);
        console.log(data.userNameList);
        $(".usersNum").hide().fadeIn(FADE_TIME * 2).html(data.numUsers);
    });
    socket.on("user left", function(data) {
        log(data.userName + " left");
        addParticipantsMessage(data);
        removeChatTyping(data);
    });
    socket.on("typing", function(data) {
        addChatTyping(data);
    });
    socket.on("stop typing", function(data) {
        removeChatTyping(data);
    });
});