// Nickname services
var client, core, model;
var login = require("../login/sdk/server/wetfish-login");

var nickserv =
{
    // Object for storing user modes
    modes: {},

    //
    // General functions
    ////////////////////////////////////////

    // Initialize services after authentication
    init: function()
    {
        console.log("Initializing services...");

        // Set nickname
        client.send('sanick', client.nick, 'NickServ');
    },

    // Subscribe to redis authorization events
    subscribe: function()
    {
        model.redisIPC.subscribe("register");
        model.redisIPC.subscribe("login");
        model.redisIPC.subscribe("ghost");
    },

    // Bind and unbind events
    bind: function()
    {
        // Subscribe to redis again if the database reconnects
        core.event.addListener('redis_ready', nickserv.subscribe);

        for(var i = 0, l = nickserv.events.client.length; i < l; i++)
        {
            var event = nickserv.events.client[i];
            client.addListener(event, nickserv["client_" + event]);
        }

        for(var i = 0, l = nickserv.events.redis.length; i < l; i++)
        {
            var event = nickserv.events.redis[i];
            model.redisIPC.addListener(event, nickserv["redis_" + event]);
        }
    },

    unbind: function()
    {
        core.event.removeListener('redis_ready', nickserv.subscribe);

        for(var i = 0, l = nickserv.events.client.length; i < l; i++)
        {
            var event = nickserv.events.client[i];
            client.removeListener(event, nickserv["client_" + event]);
        }

        for(var i = 0, l = nickserv.events.redis.length; i < l; i++)
        {
            var event = nickserv.events.redis[i];
            model.redisIPC.removeListener(event, nickserv["redis_" + event]);
        }
    },


    //
    // Event handlers
    ////////////////////////////////////////

    events:
    {
        client: ['raw', 'message'],
        redis: ['message']
    },

    client_raw: function(input)
    {
        if(input.command == "rpl_youreoper")
        {
            nickserv.init();
        }

        // User mode information sent with whois
        else if(input.rawCommand == 379)
        {
            var user = input.args[1];
            var modes = input.args[2].match(/^is using modes \+([^ ]*)/);
            
            nickserv.modes[user] = modes[1];
        }

//        console.log(arguments);
    },

    client_message: function(from, to, message)
    {
        message = message.split(" ");
        var command = message.shift();

        // Only accept PMs
        if(to != client.nick) return;

        // If this is a valid command
        if(nickserv.commands.indexOf(command) > -1)
        {
            // Call bot command handler function
            nickserv['_'+command](from, message);
        }
    },

    redis_message: function(command, user)
    {
        user = JSON.parse(user);
        
        if(command == 'register')
        {
            model.user.register(user, function(error, account)
            {
                if(error)
                {
                    console.log(error);
                }
                else
                {
                    client.say(user.name, "Congrats! You're the proud new owner of the name "+user.name);

                    if(typeof user.session.login != "undefined")
                    {
                        client.say(user.name, "In the future, you can login automatically without a browser by using this command:");
                        client.say(user.name, "/msg NickServ identify "+user.session.login.token);
                    }

                    var slots = 3 - account.names.length;

                    if(slots > 1)
                    {
                        client.say(user.name, "You can register up to "+slots+" more names");
                    }
                    else if(slots == 1)
                    {
                        client.say(user.name, "You can register 1 more name");
                    }
                    else
                    {
                        client.say(user.name, "But watch out, you can't fit any more names on this account!");
                    }
                    
                    if(account.host)
                    {
                        client.send('chghost', user.name, account.host);
                    }
                    
                    client.send('samode', user.name, '+r');
                }
            });            
        }
        else if(command == 'login')
        {            
            // Get account information for the current user's session
            model.user.get({fish_id: user.session.user_id}, function(error, account)
            {
                if(!error)
                {
                    // Look for the target in the current user's list of names
                    var valid = false;

                    for(var i = 0, l = account.names.length; i < l; i++)
                    {
                        if(account.names[i].name == user.name)
                        {
                            valid = true;
                            break;
                        }
                    }

                    if(valid)
                    {
                        model.user.login(user.name);
                        client.send('samode', user.name, '+r');

                        if(account.host)
                        {
                            client.send('chghost', user.name, account.host);
                        }

                        client.say(user.name, "You are now logged in!");

                        if(typeof user.session.login != "undefined")
                        {
                            client.say(user.name, "In the future, you can login automatically without a browser by using this command:");
                            client.say(user.name, "/msg NickServ identify "+user.session.login.token);
                        }
                    }
                    else
                    {
                        client.say(user.name, "Hrm... it doesn't seem like you own this name.");
                    }
                }
            });
        }
        else if(command == 'ghost')
        {
            user.name = JSON.parse(user.name);

            // Get account information for the current user's session
            model.user.get({fish_id: user.session.user_id}, function(error, account)
            {
                if(!error)
                {
                    // Look for the target in the current user's list of names
                    var valid = false;

                    for(var i = 0, l = account.names.length; i < l; i++)
                    {
                        if(account.names[i].name == user.name.target)
                        {
                            valid = true;
                            break;
                        }
                    }

                    if(valid)
                    {
                        client.send('kill', user.name.target, 'GHOST command used by '+user.name.current);
                        client.say(user.name.current, "The user has been disconnected.");
                    }
                    else
                    {
                        client.say(user.name.current, "Hrm... it doesn't seem like you own that name.");
                    }
                }
            });
        }
    },

    //
    // Bot commands
    ////////////////////////////////////////
    
    commands: ['help', 'register', 'identify', 'login', 'ghost', 'host'],

    _help: function(user, message)
    {
        client.say(user, "User Services for FishNet");
        client.say(user, "========================================");
        client.say(user, " ");
        client.say(user, "Available commands:");
        client.say(user, " ");
        client.say(user, " - /msg NickServ register");
        client.say(user, "  - Register your current name.");
        client.say(user, "  - You'll be asked to log into your wetfish account for verification.");
        client.say(user, "  - If you don't have a wetfish account, you'll need to register one!");
        client.say(user, " ");
        client.say(user, " - /msg NickServ login");
        client.say(user, "  - Login using your current name.");
        client.say(user, "  - You'll be asked to log into your wetfish account for verification.");
        client.say(user, " ");
        client.say(user, " - /msg NickServ identify [code]");
        client.say(user, "  - Login using a saved token.");
        client.say(user, "  - After verifying your account, you can use a special code to login from IRC.");
        client.say(user, " ");
        client.say(user, " - /msg NickServ ghost [username]");
        client.say(user, "  - Disconnect someone using a name you've registered.");
        client.say(user, "  - You'll be asked to log into your wetfish account for verification.");
        client.say(user, " ");
        client.say(user, " - /msg NickServ host [hostname]");
        client.say(user, "  - Give yourself a custom hostname.");
        client.say(user, "  - This is the address which appears after your name in a /whois");
        client.say(user, "  - For example: rachel@unicorn.sparkle.princess");
        client.say(user, " ");
        client.say(user, "========================================");
        client.say(user, "For information on registering a channel, type /msg ChanServ help");
    },

    _register: function(user, message)
    {
        // Check if username is already registered
        model.user.name({name: user}, function(error, response)
        {
            if(response.length)
            {
                client.say(user, "Sorry friend, this name is already registered.");
            }
            else
            {
                // Generate a unique token for this request
                model.token.set(user, "register", function(token)
                {
                    // Notify the user
                    client.say(user, "Thank you for registering on FishNet! Please visit https://services.wetfish.net/token/"+token+" to verify your account.");
                });
            }
        });        
    },

    // A wrapper for login
    _identify: function(user, message)
    {
        nickserv._login(user, message);
    },

    _login: function(user, message)
    {
        // Check if username is actually registered
        model.user.name({name: user}, function(error, response)
        {
            if(!response.length)
            {
                client.say(user, "Sorry friend, this name isn't registered.");
            }
            else
            {
                if(message.length)
                {
                    var loginToken = message.shift();

                    login.verify(loginToken, function(verified)
                    {
                        if(verified.status == "success")
                        {
                            // Trigger redis message
                            nickserv.redis_message("login", JSON.stringify({session: verified.data, name: user}));
                        }
                        else
                        {
                            client.say(user, "Sorry! The token you entered is invalid. It may have expired or been revoked.");

                            // Generate a unique token for this request
                            model.token.set(user, "login", function(token)
                            {
                                // Notify the user
                                client.say(user, "To continue logging in as "+user+" please visit https://services.wetfish.net/token/"+token);
                            });
                        }
                    });
                }
                else
                {
                    // Generate a unique token for this request
                    model.token.set(user, "login", function(token)
                    {
                        // Notify the user
                        client.say(user, "Logging in as "+user+"! Please visit https://services.wetfish.net/token/"+token+" to authorize this action.");
                    });
                }
            }
        });
    },

    _ghost: function(user, message)
    {
        var target = message.shift();

        if(target && target != user)
        {
            // Check if target is a registered name
            model.user.name({name: target}, function(error, response)
            {
                if(!response.length)
                {
                    client.say(user, "Sorry friend, but the name "+target+" isn't registered.");
                }
                else
                {
                    // Generate a unique token for this request
                    model.token.set(JSON.stringify({current: user, target: target}), "ghost", function(token)
                    {
                        // Notify the user
                        client.say(user, "User "+target+" will be disconnected! Please visit https://services.wetfish.net/token/"+token+" to authorize this action.");
                    });
                }
            });
        }
        else if(target == user)
        {
            client.say(user, "Trying to kill yourself?");
        }
        else
        {
            client.say(user, "Error! You must specify a username to disconnect.");
        }
    },

    _host: function(user, message)
    {
        var hostname = message.shift();
        
        // Check if this user is logged in
        client.whois(user, function()
        {
            if(nickserv.modes[user] && nickserv.modes[user].indexOf('r') > -1)
            {
                // Make sure this hostname doesn't have any funky characters
                if(hostname && hostname.match(/^[a-z0-9._-]+$/i))
                {
                    // Make sure this hostname isn't in the list of reserved names
                    if(core.secrets.hostnames.indexOf(hostname) == -1 && !hostname.match(/^Fish-/i))
                    {
                        // Register this hostname!
                        model.user.host(user, hostname, function(error, response)
                        {
                            if(!error)
                            {
                                client.say(user, "Good choice! Your new hostname has been saved.");
                                client.send('chghost', user, hostname);
                            }
                            else
                            {
                                client.say(user, "Sorry! This hostname is already in use.");
                            }
                        });
                    }
                    else
                    {
                        client.say(user, "Sorry! The hostname you requested can't be registered.");
                    }
                }
                else
                {
                    client.say(user, "Sorry! Your hostname can't have any special characters. Please try again.");
                }
            }
            else
            {
                client.say(user, "Error! You must be logged in to set a hostname.");
            }
        });
    },
}

module.exports =
{
    load: function(_client, _core)
    {
        client = _client;
        core = _core;
        model = _core.model;

        // Initialize wetfish login
        login.init(core.secrets.login);

        // Subscribe to redis events
        nickserv.subscribe();

        // Bind event listeners
        nickserv.bind();
    },
    
    unload: function(_client, _core)
    {
        // Unbind event listeners
        nickserv.unbind();
        
        delete client, core, login, model, nickserv;
    }
}
