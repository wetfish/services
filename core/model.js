// Required modules
var redis = require('redis');
var mysql = require('mysql');

var client, core;

// Database model
var model =
{
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
    }
};

module.exports =
{
    load: function(_client, _core)
    {
        client = _client;
        core = _core;

        model.connect();
        core.model = model;
    },
    
    unload: function(_client, _core)
    {
        model.disconnect();
        
        delete core.model;
        delete client, core, model;
    }
}


