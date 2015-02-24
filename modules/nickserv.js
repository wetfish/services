// Nickname services
// raw: rpl_youreoper

var client, core;

var nickserv =
{
    events: ['raw'],

    raw: function(input)
    {
        if(input.command == "rpl_youreoper")
        {
            nickserv.init();
        }
    },

    // Initialize services after authentication
    init: function()
    {
        console.log("Initializing services...");

        // Set nickname
        client.send('sanick', client.nick, 'NickServ');
    },

    bind: function()
    {
        for(var i = 0, l = nickserv.events.length; i < l; i++)
        {
            var event = nickserv.events[i];
            client.addListener(event, nickserv[event]);
        }
    },

    unbind: function()
    {
        for(var i = 0, l = nickserv.events.length; i < l; i++)
        {
            var event = nickserv.events[i];
            client.removeListener(event, nickserv[event]);
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
        nickserv.bind();
    },
    
    unload: function(_client, _core)
    {
        // Unbind event listeners
        nickserv.unbind();
        
        delete client, core, nickserv;
    }
}
