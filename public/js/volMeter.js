  //Audio API Stuff
  var audioContext = null;
  var analyser = null;
  var meter = null;
  var inputVol = null;
  // monkeypatch Web Audio
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  // grab an audio context
  audioContext = new AudioContext();

  // Attempt to get audio input
  try {
    // monkeypatch getUserMedia
          navigator.getUserMedia =
          navigator.getUserMedia ||
          navigator.webkitGetUserMedia ||
          navigator.mozGetUserMedia;
  // ask for an audio input
  navigator.getUserMedia({audio:true, video:true}, gotStream, didntGetStream);
  } catch (e) {
  alert('getUserMedia threw exception :' + e);
   }

  function didntGetStream() {
    alert('Stream generation failed.');
  }

  function gotStream (stream) {
  //console.log('got audio stream');
    var mediaStreamSource = audioContext.createMediaStreamSource(stream);
    meter = createAudioMeter(audioContext);
    mediaStreamSource.connect(meter);
    //console.log(meter);
  }

  function createAudioMeter (audioContext) {
    // setup a javascript node
    var javascriptNode = audioContext.createScriptProcessor(4096);
    // this will have no effect, since we don't copy the input to the output,
    // but works around a current Chrome bug.
    javascriptNode.connect(audioContext.destination);
    //patch to our metering function
    javascriptNode.onaudioprocess = volumeAudioProcess;
    //setup an analyser
    analyser = audioContext.createAnalyser();
    analyser.smoothingTimeConstant = 0.3;
    analyser.fftSize = 2048;
    //send anal to java node
    analyser.connect(javascriptNode);
    return analyser;
  }

  var volumeAudioProcess = function() {
    var array =  new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(array);
    inputVol = getAverageVolume(array);
    //console.log(this.volume);


    if (stairNumber){
    $('#meter' + stairNumber).attr('value', inputVol);
    socket.emit('inputVol', [stairNumber, inputVol]);
      }
    };

  function getAverageVolume(array) {
    var values = 0;
    var average;
    var length = array.length;
    //get all the frequency amplitudes
    for (var i = 0; i < length; i++) {
        values += array[i];
    }
    average = Math.round(values / length);
    return average;
  }
