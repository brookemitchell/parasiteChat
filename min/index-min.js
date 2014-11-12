var port = process.env.PORT || 3e3;

var five = require("johnny-five");

var express = require("express");

var app = express();

var server = require("http").createServer(app);

var io = require("socket.io")(server);

var Firebase = require("firebase");

var OpenTok = require("opentok");

var fs = require("fs");

var date = new Date();

var loggi = fs.createWriteStream("logs/" + date.toLocaleString() + ".txt");

var messagesRef = new Firebase("https://parasite.firebaseio.com/");

var opentok = new OpenTok("44919541", "0ab0fe6e4c0241b1c04b772d4468191d937e84e8");

var sessionId = "2_MX40NDkxOTU0MX5-TW9uIEF1ZyAxMSAxNzo1MDo0NCBQRFQgMjAxNH4wLjAxMzQ0NzgyMX5-";

var apiKey = "44919541";

var token;

var hoverNums = [ 0, 0, 0, 0, 0, 0, 0, 0 ];

server.listen(port, function() {
    console.log("Server listening at port %d", port);
});

app.use(express.static(__dirname + "/public"));

app.set("view engine", "ejs");

var userNameList = new Array(8);

var numUsers = 0;

app.get("/", function(req, res) {
    token = opentok.generateToken(sessionId);
    res.render("index.ejs", {
        apiKey: apiKey,
        sessionId: sessionId,
        token: token,
        userNameList: userNameList,
        numUsers: numUsers
    });
});

app.get("/host", function(req, res) {
    token = opentok.generateToken(sessionId, {
        role: "moderator"
    });
    res.render("host.ejs", {
        apiKey: apiKey,
        sessionId: sessionId,
        token: token,
        userNameList: userNameList
    });
});

app.get("/start", function(req, res) {
    opentok.startArchive(app.get("sessionId"), {
        name: "Node Archiving Sample App"
    }, function(err, archive) {
        if (err) return res.send(500, "Could not start archive for session " + sessionId + ". error=" + err.message);
        res.json(archive);
    });
});

app.get("/stop/:archiveId", function(req, res) {
    var archiveId = req.param("archiveId");
    opentok.stopArchive(archiveId, function(err, archive) {
        if (err) return res.send(500, "Could not stop archive " + archiveId + ". error=" + err.message);
        res.json(archive);
    });
});

function addToArrayRandom(name, array) {
    while (true) {
        var randNum = getRandomInt(0, array.length - 1);
        if (!array[randNum]) {
            array[randNum] = name;
            break;
        }
    }
    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

io.on("connection", function(socket) {
    var addedUser = false;
    socket.on("new message", function(data) {
        socket.broadcast.emit("new message", {
            userName: socket.userName,
            message: data
        });
        messagesRef.push({
            userName: socket.userName,
            message: data
        });
    });
    socket.on("add user", function(userName) {
        socket.userName = userName;
        addToArrayRandom(userName, userNameList);
        ++numUsers;
        addedUser = true;
        socket.emit("login", {
            numUsers: numUsers,
            userName: userName,
            userNameList: userNameList
        });
        socket.broadcast.emit("user joined", {
            userName: socket.userName,
            numUsers: numUsers,
            userNameList: userNameList
        });
        var arcTime = new Date();
        opentok.startArchive(sessionId, {
            name: userNameList.indexOf(socket.userName) + ": " + arcTime.toLocaleString().slice(0, -15)
        }, function(err, archive) {
            if (err) return console.log(err);
            console.log("new archive:" + archive.id);
        });
    });
    socket.on("typing", function() {
        socket.broadcast.emit("typing", {
            userName: socket.userName
        });
    });
    socket.on("stop typing", function() {
        socket.broadcast.emit("stop typing", {
            username: socket.userName
        });
    });
    socket.on("disconnect", function() {
        if (addedUser) {
            userNameList[userNameList.indexOf(socket.userName)] = null;
            --numUsers;
            socket.broadcast.emit("user left", {
                userName: socket.userName,
                numUsers: numUsers
            });
            socket.broadcast.emit("user hovOff", userNameList.indexOf(socket.userName));
        }
    });
    socket.on("hoverOn", function(hoverNum) {
        hoverNum = Number(hoverNum);
        var now = new Date();
        hoverNums[hoverNum]++;
        if (hoverNums[hoverNum] === 1) {
            if (userNameList[hoverNum] === (null || undefined)) {
                loggi.write(now.toLocaleString().slice(0, -15) + ": " + hoverNum + " loop on\n");
            } else loggi.write(now.toLocaleString() + ": " + hoverNum + " archive on\n");
        }
        socket.broadcast.emit("user hovOn", hoverNum);
    });
    socket.on("hoverOff", function(hoverNum) {
        now = new Date();
        hoverNums[hoverNum]--;
        if (hoverNums[hoverNum] === 0) {
            loggi.write(now.toLocaleString().slice(0, -15) + ": " + hoverNum + " off\n");
        }
        socket.broadcast.emit("user hovOff", hoverNum);
    });
    socket.on("inputVol", function(array) {
        socket.broadcast.emit("userVol", array);
    });
    socket.on("servInputVol", function(vol) {
        socket.broadcast.emit("servInputVol", vol);
    });
});