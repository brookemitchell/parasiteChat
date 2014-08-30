$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  var session = OT.initSession(apiKey, sessionId);
  OT.setLogLevel(4);

  var messagesRef = new Firebase('https://parasite.firebaseio.com/');
    messagesRef.limit(10).once('value', function (snapshot) {
      snapshot.forEach(function (children){
        addChatMessage(children.val(), {fade: false});
      });
    });

    var tokStyle = {
        buttonDisplayMode: 'off',
        showSettingsButton: false,
        showMicButton: false
      };


// TokBox Settings constructor
  var TokSettings = function ( name , resolution, audio ) {
      this.insertMode = "append";
      this.frameRate = 15;
      this.width = 229;
      this.height = 136;
      this.name  = name;
      //Valid values are "1280x720", "640x480", and "320x240".
      this.resolution = resolution;
      //style
      this.style =  tokStyle;
  };

  // Initialize varibles
  var $window = $(window);
  var $userNameInput = $('.userNameInput'); // Input for username
  var $messages = $('.messages'); // Messages area
  var $inputMessage = $('.inputMessage'); // Input message input box
  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page
  var socket = io();

  // Prompt for setting a username
  var userName;
  var userNameList;
  var numUsers;
  var stairNumber;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $userNameInput.focus();

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
  var getMic = function () {
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
  };

  var volumeAudioProcess = function() {
    var array =  new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(array);
    inputVol = getAverageVolume(array);
    //console.log(this.volume);

    if (stairNumber){
      $('#meter' + stairNumber).attr('value', inputVol);
      // setInterval(function(){
        // socket.emit('inputVol', [stairNumber, inputVol]);
      // }, 100);
    }
  };

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

  function addParticipantsMessage (data) {
    var message = '';
    if (data.numUsers === 1) {
      message += "There is currently 1 user";
    } else {
      message += "There are currently " + data.numUsers + " users";
    }
    log(message);
  }

  // Sets the client's username
  function setUserName () {
    userName = cleanInput($userNameInput.val().trim());

    // If the username is valid
    if (userName) {

      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      // Tell the server your username
      socket.emit('add user', userName);
        }
    }

  // Sends a chat message
  function sendMessage () {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({
        userName: userName,
        message: message
      });
      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', message);
    }
  }

  // Log a message
  function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  function addChatMessage (data, options) {

    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $userNameDiv = $('<span class="userName"/>')
      .text(data.userName)
      .css('color', getUserNameColor(data.userName));
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('userName', data.userName)
      .addClass(typingClass)
      .append($userNameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  // Adds the visual chat typing message
  function addChatTyping (data) {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  function removeChatTyping (data) {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement (el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
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

  // Prevents input from having injected markup
  function cleanInput (input) {
    return $('<div/>').text(input).text();
  }

  // Updates the typing event
  function updateTyping () {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  function getTypingMessages (data) {
    return $('.typing.message').filter(function (i) {
      return $(this).data('userName') === data.userName;
    });
  }

  // Gets the color of a username through our hash function
  function getUserNameColor (userName) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < userName.length; i++) {
       hash = userName.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  // Keyboard events

  $window.keydown(function (event) {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (userName) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUserName();
      }
    }
  });

  $inputMessage.on('input', function() {
    updateTyping();
  });

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(function () {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(function () {
    $inputMessage.focus();
  });

  //Hover Events
   //Emit an event to the server whenever a client hovers over a user video box.
   $('.vidBox').hover( function(){
     $( this ).css( 'background', 'red');
     socket.emit('hoverOn', this.id.charAt(4));
   },
    function( ){
     $( this ).css( 'background', 'lightgrey');
     socket.emit('hoverOff', this.id.charAt(4));
    });

  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', function (data) {
    connected = true;
    // Display the welcome message
    var message = "Welcome to Parasite Chat " + data.userName + ".";
    log(message, {
      prepend: true
    });

    //Add number of users to log. BM: remove this?
    addParticipantsMessage(data);
    userNameList = data.userNameList;
    console.log(userName);
    console.log(userNameList);
    stairNumber = (userNameList).indexOf(userName);
    console.log(stairNumber);

    // connect TokBox
    session.connect(token, function(error) {
      getMic();
      var settings = new TokSettings (userName, "320x240");
      var publisher = OT.initPublisher('user' + stairNumber, settings);
      session.publish(publisher);

    });
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function (data) {
   addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    log(data.userName + ' joined');
    addParticipantsMessage(data);
    userNameList = data.userNameList;
    console.log(userNameList);

    //B: login page update
    $('.usersNum').hide().fadeIn(FADE_TIME * 2).html(data.numUsers);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    log(data.userName + ' left');
    addParticipantsMessage(data);
    removeChatTyping(data);
    $('.usersNum').hide().fadeIn(FADE_TIME * 2).html(data.numUsers);
    // $('#meter' + userNameList.indexOf(data.userName)).attr('value', 0);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function (data) {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', function (data) {
    removeChatTyping(data);
  });

  socket.on('user hovOn', function (data) {
    $( '#user' + data ).css( 'background', 'red');
  });
  socket.on('user hovOff', function (data) {
     $( '#user' + data ).css( 'background', 'lightgrey');
  });
  socket.on('userVol', function(array){
    $('#meter' + array[0]).attr('value', array[1]);
  });
  socket.on('servInputVol', function(vol){
    $('#meter-1').attr('vadafue', vol);
  });

  session.on('streamCreated', function(event) {
    var joinerName = event.stream.name;
    var setttings;
    console.log(joinerName + ' joined');
    var idToReplace = userNameList.indexOf(joinerName);
    console.log('user:' + idToReplace + ' will be added');

    if (joinerName == 'Host'){
      settings = new TokSettings(joinerName, "640x480", true);
      session.subscribe(event.stream, 'serverVidBox', settings);
      console.log('adding to server box');
    }
    else{
      settings = new TokSettings(joinerName, "320x240", false);
      console.log(settings);
      session.subscribe(event.stream, 'user' + idToReplace, settings);
      console.log('adding to user box');
    }
   });
});
