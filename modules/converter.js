// Temporary module to convert the channel access table

var client, core, model;

module.exports =
{
    load: function(_client, _core)
    {
        client = _client;
        core = _core;
        model = _core.model;

        console.log("Converting table...");

        model.mysql.query("Select * from access", function(error, response)
        {
            if(error)
            {
                console.log(error, response);
                return;
            }

            response.forEach(function(row)
            {
                model.user.name({account_id: row.account_id}, function(error, names)
                {
                    if(error)
                    {
                        console.log(error, response);
                        return;
                    }

                    names.forEach(function(name)
                    {
                        // Set updated row data
                        delete row.account_id;
                        row.name = name.name;

                        // Save in conversion table
                        model.mysql.query("Insert into `access_convert` set ?", row);
                        console.log("Creating access record for " + name.name);
                    });
                });
            });
        });
    },
    
    unload: function(_client, _core)
    {
        delete client, core, model;
    }
}
