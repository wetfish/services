// Channel services
var client, core;

var chanserv =
{
    // Object for storing user modes
    modes: {},

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
            core.model.redisIPC.addListener(event, chanserv["redis_" + event]);
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
            core.model.redisIPC.removeListener(event, chanserv["redis_" + event]);
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

//        console.log(arguments);
    },

    client_message: function(from, to, message)
    {
        message = message.split(" ");
        var command = message.shift();

        // If this is a valid command
        if(chanserv.commands.indexOf(command) > -1)
        {
            // Call bot command handler function
            chanserv['_'+command](from, message);
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

    _register: function()
    {
        console.log("this must be a great channel");
    },

    _mode: function()
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

        // Bind event listeners
        chanserv.bind();
    },
    
    unload: function(_client, _core)
    {
        // Unbind event listeners
        chanserv.unbind();
        
        delete client, core, chanserv;
    }
}
