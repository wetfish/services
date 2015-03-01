// Nickname services
var client, core;
var login = require("../login/sdk/server/wetfish-login");

var nickserv =
{
    //
    // General functions
    ////////////////////////////////////////

    // Initialize services after authentication
    init: function()
    {
        console.log("Initializing services...");

        // Set nickname
        client.send('sanick', client.nick, 'NickServ');
    },

    // Bind and unbind events
    bind: function()
    {
        for(var i = 0, l = nickserv.events.client.length; i < l; i++)
        {
            var event = nickserv.events.client[i];
            client.addListener(event, nickserv["client_" + event]);
        }

        for(var i = 0, l = nickserv.events.redis.length; i < l; i++)
        {
            var event = nickserv.events.redis[i];
            core.model.redisIPC.addListener(event, nickserv["redis_" + event]);
        }
    },

    unbind: function()
    {
        for(var i = 0, l = nickserv.events.client.length; i < l; i++)
        {
            var event = nickserv.events.client[i];
            client.removeListener(event, nickserv["client_" + event]);
        }

        for(var i = 0, l = nickserv.events.redis.length; i < l; i++)
        {
            var event = nickserv.events.redis[i];
            core.model.redisIPC.removeListener(event, nickserv["redis_" + event]);
        }
    },


    //
    // Event handlers
    ////////////////////////////////////////

    events:
    {
        client: ['raw', 'message'],
        redis: ['message']
    },

    client_raw: function(input)
    {
        if(input.command == "rpl_youreoper")
        {
            nickserv.init();
        }
    },

    client_message: function(from, to, message)
    {
        message = message.split(" ");
        var command = message.shift();

        // Only accept PMs
        if(to != client.nick) return;

        // If this is a valid command
        if(nickserv.commands.indexOf(command) > -1)
        {
            // Call bot command handler function
            nickserv['_'+command](from, message);
        }
    },

    redis_message: function(command, user)
    {
        user = JSON.parse(user);
        console.log(user);
        
        if(command == 'register')
        {
            core.model.user.register(user, function(error, account)
            {
                if(error)
                {
                    console.log(error);
                }
                else
                {
                    client.say(user.name, "Congrats! You're the proud new owner of the name "+user.name);
                    var slots = 3 - account.names.length;

                    if(slots > 1)
                    {
                        client.say(user.name, "You can register up to "+slots+" more names");
                    }
                    else if(slots == 1)
                    {
                        client.say(user.name, "You can register 1 more name");
                    }
                    else
                    {
                        client.say(user.name, "But watch out, you can't fit any more names on this account!");
                    }
                    
                    client.send('samode', user.name, '+r');
                }

               console.log(account);
            });            
        }
        else if(command == 'login')
        {
            client.say(user.name, "BOOM. LOGIN BABY@");
        }
        else if(command == 'ghost')
        {
            client.say(user.name, "ur ded lmao");
        }
    },

    //
    // Bot commands
    ////////////////////////////////////////
    
    commands: ['register', 'login', 'ghost', 'host'],

    _register: function(user, message)
    {
        // Check if username is already registered
        core.model.user.name({name: user}, function(error, response)
        {
            if(response.length)
            {
                client.say(user, "Sorry friend, this name is already registered.");
            }
            else
            {
                // Generate a unique token for this request
                core.model.token.set(user, "register", function(token)
                {
                    // Notify the user
                    client.say(user, "Thank you for registering on FishNet! Please visit https://services.wetfish.net/token/"+token+" to verify your account.");
                });
            }
        });        
    },

    _login: function(user, message)
    {
        // Check if username is actually registered
        
        // Generate a unique token for this request
        core.model.token.set(user, "login", function(token)
        {
            // Notify the user
            client.say(user, "Logging in as "+user+"! Please visit https://services.wetfish.net/token/"+token+" to authorize this action.");
        });
    },

    _ghost: function(user, message)
    {
        var target = message.shift();
        // Check if target is a registered name

        if(target)
        {
            // Generate a unique token for this request
            core.model.token.set(target, "ghost", function(token)
            {
                // Notify the user
                client.say(user, "User "+target+" will be disconnected! Please visit https://services.wetfish.net/token/"+token+" to authorize this action.");
            });
        }
        else
        {
            client.say(user, "Error! You must specify a username to disconnect.");
        }
    },

    _host: function()
    {
        // Check if user is logged in
        console.log("ur very crative");
    },
}

module.exports =
{
    load: function(_client, _core)
    {
        client = _client;
        core = _core;

        // Initialize wetfish login
        login.init(core.secrets.login);

        // Subscribe to redis authorization events
        core.model.redisIPC.subscribe("register");
        core.model.redisIPC.subscribe("login");
        core.model.redisIPC.subscribe("ghost");

        // Bind event listeners
        nickserv.bind();
    },
    
    unload: function(_client, _core)
    {
        // Unbind event listeners
        nickserv.unbind();
        
        delete client, core, login, nickserv;
    }
}
