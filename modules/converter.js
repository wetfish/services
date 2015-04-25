// Temporary module to convert the channel access table

var client, core;

module.exports =
{
    load: function(_client, _core)
    {
        client = _client;
        core = _core;

        console.log("Converting table...");
    },
    
    unload: function(_client, _core)
    {
        delete client, core;
    }
}
