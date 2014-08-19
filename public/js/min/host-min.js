$(function() {
    var FADE_TIME = 150;
    var TYPING_TIMER_LENGTH = 400;
    var COLORS = [ "#e21400", "#91580f", "#f8a700", "#f78b00", "#58dc00", "#287b00", "#a8f07a", "#4ae8c4", "#3b88eb", "#3824aa", "#a700ff", "#d300e7" ];
    var session = OT.initSession(apiKey, sessionId);
    OT.setLogLevel(2);
    var $window = $(window);
    var userName = "Host";
    var userNameList = "<%= userNameList %>";
    var TokSettings = function(name) {
        this.insertMode = "append";
        this.width = 200;
        this.height = 150;
        this.subscribeToAudio = true;
        this.subscribeToVideo = true;
        this.name = name;
    };
    var socket = io();
    session.on("streamCreated", function(event) {
        var joinerName = event.stream.name;
        var settings = new TokSettings(joinerName);
        console.log(joinerName + " joined");
        var idToReplace = userNameList.indexOf(joinerName);
        console.log(idToReplace + " will be added");
        session.subscribe(event.stream, "user" + idToReplace, settings);
    });
    session.connect(token, function(error) {
        var settings = new TokSettings(userName);
        var publisher = OT.initPublisher("serverVid", settings);
        session.publish(publisher);
    });
    socket.on("user joined", function(data) {
        console.log(data.userName + " joined");
        userNameList = data.userNameList;
    });
});