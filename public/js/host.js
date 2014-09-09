$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  var session = OT.initSession(apiKey, sessionId);
  OT.setLogLevel(2);
  // Initialize varibles
  var $window = $(window);

  // Prompt for setting a username
  var userName = 'Host';
  // var userNameList = Array(userNameList);
  console.log(userNameList);

// TokBox Settings constructor
  var TokSettings = function ( name , subAud) {
      // this.audioVolume = volume;
      this.insertMode = "append";
      this.width = 200;
      this.height = 150;
      this.subscribeToAudio = subAud;
      // this.subscribeToAudio = true;
      this.subscribeToVideo = false;
      this.name  = name;
    };

  var socket = io();
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
    var mediaStreamSource = audioContext.createMediaStreamSource(stream);
    meter = createAudioMeter(audioContext);
    mediaStreamSource.connect(meter);
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
    $('#meter-1').attr('value', inputVol);
    // socket.emit('servInputVol', inputVol);
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

  //play sudio files when no one is connected
  var gainNodes = new Array(8);
  var sourceNodes = new Array(8);

  //setup the sounds
  setupAudioNodes();
  loadSounds('sounds/sound0.wav', 0);
  loadSounds('sounds/sound1.wav', 1);
  loadSounds('sounds/sound2.wav', 2);
  loadSounds('sounds/sound3.wav', 3);
  loadSounds('sounds/sound4.wav', 4);
  loadSounds('sounds/sound5.wav', 5);
  loadSounds('sounds/sound6.wav', 6);
  loadSounds('sounds/sound7.wav', 7);

  function setupAudioNodes () {

    for (var i = 0 ; i < 9; i++){
      //create buff sources & gain nodes
      sourceNodes[i] = audioContext.createBufferSource();
      gainNodes[i] = audioContext.createGain();
      // connnect to gainNode
      sourceNodes[i].connect(gainNodes[i]);
      gainNodes[i].connect(audioContext.destination);
      //settings
      sourceNodes[i].loop = true;
      gainNodes[i].gain.value = 0;
    }
  }

  //load sounds
  function loadSounds( url, index){
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
    request.onload = function () {
    //when loadeed decode deeta
    audioContext.decodeAudioData(request.response, function (buffer) {
        playSound(buffer);
      } , onError);
    };
    request.send();

    function playSound ( buffer ) {
      //when audio is decoded play da sound
       sourceNodes[index].buffer = buffer;
       sourceNodes[index].start(0);
       // gainNodes[index].gain.value = 0;
    }

    function onError (error ) {
      console.log(error);
    }
  }

  var volState = [0, 0, 0, 0, 0, 0, 0, 0];
  var sub = new Array(8);
  var archiveID = null;

  session.on("streamCreated", function(event) {
    var joinerName = event.stream.name;
    var settings = new TokSettings(joinerName, false);
    var arrNum = userNameList.indexOf(joinerName);
    var idToReplace = 'user' + arrNum;
    sub[arrNum] = session.subscribe(event.stream, idToReplace, settings );
    // sub[arrNum].setAudioVolume(0);
   });

  session.connect(token, function(error) {
     var settings = new TokSettings (userName, true, 100);
     var publisher = OT.initPublisher('serverVid', settings);
     session.publish(publisher);
  });
  session.on('archiveStarted', function(event) {
    archiveID = event.id;
    console.log("ARCHIVE STARTED");
  });

  session.on('archiveStopped', function(event) {
    archiveID = null;
    console.log("ARCHIVE STOPPED");
  });

  //Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    userNameList = data.userNameList;

  });
  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    // $('#meter' + userNameList.indexOf(data.userName)).attr('value', 0);
    userNameList = data.userNameList;
  });

  socket.on('user hovOn', function (hoverNum) {
    hoverNum = Number(hoverNum);
        // console.log('operating on ' + hoverNum);
        $( '#user' + hoverNum ).css( 'background', 'red');
        // console.log(userNameList[hoverNum]);
        if (userNameList[hoverNum] === null || undefined  || ',') {
            gainNodes[hoverNum].gain.value = 1;
        }
          else{
            try{
              sub[hoverNum].subscribeToAudio(true);
              sub[hoverNum].setAudioVolume(100);
            }
            catch (e) {console.log(e);}
        }

  });
  socket.on('user hovOff', function (hoverNum) {
    $('#user' + hoverNum).css('background', 'lightgrey');
      gainNodes[hoverNum].gain.value = 0;
      if (userNameList[hoverNum] !== null) {
        try{
          sub[hoverNum].subscribeToAudio(false);
          sub[hoverNum].setAudioVolume(0);
        }catch (e) {}
    }
  });
});

