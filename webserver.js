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
            res.send("Thank you for logging in! To complete the registration process, please paste the following command into IRC:<p><b>/msg nickserv auth "+req.query.token+"</b></p>");
        else
            res.send("There was an error!<p><b>" + verified.message + "</b></p>");

        res.end();
    });
});
