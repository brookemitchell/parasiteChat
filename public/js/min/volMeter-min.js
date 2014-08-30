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
    if (stairNumber) {
        $("#meter" + stairNumber).attr("value", inputVol);
        socket.emit("inputVol", [ stairNumber, inputVol ]);
    }
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