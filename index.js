// Setup basic express server
var port = process.env.PORT || 3000;
var five = require('johnny-five');
var express = require('express');
var app = express();
var server = require('http').createServer(app);

var io = require('socket.io')(server);
var Firebase = require('firebase');
var OpenTok = require('opentok');

var messagesRef = new Firebase('https://parasite.firebaseio.com/');
var opentok = new OpenTok('44919541', '0ab0fe6e4c0241b1c04b772d4468191d937e84e8');

var sessionId = '2_MX40NDkxOTU0MX5-TW9uIEF1ZyAxMSAxNzo1MDo0NCBQRFQgMjAxNH4wLjAxMzQ0NzgyMX5-';
var apiKey = '44919541';
var token;

var board = new five.Board();
var led;

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');

// usernames which are currently connected to the chat
var userNameList = new Array(9);
var numUsers = 0;

app.get('/', function(req, res) {

      token = opentok.generateToken(sessionId);

       res.render('index.ejs', {
        apiKey: apiKey,
        sessionId: sessionId,
        token: token,
        userNameList: userNameList,
        numUsers: numUsers

  });
});

app.get('/host', function(req, res) {

      token = opentok.generateToken(sessionId);

       res.render('host.ejs', {
        apiKey: apiKey,
        sessionId: sessionId,
        token: token,
        userNameList: userNameList
  });
});

function addToArrayRandom( name, array ){

  while (true) {

    var randNum = getRandomInt(0, array.length - 1);
    if (array[randNum] == null)
      {
        array[randNum] = name;
        break;
      }

  }

    /**
    *  * Returns a random integer between min (inclusive) and max (inclusive)
    *   * Using Math.round() will give you a non-uniform distribution!
    *    */

    function getRandomInt(min, max) {
          return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {

    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      userName: socket.userName,
      message: data
    });

//FireBase log their message !!!
    messagesRef.push({
      userName: socket.userName,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (userName) {
    // we store the username in the socket session for this client
    socket.userName = userName;
  addToArrayRandom(userName, userNameList);

    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers,
      userName: userName,
      userNameList: userNameList
    });

    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      userName: socket.userName,
      numUsers: numUsers,
      userNameList: userNameList
    });
  });


  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      userName: socket.userName
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.userName
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    // remove the username from global usernames list
    if (addedUser) {
      userNameList[userNameList.indexOf(socket.userName)] = null;
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        userName: socket.userName,
        numUsers: numUsers
      });
    }
  });

  //bm: when user hovers over user video box.. broadcast to others
  socket.on('hoverOn', function (hoverNum) {
   led.on();
    socket.broadcast.emit('user hovOn', hoverNum);

    });


  socket.on('hoverOff', function (hoverNum) {
   led.off();
    socket.broadcast.emit('user hovOff', hoverNum);
  });
});

board.on('ready', function(){
  led = new five.Led(13);
  console.log('ready!');
});

/*
function ledToggle( pinNum, action){
  

}
*/
