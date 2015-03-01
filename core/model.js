// Required modules
var redis = require('redis');
var mysql = require('mysql');
var crypto = require('crypto');

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

    token:
    {
        generate: function(callback)
        {
            var salt = crypto.randomBytes(32).toString('base64');
            var noise = crypto.randomBytes(32).toString('base64');
            var token = crypto.createHmac("sha256", salt).update(noise).digest("hex");

            // Check to make sure the generated ID doesn't already exist
            model.redis.get("token:" + token, function(error, response)
            {
                // Return false on error
                if(error)
                {
                    callback(false);
                }
                // If this ID is already in use, try generating again (hahah there was a collision, YEAH RIGHT)
                else if(response)
                {
                    generate_id(callback);
                }
                // Otherwise, pass our generated ID to the callback
                else if(typeof callback == "function")
                {
                    callback(token);
                }
            });
        },
        
        set: function(user, command, callback)
        {
            var data = {user: user, command: command};

            model.token.generate(function(token)
            {
                // Return false on error
                if(!token)
                {
                    callback(false);
                }
                
                // Save this token for 5 minutes
                model.redis.set("token:" + token, JSON.stringify(data), 'ex', 300, function(error, response)
                {
                    if(error)
                    {
                        callback(false);
                    }
                    else
                    {
                        callback(token);
                    }
                });
            });
        },

        get: function(token, callback)
        {
            model.redis.get("token:" + token, callback);
        }
    },

    error: function(error)
    {
        console.log('Database Error!', error);
        if(error.code === 'PROTOCOL_CONNECTION_LOST')
        {
            console.log("Reconnecting...");
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
            model.mysql.addListener(event, model[event]);
        }
    },

    unbind: function()
    {
        for(var i = 0, l = model.events.length; i < l; i++)
        {
            var event = model.events[i];
            model.mysql.removeListener(event, model[event]);
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
        delete client, core, crypto, model;
    }
}


