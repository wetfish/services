var express = require('express');
var app = express();
var server = require('http').createServer(app);

server.listen(2303);
console.log("IRC services web server started");

app.use(express.static(__dirname + '/static'));
