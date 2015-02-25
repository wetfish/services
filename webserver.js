var express = require('express');
var app = express();
var server = require('http').createServer(app);
var login = require("./login/sdk/server/wetfish-login");
var config = require("./config/secret");

login.init(config.login);

server.listen(2303);
console.log("IRC services web server started");

app.use(express.static(__dirname + '/static'));

app.get('/login', function(req, res)
{
    login.verify(req.query.token, function(verified)
    {
        if(verified.status == "success")
            res.end("Here's the data you allowed to be shared:\n\n" + JSON.stringify(verified.data, null, 4));
        else
            res.end("There was an error!\n\n" + verified.message);
    });
});
