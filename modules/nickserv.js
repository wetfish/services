// Nickname services
var client, core;

var nickserv =
{
    events: ['raw', 'message'],
    commands: ['register', 'auth', 'login', 'host'],

    // Event handlers
    raw: function(input)
    {
        if(input.command == "rpl_youreoper")
        {
            nickserv.init();
        }
    },

    message: function(from, to, message)
    {
        message = message.split(" ");
        var command = message.shift();

        // Only accept PMs
        if(to != client.nick) return;

        // If this is a valid command
        if(nickserv.commands.indexOf(command) > -1)
        {
            // Call the handler function
            nickserv['_'+command](from, message);
        }
    },

    // Initialize services after authentication
    init: function()
    {
        console.log("Initializing services...");

        // Set nickname
        client.send('sanick', client.nick, 'NickServ');
    },

    // User commands
    _register: function(user, message)
    {
        var temporary = message.join(" ");
        console.log("Saving temporary password...");

        // Save specified password for 1 hour (plaintext, ugh!)
        core.model.redis.set(user, temporary, 'ex', 3600);
        client.say(user, "Cool beans bro");
    },

    _auth: function()
    {
        console.log("Nice token babe");
    },

    _login: function()
    {
        console.log("Yay a password");
    },

    _host: function()
    {
        console.log("ur very crative");
    },

    // General helpers
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
