// Setup basic express server
var port = process.env.PORT || 3000;
var five = require('johnny-five');
var express = require('express');
var app = express();
var server = require('http').createServer(app);

var io = require('socket.io')(server);
var Firebase = require('firebase');
var OpenTok = require('opentok');

var fs = require('fs');
var date = new Date();
var loggi = fs.createWriteStream('logs/' + date.toLocaleString() + '.txt');

var messagesRef = new Firebase('https://parasite.firebaseio.com/');
var opentok = new OpenTok('44919541', '0ab0fe6e4c0241b1c04b772d4468191d937e84e8');

var sessionId = '2_MX40NDkxOTU0MX5-TW9uIEF1ZyAxMSAxNzo1MDo0NCBQRFQgMjAxNH4wLjAxMzQ0NzgyMX5-';
var apiKey = '44919541';
var token;
var hoverNums = [0, 0, 0, 0, 0, 0, 0, 0, 0];

// var board = new five.Board({repl:false});

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');

var userNameList = new Array(8);
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

      token = opentok.generateToken(sessionId, {role: 'moderator'});

       res.render('host.ejs', {
        apiKey: apiKey,
        sessionId: sessionId,
        token: token,
        userNameList: userNameList
  });
});

app.get('/start', function(req, res) {
    opentok.startArchive(app.get('sessionId'), {
      name: 'Node Archiving Sample App'
    }, function(err, archive) {
      if (err) return res.send(500,
        'Could not start archive for session '+sessionId+'. error='+err.message);
      res.json(archive);
  });
});

app.get('/stop/:archiveId', function(req, res) {
    var archiveId = req.param('archiveId');
    opentok.stopArchive(archiveId, function(err, archive) {
      if (err) return res.send(500, 'Could not stop archive '+archiveId+'. error='+err.message);
      res.json(archive);
  });
});

function addToArrayRandom( name, array ){
  while (true) {
    var randNum = getRandomInt(0, array.length - 1);
    if (!array[randNum])
      {
        array[randNum] = name;
        break;
      }
  }

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
    //create and archive
  var arcTime = new Date();
  opentok.startArchive(sessionId,
    { name: userNameList.indexOf(socket.userName) + ': ' + arcTime.toLocaleString().slice(0,-15) },
    function(err, archive) {
      if (err) return console.log(err);

      // The id property is useful to save off into a database
      console.log("new archive:" + archive.id);
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
        socket.broadcast.emit('user hovOff', userNameList.indexOf(socket.userName));
    }
  });

  //bm: when user hovers over user video box.. broadcast to others
  socket.on('hoverOn', function (hoverNum) {
    hoverNum = Number(hoverNum);
    var now = new Date();
        hoverNums[hoverNum]++;
    if (hoverNums[hoverNum] === 1){
      if (userNameList[hoverNum] === (null || undefined)){
        loggi.write(now.toLocaleString().slice(0, -15) + ': ' + hoverNum + ' loop on\n');
      }
      else loggi.write(now.toLocaleString() + ': ' + hoverNum + ' archive on\n');
        // global['l' + hoverNum].on();
    }
      socket.broadcast.emit('user hovOn', hoverNum);
  });

  socket.on('hoverOff', function (hoverNum) {
    now = new Date();
      hoverNums[hoverNum]--;
    if (hoverNums[hoverNum] === 0){
      loggi.write(now.toLocaleString().slice(0, -15) + ': ' + hoverNum + ' off\n');
      // global['l' + hoverNum].off();
    }
      socket.broadcast.emit('user hovOff', hoverNum);
  });

  socket.on('inputVol', function (array){
    socket.broadcast.emit('userVol', array);
  });

  socket.on('servInputVol', function (vol){
    socket.broadcast.emit('servInputVol', vol);
  });
});
/*
board.on('ready', function(){
   for (var i = 0; i < 8; i++){
    switch (i){
    case 0:
      case 1:
      case 2:
      case 3:
      case 4:
        global['b' + i]  = new five.Button({
          pin: i,
          isPullup: true
        });
        break;
      case 5:
        global.b5 = new five.Button({
          pin: 13,
          isPullup: true
        });
        break;
      case 6:
      case 7:
          global['b' + i]  = new five.Button({
            pin: i + 14,
            type: 'digital',
            isPullup: true
          });
          break;
      }

   global['l' + i] = new five.Led(i + 5);
   }

  b0.on("down", function(value) {
    l0.on();
    io.sockets.emit('user hovOn', 0);
  });
  b1.on("down", function(value) {
    l1.on();
    io.sockets.emit('user hovOn', 1);
  });
  b2.on("down", function(value) {
    l2.on();
    io.sockets.emit('user hovOn', 2);
  });
  b3.on("down", function(value) {
    l3.on();
    io.sockets.emit('user hovOn', 3);
  });
  b4.on("down", function(value) {
    l4.on();
    io.sockets.emit('user hovOn', 4);
  });
  b5.on("down", function(value) {
    l5.on();
    io.sockets.emit('user hovOn', 5);
  });
  b6.on("down", function(value) {
    l6.on();
    io.sockets.emit('user hovOn', 6);
  });
  b7.on("down", function(value) {
    l7.on();
    io.sockets.emit('user hovOn', 7);
  });
  b0.on("up", function() {
    l0.off();
    io.sockets.emit('user hovOff', 0);
  });
  b1.on("up", function() {
    l1.off();
    io.sockets.emit('user hovOff', 1);
  });
  b2.on("up", function() {
    l2.off();
    io.sockets.emit('user hovOff', 2);
  });
  b3.on("up", function() {
    l3.off();
    io.sockets.emit('user hovOff', 3);
  });
  b4.on("up", function() {
    l4.off();
    io.sockets.emit('user hovOff', 4);
  });
  b5.on("up", function() {
    l5.off();
    io.sockets.emit('user hovOff', 5);
  });
  b6.on("up", function() {
    l6.off();
    io.sockets.emit('user hovOff', 6);
  });
  b7.on("up", function() {
    l7.off();
    io.sockets.emit('user hovOff', 7);
  });
});
*/
