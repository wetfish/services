// Required modules
var redis = require('redis');
var mysql = require('mysql');
var crypto = require('crypto');

var client, core;

// Database model
var model =
{
    events:
    {
        mysql: ['error'],
        redis: ['ready']
    },
    
    // Database connection variables
    redis: false,
    mysql: false,

    // Functions to connect to our databases
    connect: function(config)
    {
        model.connect_redis(config);
        model.connect_mysql(config);
    },

    connect_redis: function(config)
    {
        // Main redis connection
        model.redis = redis.createClient(6303);

        // Redis connection for IPC
        model.redisIPC = redis.createClient(6303);
    },

    connect_mysql: function(config)
    {
        // MySQL connection
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
        model.redisIPC.quit();
        
        model.mysql.end();
    },

    // Function to generate select statements from objects
    where: function(select, glue)
    {
        if(typeof glue == "undefined")
            glue = " and ";

        var where = [];
        var values = [];
        
        for(var i = 0, keys = Object.keys(select), l = keys.length; i < l; i++)
        {
            where.push(model.mysql.escapeId(keys[i]) + ' = ?');
            values.push(select[keys[i]]);
        }

        return {where: where.join(glue), values: values};
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
                
                // Save this token for 15 minutes
                model.redis.set("token:" + token, JSON.stringify(data), 'ex', 900, function(error, response)
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
        },

        delete: function(token, callback)
        {
            model.redis.del("token:" + token, callback);
        }
    },

    user:
    {
        register: function(auth, callback)
        {
            // Try to insert new user account, don't worry if there's a duplicate
            model.mysql.query("Insert into `accounts` set ?", {fish_id: auth.session.user_id}, function(error, response)
            {
                if(error)
                {
                    // Log out the error, just in case...
                    console.log(error, response);
                }

                model.user.get({fish_id: auth.session.user_id}, function(error, user)
                {
                    if(error)
                    {
                        console.log(error, response);
                    }
                    else
                    {
                        var data =
                        {
                            account_id: user.account_id,
                            name: auth.name
                        };
                        
                        // Insert new user name
                        model.mysql.query("Insert into `names` set ?, `registered` = now(), `active` = now()", data);

                        // Add one to the user names count
                        model.mysql.query("Update `accounts` set `names` = `names` + 1 where `account_id` = ?", user.account_id, function(error, response)
                        {
                            // Return callback with user data
                            model.user.get({account_id: user.account_id}, callback);
                        });
                    }
                });
            });
        },

        login: function(user, callback)
        {
            // Update user activity time
            model.mysql.query("Update `names` set `active` = now() where `name` = ?", user, callback);
        },

        // Get all user data
        get: function(select, callback)
        {
            // First get account data
            select = model.where(select);
            model.mysql.query("Select * from `accounts` where "+select.where+" limit 1", select.values, function(error, response)
            {
                if(error || !response.length)
                {
                    callback(error, {names: []});
                }
                else
                {
                    var account = response[0];

                    // Now get all user names
                    model.user.name({account_id: account.account_id}, function(error, response)
                    {
                        account.names = (response || []);
                        callback(error, account);
                    });
                }
            });
        },

        // Get name data
        name: function(select, callback)
        {
            select = model.where(select);
            model.mysql.query("Select * from `names` where "+select.where, select.values, callback);
        },

        // Set a user's hostname
        host: function(user, host, callback)
        {
            // Get account info
            model.user.name({name: user}, function(error, response)
            {
                if(error || !response.length)
                {
                    callback(error, response);
                }
                else
                {
                    var name = response[0];
                    model.mysql.query("Update `accounts` set `host` = ? where `account_id` = ?", [host, name.account_id], callback);
                }
            });
        },

        // Get a list of channels a user has access to
        channels: function(username, callback)
        {
            var query =
            [
                "Select channels.name",
                "from channels, access, names",
                "where names.name = ?",
                "and names.account_id = access.account_id",
                "and access.channel_id = channels.channel_id"
            ];
            
            model.mysql.query(query.join(" "), username, callback);
        }
    },

    channel:
    {
        register: function(data, callback)
        {
            model.mysql.query("Insert into `channels` set ?, `registered` = now()", data, callback);
        },

        get: function(select, callback)
        {
            select = model.where(select);
            model.mysql.query("Select * from `channels` where "+select.where+" limit 1", select.values, function(error, response)
            {
                if(error || !response.length)
                {
                    callback(error, response);
                    return;
                }

                var channel = response[0];
                callback(error, channel);
            });
        },

        list: function(callback)
        {
            model.mysql.query("Select * from `channels`", callback);
        },

        set: function(select, data, callback)
        {
            select = model.where(select);
            select.values.unshift(data);
            
            model.mysql.query("Update `channels` set ? where "+select.where, select.values, callback);
        }
   },

    access:
    {
        add: function(select, data, callback)
        {
            // Get channel data
            model.channel.get(select, function(error, channel)
            {
                if(error || !channel)
                {
                    return callback(error, channel);
                }

                // Clone the insert data before adding the channel ID
                var insert = JSON.parse(JSON.stringify(data));
                insert.channel_id = channel.channel_id;
                
                model.mysql.query("Insert into `access` set ? on duplicate key update ?", [insert, data], callback);
            });
        },

        get: function(select, callback)
        {
            // Get user data
            model.user.name({name: select.user}, function(error, response)
            {
                if(error || !response.length)
                {
                    callback(error, response);
                    return;
                }

                var user = response[0];
                
                // Get channel data
                model.channel.get({name: select.channel}, function(error, channel)
                {
                    if(error || !channel)
                    {
                        callback(error, channel);
                        return;
                    }
                    
                    // Select this user from the access table
                    model.mysql.query("Select * from `access` where `channel_id` = ? and `account_id` = ?", [channel.channel_id, user.account_id], function(error, response)
                    {
                        var access = false;
                        
                        if(response && response.length)
                        {
                            access = response[0];
                        }
                        
                        var data =
                        {
                            user: user,
                            channel: channel,
                            access: access
                        }
                        
                        callback(error, data);
                    });
                });
            });
        },

        delete: function(select, callback)
        {
            // Get channel data
            model.channel.get({name: select.channel}, function(error, channel)
            {
                if(error || !channel)
                {
                    callback(error, channel);
                    return;
                }

                model.mysql.query("Delete from `access` where `channel_id` = ? and `account_id` = ?", [channel.channel_id, select.user.account_id], callback);
            });
        }
    },

    sanitize:
    {
        modes: function(input)
        {
            return input.replace(/[^aohv]/g, '');
        }
    },

    // Database triggered events
    ////////////////////////////////////////
    
    mysql_error: function(error)
    {
        console.log('MySQL Error!', error);

        // Array of expected errors we should recover from
        var errors =
        [
            'PROTOCOL_CONNECTION_LOST',
            'ECONNREFUSED',
        ];

        if(errors.indexOf(error.code) > -1)
        {
            console.log("Reconnecting...");
            model.mysql.end();
            model.unbind();

            // Try reconnecting in a few seconds...
            setTimeout(function()
            {
                model.connect_mysql();
                model.bind();
            }, 3000);
        }
    },

    redis_ready: function()
    {
        console.log("Connected to redis.");

        // If a core event emitter exists
        if(core.event)
        {
            core.event.emit('redis_ready');
        }
    },

    // Helper functions to bind and unbind model events
    bind: function()
    {
        for(var i = 0, l = model.events.mysql.length; i < l; i++)
        {
            var event = model.events.mysql[i];
            model.mysql.addListener(event, model["mysql_" + event]);
        }

        for(var i = 0, l = model.events.redis.length; i < l; i++)
        {
            var event = model.events.redis[i];
            model.redis.addListener(event, model["redis_" + event]);
        }
    },

    unbind: function()
    {
        for(var i = 0, l = model.events.mysql.length; i < l; i++)
        {
            var event = model.events.mysql[i];
            model.mysql.removeListener(event, model["mysql_" + event]);
        }

        for(var i = 0, l = model.events.redis.length; i < l; i++)
        {
            var event = model.events.redis[i];
            model.redis.removeListener(event, model["redis_" + event]);
        }
    }
};

module.exports =
{
    // Function to get the model when loaded by the webserver
    get: function(_core)
    {
        core = _core;
        return model;
    },

    // Called when this file is loaded as a bot module
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
