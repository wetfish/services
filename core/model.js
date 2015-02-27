// Required modules
var redis = require('redis');
var mysql = require('mysql');

var client, core;

// Database model
var model =
{
    events: ['error'],
    
    // Database connection variables
    redis: false,
    mysql: false,

    // Function to connect to our databases
    connect: function(config)
    {
        model.redis = redis.createClient(6303);
        model.mysql = mysql.createConnection(
        {
            host     : 'localhost',
            user     : core.secrets.mysql.username,
            password : core.secrets.mysql.password,
            database : core.secrets.mysql.database,
            timezone : 'utc' 
        });

        model.mysql.connect();
    },

    disconnect: function()
    {
        model.redis.quit();
        model.mysql.end();
    },

    error: function(error)
    {
        console.log('Database Error!', error);
        if(error.code === 'PROTOCOL_CONNECTION_LOST')
        {
            model.disconnect();

            // Try reconnecting in a few seconds...
            setTimeout(function()
            {
                model.connect();
            }, 3000);
        }
        else
        {
            throw error;
        }
    },

    bind: function()
    {
        for(var i = 0, l = model.events.length; i < l; i++)
        {
            var event = model.events[i];
            model.mysql.addListener(event, output[event]);
        }
    },

    unbind: function()
    {
        for(var i = 0, l = model.events.length; i < l; i++)
        {
            var event = model.events[i];
            model.mysql.removeListener(event, output[event]);
        }
    }
};

module.exports =
{
    load: function(_client, _core)
    {
        client = _client;
        core = _core;

        model.connect();
        model.bind();
        
        core.model = model;
    },
    
    unload: function(_client, _core)
    {
        model.disconnect();
        model.unbind();
        
        delete core.model;
        delete client, core, model;
    }
}


