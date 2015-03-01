var express = require('express');
var app = express();
var server = require('http').createServer(app);
var session = require('express-session');
var RedisStore = require('connect-redis')(session);

var login = require("./login/sdk/server/wetfish-login");
var config = require("./config/secret");
var model = require("./core/model").get({secrets: config});

login.init(config.login);
model.connect();

server.listen(2303);
console.log("IRC services web server started");

// Use the existing connection for session data
app.use(session({
    store: new RedisStore({client: model.redis}),
    secret: config.session.secret
}));

app.use(express.static(__dirname + '/static'));

app.get('/login', function(req, res)
{
    login.verify(req.query.token, function(verified)
    {
        if(verified.status == "success")
        {
            req.session.user = verified.data;

            // If there's a token to redirect to
            if(req.session.token)
            {
                res.redirect("/token/"+req.session.token);
                return;
            }

            res.send("You're logged in!");
        }
        else
        {
            res.send("There was an error!<p><b>" + verified.message + "</b></p>");
        }

        res.end();
    });
});

app.get('/token/:token', function(req, res)
{
    // Save this token in case we get redirected!
    req.session.token = req.params.token;
    
    // Force login if there's no user session
    if(typeof req.session.user == "undefined")
    {
        res.redirect("https://login.wetfish.net/apps/join/9558564c57c9d0780729dd267d36aaee09490ca8d0b3e602cefdbe845230368d");
        return;
    }

    // Unset saved token
    delete req.session.token;
    
    // Process current token
    model.token.get(req.params.token, function(error, response)
    {
        if(error || !response)
        {
            res.send("Sorry, this token isn't valid. It may have expired!");
        }
        else
        {
            // Delete token after use
            model.token.delete(req.params.token);
            
            var authorized = JSON.parse(response);
            var user = {session: req.session.user, name: authorized.user};
            
            model.redisIPC.publish(authorized.command, JSON.stringify(user));
            res.send("Thank you! Your request has been authorized.");
        }

        res.end();
    });
});
