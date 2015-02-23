var client, core;

// Oper login
var oper =
{
    host: "network.services", // The hostname we should have after authenticating
    events: ['registered', 'whois'],

    // Event fired upon connecting to the network
    registered: function()
    {
        client.connected = true;
        oper.whoami();
    },

    whoami: function()
    {
        // Get current hostname
        client.whois(client.nick);
    },

    whois: function(response)
    {
        if(response.nick == client.nick)
        {
            client.host = response.host;

            // Check if we need to log in
            oper.login();
        }
    },
 
    login: function()
    {        
        // If we need to log in
        if(client.host != oper.host)
        {
            core.prompt.question("Please enter the services password: ", function(password)
            {
                client.send("oper", "services", password);
            });
        }
    },

    bind: function()
    {
        for(var i = 0, l = oper.events.length; i < l; i++)
        {
            var event = oper.events[i];
            client.addListener(event, oper[event]);
        }
    },

    unbind: function()
    {
        for(var i = 0, l = oper.events.length; i < l; i++)
        {
            var event = oper.events[i];
            client.removeListener(event, oper[event]);
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
        oper.bind();

        // If we're already connected, but not logged in
        if(client.connected && client.host != oper.host)
        {
            oper.whoami();
        }
    },
    
    unload: function(_client, _core)
    {
        // Unbind event listeners
        oper.unbind();
        
        delete client, core, oper;
    }
}
