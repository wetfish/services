var output =
{
    client: false,
    methods: ['message', 'action', 'error', 'raw'],

    message: function(from, to, message, details)
    {
        // Only output private messages
        if(to[0] == "#") return;
        
        console.log("["+to+"] <"+from+"> "+message);
    },

    action: function(from, to, message, details)
    {
        // Only output private messages
        if(to[0] == "#") return;

        console.log("["+to+"] * "+from+" "+message);
    },

    join: function(channel, user, details)
    {
        console.log("["+channel+"] User "+user+" joined");
    },

    part: function(channel, user, reason, details)
    {
        console.log("["+channel+"] User "+user+" left (Message: "+reason+")");
    },

    quit: function(user, reason, channels)
    {
        console.log("[Server] User "+user+" quit (Message: "+reason+")");
    },

    nick: function(old_user, new_user, channels)
    {
        console.log("[Server] User "+old_user+" changed their name to "+new_user);
    },

    kick: function(channel, user, by, reason)
    {
        console.log("["+channel+"] User "+user+" kicked by "+by+" (Message: "+reason+")");
    },

    error: function(error)
    {
        console.log("/!\\ ERROR #"+error.rawCommand+": "+error.command+" /!\\");
        console.log(JSON.stringify(error));
    },

    raw: function()
    {
//        console.log(arguments);
    },

    bind: function()
    {
        for(var i = 0, l = output.methods.length; i < l; i++)
        {
            var method = output.methods[i];
            output.client.addListener(method, output[method]);
        }
    },

    unbind: function()
    {
        for(var i = 0, l = output.methods.length; i < l; i++)
        {
            var method = output.methods[i];
            output.client.removeListener(method, output[method]);
        }
    }
};

module.exports =
{
    load: function(client)
    {
        output.client = client;
        output.bind();
    },

    unload: function()
    {
        output.unbind();
        delete output;
    }
};
