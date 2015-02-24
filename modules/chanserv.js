// Channel services

var client, core;

var chanserv =
{
    events: ['raw'],

    raw: function(input)
    {
        if(input.command == "rpl_youreoper")
        {
            chanserv.init();
        }
    },

    // Initialize services after authentication
    init: function()
    {
        console.log("Initializing services...");

        // Set nickname
        client.send('sanick', client.nick, 'ChanServ');
    },

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
