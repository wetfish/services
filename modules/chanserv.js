var extend = require('util')._extend;
var events = require('events')
var event = new events.EventEmitter();
var client, core, model;

// Channel services
var chanserv =
{
    users: {},          // Object for storing user modes from whois data
    channels: {},       // Temporary object for storing names in channels being verified

    //
    // General functions
    ////////////////////////////////////////

    // Initialize services after authentication
    init: function()
    {
        console.log("Initializing services...");

        // Set nickname
        client.send('sanick', client.nick, 'ChanServ');

        // Join registered channels
        chanserv.join();
    },

    // Check if a user is logged in
    auth: function(username, callback)
    {
        username = username.toLowerCase();

        // Check if username is actually registered
        model.user.name({name: username}, function(error, response)
        {
            if(error || !response.length)
            {
                return callback(true);
            }

            var user = response[0];

            // Now check if this user is logged in
            client.whois(username, function()
            {
                if(chanserv.users[username] && chanserv.users[username].indexOf('r') > -1)
                {
                    return callback(false, user);
                }

                return callback(true);
            });
        });
    },

    // Check if a user has admin access
    admin: function(channel, username, callback)
    {
        // First check if the user is even logged in
        chanserv.auth(username, function(error, response)
        {
            if(error)
            {
                callback(error, response);
                return;
            }

            // Now check if the user has access in the channel
            model.access.get({channel: channel, user: username}, function(error, response)
            {
                if(error)
                {
                    console.log(error);
                    return;
                }

                // If the user is the channel owner, or has admin access
                if(response.channel.owner == response.user.account_id || response.access.admin)
                {
                    return callback(false, response);
                }

                return callback(true, response);
            });
        });
    },

    // Apply saved user modes
    modes: function(channel, username)
    {
        // See if this user is logged in
        chanserv.auth(username, function(error, user)
        {
            if(error)
            {
                return;
            }

            // See if this user has access
            model.access.get({channel: channel, user: username}, function(error, response)
            {
                if(response.access)
                {
                    var access = response.access;

                    if(!access.modes.length)
                    {
                        return;
                    }
                    
                    // Create an array with the user's name repeated as many times as they have modes
                    var input = Array.prototype.map.call([]+Array(access.modes.length),function(){ return username; })

                    // Put other arguments into the input array
                    input.unshift(access.modes);
                    input.unshift(channel);
                    input.unshift('samode');
                    
                    client.send.apply(client, input);
                }
            });
        });
    },

    // Join all registered channels
    join: function()
    {
        // Get all registered channels
        model.channel.list(function(error, response)
        {
            if(error || !response.length)
            {
                console.log(error, response);
                return;
            }
            
            for(var i = 0, l = response.length; i < l; i++)
            {
                var channel = response[i];
                client.join(channel.name, function(user, details)
                {
                    client.send('samode', details.args[0], '+qo', 'ChanServ', 'ChanServ');
                });
            }
        });
    },

    // Parse user names and modes from a names reply
    names: function(text)
    {
        var statuses =
        {
            '~': 'q',
            '&': 'a',
            '@': 'o',
            '%': 'h',
            '+': 'v'
        };
        
        // Ensure text is a string
        text = (typeof text == "string") ? text : '';
        var names = text.split(' ');
        var output = {};
        
        for(var i = 0, l = names.length; i < l; i++)
        {
            var name = names[i];
            var status = name[0];

            if(statuses[status])
            {
                name = name.substr(1);
                output[name] = statuses[status];
            }
            else
            {
                output[name] = '';
            }
        }

        return output;
    },
    
    // Bind and unbind events
    bind: function()
    {
        for(var i = 0, l = chanserv.events.client.length; i < l; i++)
        {
            var event = chanserv.events.client[i];
            client.addListener(event, chanserv["client_" + event]);
        }

        for(var i = 0, l = chanserv.events.redis.length; i < l; i++)
        {
            var event = chanserv.events.redis[i];
            model.redisIPC.addListener(event, chanserv["redis_" + event]);
        }
    },

    unbind: function()
    {
        for(var i = 0, l = chanserv.events.client.length; i < l; i++)
        {
            var event = chanserv.events.client[i];
            client.removeListener(event, chanserv["client_" + event]);
        }

        for(var i = 0, l = chanserv.events.redis.length; i < l; i++)
        {
            var event = chanserv.events.redis[i];
            model.redisIPC.removeListener(event, chanserv["redis_" + event]);
        }
    },

    //
    // Event handlers
    ////////////////////////////////////////

    events:
    {
        client: ['raw', 'message', 'join'],
        redis: ['message']
    },

    client_raw: function(input)
    {
        if(input.command == "rpl_youreoper")
        {
            chanserv.init();
        }

        // User mode information sent with whois
        else if(input.rawCommand == 379)
        {
            var user = input.args[1].toLowerCase();
            var modes = input.args[2].match(/^is using modes \+([^ ]*)/);

            chanserv.users[user] = modes[1];
        }

        else if(input.command == "rpl_namreply")
        {
            var channel = input.args[2];
            var names = input.args[3];

            if(typeof chanserv.channels[channel] == "undefined")
            {
                chanserv.channels[channel] = {};
            }

            chanserv.channels[channel] = extend(chanserv.channels[channel], chanserv.names(names));
        }

        else if(input.command == "rpl_endofnames")
        {
            var channel = input.args[1];

            // Emit custom names event
            event.emit('names' + channel, chanserv.channels[channel]);

            // Delete temporary user list
            delete chanserv.channels[channel];
        }

        else if(input.command == "rpl_channelmodeis")
        {
            var channel = input.args[1];
            var modes = input.args.slice(2).join(' ');

            // Emit custom mode event
            event.emit('mode' + channel, modes);
        }

//        console.log(arguments);
    },

    client_message: function(from, to, message)
    {
        message = message.split(" ");
        var command = message.shift();

        // If this is a valid command
        if(chanserv.commands.indexOf(command) > -1)
        {
            // Check if a channel is specified in the command
            if(message[0] && message[0].indexOf('#') == 0)
            {
                to = message.shift();
            }
            
            // Call bot command handler function
            chanserv['_'+command](from, to, message);
        }
    },

    // Apply modes when users join channels
    client_join: function(channel, username, details)
    {
        chanserv.modes(channel, username);
    },

    redis_message: function()
    {
        console.log(arguments);
    },

    //
    // Bot commands
    ////////////////////////////////////////
    
    commands: ['register', 'mode', 'access', 'admin', 'owner', '!op', '!power'],

    _register: function(username, channel, input)
    {
        if(channel.indexOf('#') != 0)
        {
            client.say(username, "This command must be used in a channel or by specifying the channel as the first parameter.");
            client.say(username, "For example: /msg ChanServ register #wetfish");
            return;
        }
        
        chanserv.auth(username, function(error, user)
        {
            if(error)
            {
                console.log(error);
                client.say(username, "Sorry! You need to be logged in to do this. Please register with NickServ before registering a channel.");
                return;
            }

            // Check who is currently in the channel
            client.send('names', channel);

            event.once('names' + channel, function(userlist)
            {
                // Is the requesting user is +o?
                if(userlist[username] == "o")
                {
                    // Try to create the new channel
                    var channel_data =
                    {
                        name: channel,
                        owner: user.account_id
                    }

                    model.channel.register(channel_data, function(error, response)
                    {
                        if(error)
                        {
                            console.log(error);
                            client.say(username, "Sorry! "+channel+" is already registered.");
                            return;
                        }

                        client.say(username, "Congratulations! "+channel+ " is now registered to you.");

                        // Give current user admin access
                        var access =
                        {
                            account_id: user.account_id,
                            admin: 1,
                            modes: '+o'
                        }
                        
                        model.access.add({name: channel}, access);
                        
                        // Set registered channel modes
                        client.send('samode', channel, '+Pr');

                        // Join channel
                        client.join(channel, function()
                        {
                            client.send('samode', channel, '+qo', 'ChanServ', 'ChanServ');
                        });

                        // Save current channel modes
                        event.once('mode' + channel, function(modes)
                        {
                            model.channel.set({name: channel}, {modes: modes});
                            console.log("Default channel modes saved:", modes);
                        });
                    });
                }
                else
                {
                    client.say(username, "Sorry! Only channel operators (+o) can register a channel.");
                }
            });
        });
    },

    _mode: function(username, channel, input)
    {
        console.log("control freak?");
    },

    _access: function(username, channel, input)
    {
        chanserv.admin(channel, username, function(error, response)
        {
            if(error)
            {
                client.say(username, "Sorry! You do not have access to this channel.");
                return;
            }

            var action = input.shift();
            var target = input.shift();
            var modes = input.shift();

            // Check if the target is a registered name
            model.user.name({name: target}, function(error, response)
            {
                if(error || !response.length)
                {
                    client.say(username, "Sorry! The user "+target+" is not registered.");
                    return;
                }

                var user = response[0];

                if(action == 'add')
                {
                    var access =
                    {
                        account_id: user.account_id,
                        admin: 0,
                        modes: modes
                    }

                    // Save user access
                    model.access.add({name: channel}, access, function(error, response)
                    {
                        if(!error)
                        {
                            // Try to give access to the user if they're already logged in
                            chanserv.modes(channel, target);

                            client.say(username, "Alright! The user "+target+" will be automatically given: " + modes);
                            return;
                        }
                    });                
                }
            });
        });
    },

    _admin: function()
    {
        console.log("friendship engaged");
    },

    _owner: function()
    {
        console.log("goodbye old friend");
    },

    '_!op': function(from, to, input)
    {
        chanserv.modes(to, from);
    },

    // Wrapper for !op
    '_!power': function(from, to, input)
    {
        chanserv['_!op'](from, to, input);
    }
}

module.exports =
{
    load: function(_client, _core)
    {
        client = _client;
        core = _core;
        model = _core.model;

        // Bind event listeners
        chanserv.bind();
    },
    
    unload: function(_client, _core)
    {
        // Unbind event listeners
        chanserv.unbind();
        
        delete extend, events, event, client, core, model, chanserv;
    }
}
