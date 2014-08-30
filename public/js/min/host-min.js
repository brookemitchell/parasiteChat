$(function() {
    var FADE_TIME = 150;
    var TYPING_TIMER_LENGTH = 400;
    var COLORS = [ "#e21400", "#91580f", "#f8a700", "#f78b00", "#58dc00", "#287b00", "#a8f07a", "#4ae8c4", "#3b88eb", "#3824aa", "#a700ff", "#d300e7" ];
    var session = OT.initSession(apiKey, sessionId);
    OT.setLogLevel(2);
    var $window = $(window);
    var userName = "Host";
    var userNameList = "<%= userNameList %>";
    var TokSettings = function(name, subAud) {
        this.insertMode = "append";
        this.width = 200;
        this.height = 150;
        this.subscribeToAudio = subAud;
        this.subscribeToVideo = false;
        this.name = name;
    };
    var socket = io();
    var audioContext = null;
    var analyser = null;
    var meter = null;
    var inputVol = null;
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContext();
    try {
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        navigator.getUserMedia({
            audio: true,
            video: true
        }, gotStream, didntGetStream);
    } catch (e) {
        alert("getUserMedia threw exception :" + e);
    }
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
    var volumeAudioProcess = function() {
        var array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        inputVol = getAverageVolume(array);
        $("#meter-1").attr("value", inputVol);
    };
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
    var gainNodes = new Array(9);
    var sourceNodes = new Array(9);
    setupAudioNodes();
    loadSounds("sounds/sound0.wav", 0);
    function setupAudioNodes() {
        for (var i = 0; i < 9; i++) {
            sourceNodes[i] = audioContext.createBufferSource();
            gainNodes[i] = audioContext.createGain();
            sourceNodes[i].connect(gainNodes[i]);
            gainNodes[i].connect(audioContext.destination);
            sourceNodes[i].loop = true;
            gainNodes[i].gain.value = 0;
        }
    }
    function loadSounds(url, index) {
        var request = new XMLHttpRequest();
        request.open("GET", url, true);
        request.responseType = "arraybuffer";
        request.onload = function() {
            audioContext.decodeAudioData(request.response, function(buffer) {
                playSound(buffer);
            }, onError);
        };
        request.send();
        function playSound(buffer) {
            sourceNodes[index].buffer = buffer;
            sourceNodes[index].start(0);
        }
        function onError(error) {
            console.log(error);
        }
    }
    var volState = [ 0, 0, 0, 0, 0, 0, 0, 0, 0 ];
    var sub = new Array(9);
    session.on("streamCreated", function(event) {
        var joinerName = event.stream.name;
        var settings = new TokSettings(joinerName, false);
        var arrNum = userNameList.indexOf(joinerName);
        var idToReplace = "user" + arrNum;
        sub[arrNum] = session.subscribe(event.stream, idToReplace, settings);
    });
    session.connect(token, function(error) {
        var settings = new TokSettings(userName, true, 100);
        var publisher = OT.initPublisher("serverVid", settings);
        session.publish(publisher);
    });
    socket.on("user joined", function(data) {
        userNameList = data.userNameList;
    });
    socket.on("user left", function(data) {
        userNameList = data.userNameList;
    });
    socket.on("user hovOn", function(data) {
        data = Number(data);
        $("#user" + data).css("background", "red");
        if (userNameList[data] === null) {
            gainNodes[data].gain.value = 1;
        } else {
            sub[data].subscribeToAudio(true);
            sub[data].setAudioVolume(100);
        }
    });
    socket.on("user hovOff", function(data) {
        data = Number(data);
        $("#user" + data).css("background", "lightgrey");
        if (userNameList[data] === null) {
            gainNodes[data].gain.value = 0;
        } else {
            sub[data].setAudioVolume(0);
        }
    });
});