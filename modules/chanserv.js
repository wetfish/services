var extend = require('util')._extend;
var events = require('events')
var event = new events.EventEmitter();
var client, core, model;

// Channel services
var chanserv =
{
    modes: {},          // Object for storing user modes from whois data
    channels: {},       // Temporary object for storing names in channels being verified

    //
    // General functions
    ////////////////////////////////////////

    // Initialize services after authentication
    init: function()
    {
        console.log("Initializing services...");

        // Set nickname
        client.send('sanick', client.nick, 'ChanServ');
    },

    // Check if a user is logged in
    auth: function(username, callback)
    {
        // Check if username is actually registered
        model.user.name({name: username}, function(error, response)
        {
            if(error || !response.length)
            {
                return callback(true);
            }

            var user = response[0];
            
            // Now check if this user is logged in
            client.whois(username, function()
            {
                if(chanserv.modes[username] && chanserv.modes[username].indexOf('r') > -1)
                {
                    return callback(false, user);
                }

                return callback(true);
            });
        });
    },

    // Parse user names and modes from a names reply
    names: function(text)
    {
        var statuses =
        {
            '~': 'q',
            '&': 'a',
            '@': 'o',
            '%': 'h',
            '+': 'v'
        };
        
        // Ensure text is a string
        text = (typeof text == "string") ? text : '';
        var names = text.split(' ');
        var output = {};
        
        for(var i = 0, l = names.length; i < l; i++)
        {
            var name = names[i];
            var status = name[0];

            if(statuses[status])
            {
                name = name.substr(1);
                output[name] = statuses[status];
            }
            else
            {
                output[name] = '';
            }
        }

        return output;
    },
    
    // Bind and unbind events
    bind: function()
    {
        for(var i = 0, l = chanserv.events.client.length; i < l; i++)
        {
            var event = chanserv.events.client[i];
            client.addListener(event, chanserv["client_" + event]);
        }

        for(var i = 0, l = chanserv.events.redis.length; i < l; i++)
        {
            var event = chanserv.events.redis[i];
            model.redisIPC.addListener(event, chanserv["redis_" + event]);
        }
    },

    unbind: function()
    {
        for(var i = 0, l = chanserv.events.client.length; i < l; i++)
        {
            var event = chanserv.events.client[i];
            client.removeListener(event, chanserv["client_" + event]);
        }

        for(var i = 0, l = chanserv.events.redis.length; i < l; i++)
        {
            var event = chanserv.events.redis[i];
            model.redisIPC.removeListener(event, chanserv["redis_" + event]);
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
            chanserv.init();
        }

        // User mode information sent with whois
        else if(input.rawCommand == 379)
        {
            var user = input.args[1];
            var modes = input.args[2].match(/^is using modes \+([^ ]*)/);
            
            chanserv.modes[user] = modes[1];
        }

        else if(input.command == "rpl_namreply")
        {
            var channel = input.args[2];
            var names = input.args[3];

            if(typeof chanserv.channels[channel] == "undefined")
            {
                chanserv.channels[channel] = {};
            }

            chanserv.channels[channel] = extend(chanserv.channels[channel], chanserv.names(names));
        }

        else if(input.command == "rpl_endofnames")
        {
            var channel = input.args[1];
            console.log(chanserv.channels[channel]);
        }

//        console.log(arguments);
    },

    client_message: function(from, to, message)
    {
        message = message.split(" ");
        var command = message.shift();

        // If this is a valid command
        if(chanserv.commands.indexOf(command) > -1)
        {
            // Check if a channel is specified in the command
            if(message[0] && message[0].indexOf('#') == 0)
            {
                to = message.shift();
            }
            
            // Call bot command handler function
            chanserv['_'+command](from, to, message);
        }
    },

    redis_message: function()
    {
        console.log(arguments);
    },

    //
    // Bot commands
    ////////////////////////////////////////
    
    commands: ['register', 'mode', 'access', 'admin', 'owner'],

    _register: function(username, channel, input)
    {
        if(channel.indexOf('#') != 0)
        {
            client.say(username, "This command must be used in a channel or by specifying the channel as the first parameter.");
            client.say(username, "For example: /msg ChanServ register #wetfish");
            return;
        }
        
        chanserv.auth(username, function(error, user)
        {
            if(error)
            {
                client.say(username, "Sorry! You need to be logged in to do this. Please register with NickServ before registering a channel.");
                return;
            }

            // Check if the channel is already registered
            // Check who is currently in the channel
            client.send('names', channel);

            // Is the requesting user is +o?
            
            client.say(username, "Wow what a great channel");
        });
    },

    _mode: function(from, to, input)
    {
        console.log("control freak?");
    },

    _access: function()
    {
        console.log("so permissive~");
    },

    _admin: function()
    {
        console.log("friendship engaged");
    },

    _owner: function()
    {
        console.log("goodbye old friend");
    },
}

module.exports =
{
    load: function(_client, _core)
    {
        client = _client;
        core = _core;
        model = _core.model;

        // Bind event listeners
        chanserv.bind();
    },
    
    unload: function(_client, _core)
    {
        // Unbind event listeners
        chanserv.unbind();
        
        delete extend, events, event, client, core, model, chanserv;
    }
}
