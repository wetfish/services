var express = require('express');
var app = express();
var server = require('http').createServer(app);

var login = require("./login/sdk/server/wetfish-login");
var config = require("./config/secret");
var model = require("./core/model").get({secrets: config});

login.init(config.login);
model.connect();

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

app.get('/token/:token', function(req, res)
{    
    // Process token
    model.redis.get("token:" + req.params.token, function(error, response)
    {
        if(error || !response)
        {
            res.send("Sorry, this token isn't valid. It may have expired!");
        }
        else
        {
            var authorized = JSON.parse(response);
            model.redisIPC.publish(authorized.command, authorized.user);

            res.send("Thank you! Your request has been authorized.");
        }

        res.end();
    });
});
