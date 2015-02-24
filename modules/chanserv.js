// Channel services
var client, core;

var chanserv =
{
    events: ['raw', 'message'],
    commands: ['register', 'mode', 'access', 'admin'],

    // Event handlers
    raw: function(input)
    {
        if(input.command == "rpl_youreoper")
        {
            chanserv.init();
        }
    },

    message: function(from, to, message)
    {
        message = message.split(" ");
        var command = message.shift();

        // If this is a valid command
        if(chanserv.commands.indexOf(command) > -1)
        {
            // Call the handler function
            chanserv['_'+command](message);
        }
    },

    // Initialize services after authentication
    init: function()
    {
        console.log("Initializing services...");

        // Set nickname
        client.send('sanick', client.nick, 'ChanServ');
    },
    
    // User commands
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

    // General helpers
    bind: function()
    {
        for(var i = 0, l = chanserv.events.length; i < l; i++)
        {
            var event = chanserv.events[i];
            client.addListener(event, chanserv[event]);
        }
    },

    unbind: function()
    {
        for(var i = 0, l = chanserv.events.length; i < l; i++)
        {
            var event = chanserv.events[i];
            client.removeListener(event, chanserv[event]);
        }
    }
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
